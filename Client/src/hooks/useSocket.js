import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

/**
 * Backend emits:
 * - 'live': { station, live: {pos[], rfid[], vision[], queue{}, score, reasons[] } }
 * - 'incident': { time, station, type, reason, score, evidence[] }
 */
export function useSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  const [kiosks, setKiosks] = useState({
    SCC1: 'idle',
    SCC2: 'idle',
    SCC3: 'idle',
    SCC4: 'idle',
    RC1: 'idle',
  });

  const [currentBasket, setCurrentBasket] = useState(null);
  const [incidents, setIncidents] = useState([]);

  const deriveStatus = (score) => {
    if (score >= 0.85) return 'alert';
    if (score > 0) return 'active';
    return 'idle';
  };

  const buildBasket = (station, live) => {
    const byKey = new Map();

    // POS primary
    for (const x of (live.pos || [])) {
      const key = x.sku || x.product_name || `POS-${Math.random()}`;
      byKey.set(key, {
        name: x.product_name || key,
        quantity: 1,
        price: Number.isFinite(x.price) ? x.price : 0,
        pos: true,
        rfid: false,
        vision: false,
        weight: x.weight_g != null,
      });
    }
    // RFID
    for (const r of (live.rfid || [])) {
      const key = r.sku || r.epc || `RFID-${Math.random()}`;
      const cur = byKey.get(key) || { name: key, quantity: 1, price: 0, pos: false, rfid: false, vision: false, weight: false };
      cur.rfid = true;
      byKey.set(key, cur);
    }
    // Vision
    for (const v of (live.vision || [])) {
      const key = v.predicted_product || `VISION-${Math.random()}`;
      const cur = byKey.get(key) || { name: key, quantity: 1, price: 0, pos: false, rfid: false, vision: false, weight: false };
      cur.vision = true;
      byKey.set(key, cur);
    }

    return {
      kioskId: station,
      consensusScore: live.score || 0,
      items: Array.from(byKey.values()),
      timestamp: new Date().toISOString(),
      reasons: live.reasons || [],
    };
  };

  const mapSeverity = (score) => {
    if (score >= 0.85) return 'critical';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  };

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('live', (payload) => {
      const station = payload.station;
      const live = payload.live;
      setKiosks((prev) => ({
        ...prev,
        [station]: deriveStatus(live.score || 0),
      }));
      setCurrentBasket(buildBasket(station, live));
    });

    socket.on('incident', (inc) => {
      const mapped = {
        id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kioskId: inc.station,
        severity: mapSeverity(inc.score || 0),
        reason: inc.reason,
        evidence: inc.evidence || [],
        timestamp: inc.time,
      };
      setIncidents((prev) => [mapped, ...prev].slice(0, 50));
    });

    return () => socket.disconnect();
  }, []);

  return { isConnected, kiosks, currentBasket, incidents };
}
