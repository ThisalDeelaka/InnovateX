import net from "net";
import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";

const TCP_HOST = "127.0.0.1";
const TCP_PORT = 8765;   // simulator
const HTTP_PORT = 4000;  // our server

const app = express();
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: "*" } });
app.use(express.json());

// ---- in-memory state ----
const live = new Map();  // station -> {pos:[], rfid:[], vision:[], queue:{}, score}
const incidents = [];    // latest incidents
const productWeights = {}; // optional (sku->weight_g), skip for hackathon

function getStation(id = "SCC?") {
  if (!live.has(id)) {
    live.set(id, { pos: [], rfid: [], vision: [], queue: { customer_count:0, average_dwell_time:0 }, score: 0 });
  }
  return live.get(id);
}
function addIncident(station, type, reason, score, evidence=[]) {
  const inc = { time: new Date().toISOString(), station, type, reason, score:+score.toFixed(3), evidence };
  incidents.unshift(inc);
  if (incidents.length > 200) incidents.pop();
  io.emit("incident", inc);
}
const clamp = (x, lo=0, hi=1) => Math.max(lo, Math.min(hi, x));

function expectedWeight(sku){ return productWeights[sku]; }

// ---- rule engine ----
function computeScore(station) {
  const s = getStation(station);
  let score = 0;
  const ev = [];

  const v = s.vision.at(-1);
  const p = s.pos.at(-1);

  // 1) scan avoidance
  if (v?.predicted_product && (v.accuracy ?? 0) >= 0.85) {
    const seen = s.pos.some(x => x.sku === v.predicted_product);
    if (!seen) {
      score += 0.40; ev.push(`Vision ${v.predicted_product}@${v.accuracy.toFixed(2)} not in POS`);
      const inBag = s.rfid.some(r => r.sku === v.predicted_product && String(r.location||"").toUpperCase().startsWith("IN"));
      if (inBag) { score += 0.20; ev.push("RFID in scan/bag area for vision SKU"); }
    }
  }
  // 2) barcode switching
  if (v?.predicted_product && p?.sku && v.predicted_product !== p.sku) {
    score += 0.30; ev.push(`Vision ${v.predicted_product} != POS ${p.sku}`);
  }
  // 3) weight discrepancy (+/-7%)
  if (p?.weight_g != null) {
    const observed = p.weight_g;
    const exp = expectedWeight(p.sku) ?? observed;
    const tol = 0.07 * exp;
    if (Math.abs(observed - exp) > tol) { score += 0.25; ev.push(`Weight delta ${observed-exp}g`); }
  }
  // 4) queue bump
  const q = s.queue || {};
  if ((q.customer_count||0) >= 6 || (q.average_dwell_time||0) >= 120) {
    score += 0.05; ev.push("High queue pressure");
  }

  s.score = clamp(score);
  return { score: s.score, evidence: ev };
}

// ---- dataset handlers ----
function handlePOS(evt) {
  const st = evt.station_id || "SCC?";
  const s = getStation(st);
  s.pos.push(evt.data || {}); if (s.pos.length>10) s.pos.shift();
  const status = evt.status || "Active";
  if (/Crash|Read Error/i.test(status)) addIncident(st, "system_error", status, 0.7, ["POS status"]);
  const { score, evidence } = computeScore(st);
  if (score >= 0.85) addIncident(st, "hold", "High-risk basket", score, evidence);
  else if (score >= 0.60) addIncident(st, "nudge", "Please re-scan suspected item", score, evidence);
  io.emit("live", { station: st, live: s });
}
function handleRFID(evt) {
  const st = evt.station_id || "SCC?";
  const s = getStation(st);
  s.rfid.push(evt.data || {}); if (s.rfid.length>20) s.rfid.shift();
  io.emit("live", { station: st, live: s });
}
function handleVision(evt) {
  const st = evt.station_id || "SCC?";
  const s = getStation(st);
  s.vision.push(evt.data || {}); if (s.vision.length>10) s.vision.shift();
  const status = evt.status || "Active";
  if (/Crash|Read Error/i.test(status)) addIncident(st, "vision_error", status, 0.6, ["Vision status"]);
  const { score, evidence } = computeScore(st);
  if (score >= 0.85) addIncident(st, "hold", "High-risk basket", score, evidence);
  else if (score >= 0.60) addIncident(st, "nudge", "Please re-scan suspected item", score, evidence);
  io.emit("live", { station: st, live: s });
}
function handleQueue(evt) {
  const st = evt.station_id || "SCC?";
  const s = getStation(st);
  s.queue = evt.data || {};
  io.emit("live", { station: st, live: s });
}
function handleInventory(evt) {
  io.emit("inventory", evt);
}

function routeFrame(frame) {
  const ds = frame.dataset || "";
  const evt = frame.event || {};
  if (ds === "POS_Transactions" || ds === "pos_transactions") return handlePOS(evt);
  if (ds === "RFID_data" || ds === "rfid_readings") return handleRFID(evt);
  if (ds === "Product_recognism" || ds === "product_recognition") return handleVision(evt);
  if (ds === "Queue_monitor" || ds === "queue_monitoring") return handleQueue(evt);
  if (ds === "Current_inventory_data" || ds === "inventory_snapshots") return handleInventory(evt);
  // unknown dataset: ignore (safe for last-minute dataset)
}

// ---- TCP reader ----
function startTCP() {
  function connect() {
    const sock = net.createConnection({ host: TCP_HOST, port: TCP_PORT });
    let buffer = ""; sock.setEncoding("utf8");

    sock.on("data", chunk => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try { routeFrame(JSON.parse(line)); } catch {}
      }
    });
    sock.on("error", () => setTimeout(connect, 1000));
    sock.on("close", () => setTimeout(connect, 1000));
  }
  connect();
}

// ---- Simulate endpoint (optional; for Immune Mode) ----
import fs from "fs";
import path from "path";
import url from "url";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
app.post("/simulate", (req, res) => {
  let body = "";
  req.on("data", d => body += d.toString());
  req.on("end", async () => {
    const { scenario="scan_avoidance" } = body? JSON.parse(body): {};
    const p = path.join(__dirname, "data", "scenarios", `${scenario}.jsonl`);
    if (!fs.existsSync(p)) return res.status(404).json({ ok:false, error:"scenario not found" });
    const lines = fs.readFileSync(p, "utf-8").split("\n").filter(Boolean);
    (async () => {
      for (const line of lines) { try { routeFrame(JSON.parse(line)); } catch {} await new Promise(r=>setTimeout(r,50)); }
    })();
    res.json({ ok:true });
  });
});

server.listen(HTTP_PORT, () => {
  console.log(`HTTP/Socket.IO server: http://localhost:${HTTP_PORT}`);
  startTCP();
});
