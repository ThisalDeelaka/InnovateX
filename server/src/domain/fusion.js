import { setScore } from './state.js';
import { clamp01 } from './util.js';

export function buildFusion({ thresholds, productWeights }) {
  const {
    visionConfidence,
    weightTolerancePct,
    nudge,
    hold,
  } = thresholds;

  function expectedWeightForSKU(sku, observed) {
    const w = productWeights[sku];
    return Number.isFinite(w) ? w : observed;
  }

  function computeScore(stationState) {
    let score = 0;
    const reasons = [];

    const v = stationState.vision.at(-1);
    const p = stationState.pos.at(-1);

    // 1) Scan Avoidance
    if (v?.predicted_product && (v.accuracy ?? 0) >= visionConfidence) {
      const seen = stationState.pos.some(x => x?.sku === v.predicted_product);
      if (!seen) {
        score += 0.40; reasons.push(`Vision ${v.predicted_product}@${(v.accuracy).toFixed(2)} not in POS`);
        const inBag = stationState.rfid.some(r => r?.sku === v.predicted_product && String(r?.location || '').toUpperCase().startsWith('IN'));
        if (inBag) { score += 0.20; reasons.push('RFID shows item in bag/scan area'); }
      }
    }

    // 2) Barcode Switching (Vision vs POS)
    if (v?.predicted_product && p?.sku && v.predicted_product !== p.sku) {
      score += 0.30; reasons.push(`Vision ${v.predicted_product} ≠ POS ${p.sku}`);
    }

    // 3) Weight discrepancy (± tolerance)
    if (p?.weight_g != null && p?.sku) {
      const observed = Number(p.weight_g);
      const expected = expectedWeightForSKU(p.sku, observed);
      const tol = weightTolerancePct * expected;
      if (Math.abs(observed - expected) > tol) {
        score += 0.25; reasons.push(`Weight delta ${(observed - expected).toFixed(0)}g`);
      }
    }

    // 4) Queue pressure
    const q = stationState.queue || {};
    if ((q.customer_count || 0) >= 6 || (q.average_dwell_time || 0) >= 120) {
      score += 0.05; reasons.push('High queue pressure');
    }

    return { score: clamp01(score), reasons };
  }

  return {
    thresholds: { nudge, hold },
    computeAndSet(stationId, stationState) {
      const { score, reasons } = computeScore(stationState);
      setScore(stationId, score, reasons);
      return { score, reasons };
    }
  };
}
