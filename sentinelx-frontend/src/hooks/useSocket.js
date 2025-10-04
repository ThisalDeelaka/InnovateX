// src/hooks/useSocket.js
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Configure via .env (Vite): VITE_SOCKET_URL=http://localhost:4000
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

// Kiosk roster (you can add/remove; RC1 is the regular counter)
const ALL_KIOSKS = ['SCC1', 'SCC2', 'SCC3', 'SCC4', 'RC1'];
const INITIAL_KIOSKS = Object.fromEntries(ALL_KIOSKS.map(k => [k, 'idle']));

// How long until a kiosk is marked offline without fresh "live" (ms)
const OFFLINE_TTL_MS = 5000;

// Throttle per-station live basket updates (ms)
const THROTTLE_MS = 150;

// ---------------- helpers: validation & status -----------------------

const deriveStatus = (score = 0) => {
  if (score >= 0.85) return 'alert';
  if (score > 0) return 'active';
  return 'idle';
};

const mapSeverity = (score = 0) => {
  if (score >= 0.85) return 'critical';
  if (score >= 0.7) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
};

// is "all fields null/undefined/empty"?
const isAllNullish = (obj) => {
  if (!obj || typeof obj !== 'object') return true;
  return Object.values(obj).every(v =>
    v === null ||
    v === undefined ||
    (typeof v === 'string' && v.trim() === '')
  );
};

// Validate signals by type
const isValidPOS = (x = {}) => !!(x.sku || x.product_name);        // at least name or sku
const isValidRFID = (x = {}) => !!(x.sku || x.epc);                 // at least sku or epc
const isValidVision = (x = {}) =>
  !!(x.predicted_product && (x.accuracy == null || x.accuracy >= 0.5)); // low bar, tuneable

// Stable deterministic key (no "unknown:...")
const stableKey = (x = {}) => {
  if (!x || typeof x !== 'object') return null;
  if (x.sku) return `sku:${String(x.sku).toLowerCase()}`;
  if (x.product_name) return `name:${String(x.product_name).toLowerCase()}`;
  if (x.predicted_product) return `vision:${String(x.predicted_product).toLowerCase()}`;
  if (x.epc) return `epc:${String(x.epc)}`;
  return null; // don't invent keys for empty signals
};

// Merge live POS/RFID/Vision signals into one basket for a station
const buildBasket = (station, live = {}) => {
  const map = new Map();

  // POS as primary for name/price/quantity
  for (const x of live.pos || []) {
    if (!isValidPOS(x) || isAllNullish(x)) continue;
    const key = stableKey(x) || `pos-${x.sku || x.product_name}`;
    const prev = map.get(key);
    if (prev) {
      prev.quantity += 1;
    } else {
      map.set(key, {
        id: key,
        name: x.product_name || x.sku || key,
        quantity: 1,
        price: Number.isFinite(x.price) ? x.price : 0,
        pos: true,
        rfid: false,
        vision: false,
        weight: x.weight_g != null,
      });
    }
  }

  // RFID presence
  for (const r of live.rfid || []) {
    if (!isValidRFID(r) || isAllNullish(r)) continue;
    const key = stableKey(r) || `rfid-${r.sku || r.epc}`;
    const cur =
      map.get(key) ||
      {
        id: key,
        name: r.sku || r.epc || key,
        quantity: 1,
        price: 0,
        pos: false,
        rfid: false,
        vision: false,
        weight: false,
      };
    cur.rfid = true;
    map.set(key, cur);
  }

  // Vision presence
  for (const v of live.vision || []) {
    if (!isValidVision(v) || isAllNullish(v)) continue;
    const key = stableKey(v) || `vision-${v.predicted_product}`;
    const cur =
      map.get(key) ||
      {
        id: key,
        name: v.predicted_product || key,
        quantity: 1,
        price: 0,
        pos: false,
        rfid: false,
        vision: false,
        weight: false,
      };
    cur.vision = true;
    map.set(key, cur);
  }

  return {
    kioskId: station,
    consensusScore: live.score || 0,
    items: Array.from(map.values()),
    timestamp: new Date().toISOString(),
    reasons: live.reasons || [], // optional: if backend includes evidence strings
  };
};

// ---------------- React hook ----------------------------------------

export function useSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  // per-kiosk status (idle/active/alert/offline)
  const [kiosks, setKiosks] = useState(INITIAL_KIOSKS);

  // per-kiosk live basket: { SCC1: LiveBasket, SCC2: LiveBasket, ... }
  const [baskets, setBaskets] = useState({});

  // incidents (mapped to UI shape)
  const [incidents, setIncidents] = useState([]);

  // last "live" timestamp per station (to mark offline)
  const lastSeenRef = useRef({}); // { SCC1: epoch_ms, ... }

  // throttle: last update time per station
  const lastUpdateRef = useRef({}); // { SCC1: epoch_ms, ... }

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 6000,
      timeout: 12000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Backend emits: { station: "SCC1", live: { pos:[], rfid:[], vision:[], queue:{}, score:0..1, reasons:[] } }
    socket.on('live', (payload) => {
      const station = payload?.station || 'SCC?';
      const live = payload?.live || {};

      // mark last seen
      lastSeenRef.current[station] = Date.now();

      // Update kiosk status derived from the consensus score
      setKiosks((prev) => ({
        ...prev,
        [station]: deriveStatus(live.score),
      }));

      // Throttle per station
      const now = Date.now();
      const last = lastUpdateRef.current[station] || 0;
      if (now - last < THROTTLE_MS) return;
      lastUpdateRef.current[station] = now;

      // Build and store the basket for this station
      const basket = buildBasket(station, live);
      setBaskets((prev) => ({ ...prev, [station]: basket }));
    });

    // Backend emits raw incident: { time, station, type, reason, score, evidence }
    socket.on('incident', (inc) => {
      const mapped = {
        id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kioskId: inc.station || 'SCC?',
        severity: mapSeverity(inc.score),
        reason: inc.reason || inc.type || 'Incident',
        evidence: Array.isArray(inc.evidence) ? inc.evidence : [],
        timestamp: inc.time || new Date().toISOString(),
      };

      // keep latest 50
      setIncidents((prev) => [mapped, ...prev].slice(0, 50));

      // optional: bump kiosk status to alert if high severity
      if (mapped.severity === 'critical' || mapped.severity === 'high') {
        setKiosks((prev) => ({
          ...prev,
          [mapped.kioskId]: 'alert',
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Heartbeat: mark kiosks offline if no "live" within OFFLINE_TTL_MS
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setKiosks((prev) => {
        const next = { ...prev };
        for (const k of ALL_KIOSKS) {
          const last = lastSeenRef.current[k] || 0;
          if (now - last > OFFLINE_TTL_MS) {
            next[k] = 'offline';
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return {
    isConnected,
    kiosks,   // Record<kioskId, status>
    baskets,  // Record<kioskId, LiveBasket>
    incidents // Incident[]
  };
}
