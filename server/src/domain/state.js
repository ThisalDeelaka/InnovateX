const store = new Map(); // station -> { pos:[], rfid:[], vision:[], queue:{}, score, reasons[] }

export function getStation(stationId = 'SCC?') {
  if (!store.has(stationId)) {
    store.set(stationId, {
      pos: [],
      rfid: [],
      vision: [],
      queue: { customer_count: 0, average_dwell_time: 0 },
      score: 0,
      reasons: []
    });
  }
  return store.get(stationId);
}

export function setQueue(stationId, queueData) {
  const s = getStation(stationId);
  s.queue = queueData || { customer_count: 0, average_dwell_time: 0 };
  return s;
}

export function pushPOS(stationId, posEvent) {
  const s = getStation(stationId);
  s.pos.push(posEvent || {});
  if (s.pos.length > 10) s.pos.shift();
  return s;
}

export function pushRFID(stationId, rfidEvent) {
  const s = getStation(stationId);
  s.rfid.push(rfidEvent || {});
  if (s.rfid.length > 30) s.rfid.shift();
  return s;
}

export function pushVision(stationId, visionEvent) {
  const s = getStation(stationId);
  s.vision.push(visionEvent || {});
  if (s.vision.length > 10) s.vision.shift();
  return s;
}

export function setScore(stationId, score, reasons) {
  const s = getStation(stationId);
  s.score = score;
  s.reasons = reasons || [];
  return s;
}
