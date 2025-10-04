// server/src/domain/mappers.js
import { isoNow } from '../utils/time.js';

// Sequential event-id
let COUNTER = 0;
const nextId = () => `E${String(COUNTER++).padStart(3, '0')}`;

/**
 * Map fusion reasons/score to judge events.
 * Return an array of {timestamp, event_id, event_data}
 */
export function maybeEventsFromFusion(stationId, fusionResult, lastPOS) {
  const out = [];
  const ts = isoNow();
  const reasons = Array.isArray(fusionResult?.reasons) ? fusionResult.reasons : [];

  for (const rRaw of reasons) {
    const r = String(rRaw || '');
    const rLower = r.toLowerCase();

    // -----------------------------
    // 1) Scanner Avoidance
    // e.g. "Vision PRD_F_07@0.92 not in POS"
    // -----------------------------
    if (rLower.includes('vision') && rLower.includes('not in pos')) {
      out.push({
        timestamp: ts,
        event_id: nextId(),
        event_data: {
          event_name: 'Scanner Avoidance',
          station_id: stationId,
          customer_id: lastPOS?.customer_id || null,
          product_sku: lastPOS?.sku || parseReasonSKU(r),
        }
      });
      continue;
    }

    // -----------------------------
    // 2) Barcode Switching
    // e.g. "Vision PRD_F_03 != POS PRD_F_02"
    //     or "Vision PRD_F_03 ≠ POS PRD_F_02"
    // -----------------------------
    if (rLower.includes('vision') && (r.includes('!=') || r.includes('≠'))) {
      const visionSKU = parseReasonSKU(r, 'Vision');
      // If lastPOS exists, it's the scanned SKU
      const scanned = lastPOS?.sku || null;
      out.push({
        timestamp: ts,
        event_id: nextId(),
        event_data: {
          event_name: 'Barcode Switching',
          station_id: stationId,
          customer_id: lastPOS?.customer_id || null,
          actual_sku: visionSKU || null,
          scanned_sku: scanned
        }
      });
      continue;
    }

    // -----------------------------
    // 3) Weight Discrepancies
    // e.g. "Weight delta -20g"
    // -----------------------------
    if (rLower.startsWith('weight delta') || rLower.includes('weight')) {
      out.push({
        timestamp: ts,
        event_id: nextId(),
        event_data: {
          event_name: 'Weight Discrepancies',
          station_id: stationId,
          customer_id: lastPOS?.customer_id || null,
          product_sku: lastPOS?.sku || parseReasonSKU(r),
          expected_weight: lastPOS?.expected_weight ?? null,
          actual_weight: lastPOS?.weight_g ?? null,
        }
      });
      continue;
    }
  }

  return out;
}

export function maybeEventsFromStatus(stationId, datasetName, status) {
  const ts = isoNow();
  const s = String(status || '');
  if (!s) return [];

  if (/crash|read error|failure/i.test(s)) {
    return [{
      timestamp: ts,
      event_id: nextId(),
      event_data: {
        event_name: 'Unexpected Systems Crash',
        station_id: stationId,
        duration_seconds: 0  // unknown from stream
      }
    }];
  }
  return [];
}

export function maybeEventsFromQueue(stationId, queue) {
  const ts = isoNow();
  const out = [];
  const count = Number(queue?.customer_count || 0);
  const dwell = Number(queue?.average_dwell_time || 0);

  if (count >= 6) {
    out.push({
      timestamp: ts,
      event_id: nextId(),
      event_data: {
        event_name: 'Long Queue Length',
        station_id: stationId,
        num_of_customers: count
      }
    });
  }
  if (dwell >= 120) {
    out.push({
      timestamp: ts,
      event_id: nextId(),
      event_data: {
        event_name: 'Long Wait Time',
        station_id: stationId,
        wait_time_seconds: dwell
      }
    });
  }
  if (count >= 6) {
    out.push({
      timestamp: ts,
      event_id: nextId(),
      event_data: {
        event_name: 'Staffing Needs',
        station_id: stationId,
        Staff_type: 'Cashier'
      }
    });
    out.push({
      timestamp: ts,
      event_id: nextId(),
      event_data: {
        event_name: 'Checkout Station Action',
        station_id: stationId,
        Action: 'Open'
      }
    });
  }
  return out;
}

// Optional helper to emit an inventory discrepancy
export function inventoryDiscrepancyEvent(sku, exp, act) {
  const ts = isoNow();
  return {
    timestamp: ts,
    event_id: nextId(),
    event_data: {
      event_name: 'Inventory Discrepancy',
      SKU: sku,
      Expected_Inventory: exp,
      Actual_Inventory: act
    }
  };
}

function parseReasonSKU(reason) {
  // Pull the first PRD_* token reliably
  const m = String(reason || '').match(/\bPRD_[A-Z]_\d+\b|\bPRD_[A-Za-z0-9_]+\b/);
  return m ? m[0] : null;
}
