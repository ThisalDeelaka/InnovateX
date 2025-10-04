// server.js — self-contained MERN backend (ESM)
// Run: node server.js
// Env (optional): HTTP_PORT, TCP_HOST, TCP_PORT, CORS_ORIGIN, EVENTS_PATH, PRODUCTS_CSV

import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as IOServer } from 'socket.io';
import net from 'net';
import fs from 'fs';
import path from 'path';
import url from 'url';

// --------- Config ---------
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CONFIG = {
  http: {
    port: Number(process.env.HTTP_PORT || 4000),
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
  tcp: {
    host: process.env.TCP_HOST || '127.0.0.1',
    port: Number(process.env.TCP_PORT || 8765),
  },
  files: {
    eventsJsonl: path.resolve(process.env.EVENTS_PATH || path.join(__dirname, 'out', 'events.jsonl')),
    productsCsv: process.env.PRODUCTS_CSV || '', // optional
    scenariosDir: path.join(__dirname, 'data', 'scenarios'),
  },
  thresholds: {
    nudge: 0.60,
    hold: 0.85,
    visionMin: 0.85,    // min vision confidence to use for scan-avoidance
    weightTolerance: 0.07, // ±7%
  },
};

// Ensure out dirs exist
fs.mkdirSync(path.dirname(CONFIG.files.eventsJsonl), { recursive: true });
fs.mkdirSync(CONFIG.files.scenariosDir, { recursive: true });

// --------- HTTP + Socket.IO ---------
const app = express();
app.use(cors({ origin: CONFIG.http.corsOrigin }));
app.use(express.json());

const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: CONFIG.http.corsOrigin } });

// --------- In-memory live state ---------
/**
 * station -> {
 *   pos:    [{ sku, product_name, price, weight_g, expected_weight? }, ...],
 *   rfid:   [{ sku, epc, location }, ...],
 *   vision: [{ predicted_product, accuracy }, ...],
 *   queue:  { customer_count, average_dwell_time },
 *   score:  number,
 *   reasons:[string, ...]
 * }
 */
const stations = new Map();
function getStation(id = 'SCC?') {
  if (!stations.has(id)) {
    stations.set(id, {
      pos: [],
      rfid: [],
      vision: [],
      queue: { customer_count: 0, average_dwell_time: 0 },
      score: 0,
      reasons: [],
    });
  }
  return stations.get(id);
}
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// optional product weights
const productWeights = {};
if (CONFIG.files.productsCsv && fs.existsSync(CONFIG.files.productsCsv)) {
  try {
    const csv = fs.readFileSync(CONFIG.files.productsCsv, 'utf-8').split('\n').filter(Boolean);
    // naive CSV reader: header must contain SKU, weight_g
    const header = csv.shift().split(',').map(s => s.trim());
    const skuIdx = header.findIndex(h => /^sku$/i.test(h));
    const wtIdx = header.findIndex(h => /weight/i.test(h));
    if (skuIdx >= 0 && wtIdx >= 0) {
      for (const line of csv) {
        const parts = line.split(',');
        const sku = parts[skuIdx]?.trim();
        const wt = Number(parts[wtIdx]);
        if (sku && Number.isFinite(wt)) productWeights[sku] = wt;
      }
      console.log(`[init] Loaded ${Object.keys(productWeights).length} product weights`);
    }
  } catch (e) {
    console.warn('[init] Failed to load products CSV:', e.message);
  }
}

// --------- Realtime emit helpers ---------
function emitLive(stationId, s) {
  io.emit('live', { station: stationId, live: s });
}
function emitIncident(stationId, type, reason, score, evidence = []) {
  io.emit('incident', {
    time: new Date().toISOString(),
    station: stationId,
    type,
    reason,
    score,
    evidence,
  });
}
function emitInventory(evt) {
  io.emit('inventory', evt);
}

// --------- Audit writer (events.jsonl) ---------
function writeEvent(eventObj) {
  try {
    fs.appendFileSync(CONFIG.files.eventsJsonl, JSON.stringify(eventObj) + '\n', 'utf-8');
  } catch (e) {
    console.error('[audit] write error:', e.message);
  }
}
// helpers to create judge-friendly lines
const mkEvent = (event_name, data) => ({
  timestamp: new Date().toISOString(),
  event_id: 'EVT_' + Math.random().toString(36).slice(2, 8).toUpperCase(),
  event_data: { event_name, ...data },
});

function eventsFromStatus(stationId, subsystem, status) {
  if (!status) return [];
  const events = [];
  if (/Crash|Error|Down/i.test(status)) {
    events.push(mkEvent('Unexpected Systems Crash', { station_id: stationId, subsystem, status }));
  }
  return events;
}

function eventsFromFusion(stationId, result, lastPOS) {
  const out = [];
  const { flags = {} } = result;

  if (flags.scanAvoidance) {
    out.push(mkEvent('Scanner Avoidance', {
      station_id: stationId,
      product_sku: flags.scanAvoidance,
    }));
  }
  if (flags.barcodeSwitch && lastPOS?.sku) {
    out.push(mkEvent('Barcode Switching', {
      station_id: stationId,
      actual_sku: flags.barcodeSwitch.actual,
      scanned_sku: flags.barcodeSwitch.scanned,
    }));
  }
  if (flags.weightMismatch && lastPOS?.sku) {
    out.push(mkEvent('Weight Discrepancies', {
      station_id: stationId,
      product_sku: lastPOS.sku,
      expected_weight: flags.weightMismatch.expected,
      actual_weight: flags.weightMismatch.actual,
    }));
  }
  return out;
}

function eventsFromQueue(stationId, q) {
  const out = [];
  const c = Number(q?.customer_count || 0);
  const w = Number(q?.average_dwell_time || 0);

  if (c >= 6) {
    out.push(mkEvent('Long Queue Length', { station_id: stationId, num_of_customers: c }));
    // suggest staffing
    out.push(mkEvent('Staffing Needs', { station_id: stationId, Staff_type: 'Cashier' }));
    out.push(mkEvent('Checkout Station Action', { station_id: stationId, Action: 'Open' }));
  }
  if (w >= 120) {
    out.push(mkEvent('Long Wait Time', { station_id: stationId, wait_time_seconds: w }));
  }
  return out;
}

// --------- Fusion (BasketProof consensus) ---------
function expectedWeight(sku) {
  return productWeights[sku];
}

function computeFusion(stationId) {
  const s = getStation(stationId);
  let score = 0;
  const reasons = [];
  const flags = {};

  const vision = s.vision.at(-1);
  const posLast = s.pos.at(-1);

  // 1) Scan avoidance: high-confidence vision sees item not in POS
  if (vision?.predicted_product && (vision?.accuracy || 0) >= CONFIG.thresholds.visionMin) {
    const seenInPOS = s.pos.some(x => x?.sku === vision.predicted_product);
    if (!seenInPOS) {
      score += 0.40;
      reasons.push(`Vision ${vision.predicted_product}@${vision.accuracy.toFixed(2)} not in POS`);
      flags.scanAvoidance = vision.predicted_product;

      // Bonus: RFID shows same sku in bag/scan area (IN_.. locations)
      const inBag = s.rfid.some(r => r?.sku === vision.predicted_product &&
        String(r?.location || '').toUpperCase().startsWith('IN'));
      if (inBag) {
        score += 0.20;
        reasons.push('RFID in scan/bag area for vision SKU');
      }
    }
  }

  // 2) Barcode switching: vision != POS
  if (vision?.predicted_product && posLast?.sku && vision.predicted_product !== posLast.sku) {
    score += 0.30;
    reasons.push(`Vision ${vision.predicted_product} != POS ${posLast.sku}`);
    flags.barcodeSwitch = { actual: vision.predicted_product, scanned: posLast.sku };
  }

  // 3) Weight discrepancy on last POS (+/- 7%)
  if (posLast?.weight_g != null) {
    const actual = Number(posLast.weight_g);
    const expected = Number.isFinite(posLast.expected_weight)
      ? posLast.expected_weight
      : (expectedWeight(posLast.sku) ?? actual);
    const tol = CONFIG.thresholds.weightTolerance * expected;
    if (Math.abs(actual - expected) > tol) {
      score += 0.25;
      reasons.push(`Weight delta ${actual - expected}g`);
      flags.weightMismatch = { expected, actual };
    }
  }

  // 4) Queue pressure (small bump)
  const q = s.queue || {};
  if ((q.customer_count || 0) >= 6 || (q.average_dwell_time || 0) >= 120) {
    score += 0.05;
    reasons.push('High queue pressure');
  }

  s.score = clamp(score);
  s.reasons = reasons;
  return { score: s.score, reasons, flags };
}

// --------- Dataset handlers ---------
function handlePOS(evt) {
  const st = evt.station_id || 'SCC?';
  const s = getStation(st);
  s.pos.push(evt.data || {});
  if (s.pos.length > 10) s.pos.shift();

  // enrich with expected weight if known
  const last = s.pos.at(-1);
  if (last?.sku) {
    const exp = expectedWeight(last.sku);
    if (Number.isFinite(exp)) last.expected_weight = exp;
  }

  // audit system status
  const status = evt.status || '';
  eventsFromStatus(st, 'POS_Transactions', status).forEach(writeEvent);

  const result = computeFusion(st);
  // judge events
  eventsFromFusion(st, result, last).forEach(writeEvent);

  // realtime incidents
  if (result.score >= CONFIG.thresholds.hold) {
    emitIncident(st, 'hold', 'High-risk basket', result.score, s.reasons);
  } else if (result.score >= CONFIG.thresholds.nudge) {
    emitIncident(st, 'nudge', 'Please re-scan suspected item', result.score, s.reasons);
  }

  emitLive(st, s);
}

function handleRFID(evt) {
  const st = evt.station_id || 'SCC?';
  const s = getStation(st);
  s.rfid.push(evt.data || {});
  if (s.rfid.length > 20) s.rfid.shift();
  emitLive(st, s);
}

function handleVision(evt) {
  const st = evt.station_id || 'SCC?';
  const s = getStation(st);
  s.vision.push(evt.data || {});
  if (s.vision.length > 10) s.vision.shift();

  const status = evt.status || '';
  eventsFromStatus(st, 'Product_recognism', status).forEach(writeEvent);

  const result = computeFusion(st);
  eventsFromFusion(st, result, s.pos.at(-1)).forEach(writeEvent);

  if (result.score >= CONFIG.thresholds.hold) {
    emitIncident(st, 'hold', 'High-risk basket', result.score, s.reasons);
  } else if (result.score >= CONFIG.thresholds.nudge) {
    emitIncident(st, 'nudge', 'Please re-scan suspected item', result.score, s.reasons);
  }
  emitLive(st, s);
}

function handleQueue(evt) {
  const st = evt.station_id || 'SCC?';
  const s = getStation(st);
  s.queue = evt.data || {};
  eventsFromQueue(st, s.queue).forEach(writeEvent);
  emitLive(st, s);
}

function handleInventory(evt) {
  // (optional) diff snapshots and write "Inventory Discrepancy" here
  emitInventory(evt);
}

function routeFrame(frame) {
  try {
    const ds = String(frame?.dataset || '').toLowerCase();
    const evt = frame?.event || {};

    if (ds.includes('pos_transactions')) return handlePOS(evt);
    if (ds.includes('rfid_data') || ds.includes('rfid_readings')) return handleRFID(evt);
    if (ds.includes('product_recognism') || ds.includes('product_recognition')) return handleVision(evt);
    if (ds.includes('queue_monitor')) return handleQueue(evt);
    if (ds.includes('current_inventory_data') || ds.includes('inventory_snapshots')) return handleInventory(evt);
    // unknown dataset: ignore safely (covers last-minute surprise dataset)
  } catch (e) {
    console.error('[routeFrame] error:', e.message);
  }
}

// --------- TCP stream client ---------
function startTCP() {
  const { host, port } = CONFIG.tcp;
  function connect() {
    const sock = net.createConnection({ host, port });
    let buffer = '';
    sock.setEncoding('utf8');

    sock.on('connect', () => {
      console.log(`[tcp] connected to ${host}:${port}`);
    });

    sock.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const frame = JSON.parse(line);
          // banner or frame
          if (frame?.service === 'project-sentinel-event-stream') {
            console.log(`[tcp] banner: datasets=${(frame.datasets || []).join(', ')} speed=${frame.speed_factor}`);
          } else {
            routeFrame(frame);
          }
        } catch {
          // ignore malformed line
        }
      }
    });

    sock.on('error', (err) => {
      console.warn('[tcp] error:', err.message);
    });
    sock.on('close', () => {
      console.warn('[tcp] closed; retrying in 1s');
      setTimeout(connect, 1000);
    });
  }
  connect();
}

// --------- HTTP routes ---------
app.get('/health', (req, res) => {
  res.json({ ok: true, tcp: CONFIG.tcp, out: CONFIG.files.eventsJsonl });
});

// Simulate: replay server/data/scenarios/*.jsonl OR emit a fallback incident
app.post('/simulate', (req, res) => {
  const scenario = (req.body?.scenario || req.body?.type || 'scan_avoidance').toString();
  const p = path.join(CONFIG.files.scenariosDir, `${scenario}.jsonl`);
  if (!fs.existsSync(p)) {
    // fallback so UI still shows activity
    emitIncident('SCC1', 'nudge', `Demo simulation (${scenario})`, 0.72, ['demo']);
    return res.json({ ok: true, fallback: true, note: 'scenario file not found - emitted demo incident' });
  }

  const lines = fs.readFileSync(p, 'utf-8').split('\n').filter(Boolean);
  (async () => {
    for (const line of lines) {
      try {
        const frame = JSON.parse(line);
        routeFrame(frame);
      } catch {}
      await new Promise(r => setTimeout(r, 40));
    }
  })();

  res.json({ ok: true, scenario });
});

// --------- Boot ---------
server.listen(CONFIG.http.port, () => {
  console.log(`HTTP/Socket.IO on http://localhost:${CONFIG.http.port}`);
  startTCP();
});
