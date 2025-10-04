export function buildRealtime(io) {
  function emitLive(stationId, state) {
    io.emit('live', {
      station: stationId,
      live: {
        pos: state.pos,
        rfid: state.rfid,
        vision: state.vision,
        queue: state.queue,
        score: state.score,
        reasons: state.reasons
      }
    });
  }
  function emitIncident(stationId, type, reason, score, evidence = []) {
    const inc = {
      time: new Date().toISOString(),
      station: stationId,
      type, reason,
      score: Number(score.toFixed(3)),
      evidence
    };
    io.emit('incident', inc);
    return inc;
  }
  function emitInventory(evt) {
    io.emit('inventory', evt);
  }
  return { emitLive, emitIncident, emitInventory };
}
