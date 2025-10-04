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

  for (const r of fusionResult.reasons) {
    if (r.startsWith('Vision') && r.includes('not in POS')) {
      out.push({
        timestamp: ts,
        event_id: nextId(),
        event_data: {
          event_name: 'Scanner Avoidance',
          station_id: stationId,
          customer_id: lastPOS?.customer_id || null,
          product_sku: lastPOS?.sku || parseReasonSKU(r)
        }
      });
    }
    if (r.startsWith('Vision') && r.includes('≠ POS')) {
      // barcode switching
      const visionSKU = parseReasonSKU(r, 'Vision');
      out.push({
        timestamp: ts,
        event_id: nextId(),
        event_data: {
          event_name: 'Barcode Switching',
          station_id: stationId,
          customer_id: lastPOS?.customer_id || null,
          actual_sku: visionSKU || null,
          scanned_sku: lastPOS?.sku || null
        }
      });
    }
    if (r.startsWith('Weight delta')) {
      // weight discrepancies
      out.push({
        timestamp: ts,
        event_id: nextId(),
        event_data: {
          event_name: 'Weight Discrepancies',
          station_id: stationId,
          customer_id: lastPOS?.customer_id || null,
          product_sku: lastPOS?.sku || null,
          expected_weight: lastPOS?.expected_weight ?? null,
          actual_weight: lastPOS?.weight_g ?? null
        }
      });
    }
  }

  return out;
}

export function maybeEventsFromStatus(stationId, datasetName, status) {
  const ts = isoNow();
  if (!status) return [];
  if (/Crash|Read Error|Failure/i.test(status)) {
    return [{
      timestamp: ts,
      event_id: nextId(),
      event_data: {
        event_name: 'Unexpected Systems Crash',
        station_id: stationId,
        duration_seconds: 0  // unknown from stream; keep 0
      }
    }];
  }
  return [];
}

export function maybeEventsFromQueue(stationId, queue) {
  const ts = isoNow();
  const out = [];
  if (!queue) return out;

  if ((queue.customer_count || 0) >= 6) {
    out.push({
      timestamp: ts,
      event_id: nextId(),
      event_data: {
        event_name: 'Long Queue Length',
        station_id: stationId,
        num_of_customers: queue.customer_count
      }
    });
  }
  if ((queue.average_dwell_time || 0) >= 120) {
    out.push({
      timestamp: ts,
      event_id: nextId(),
      event_data: {
        event_name: 'Long Wait Time',
        station_id: stationId,
        wait_time_seconds: queue.average_dwell_time
      }
    });
  }
  // staffing recommendations (simple)
  if ((queue.customer_count || 0) >= 6) {
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

// Optional: inventory discrepancy mapper if you compare snapshots
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
  // crude: pull the first PRD_* token
  const m = reason.match(/(PRD_[A-Z]_\d+|PRD_\w+)/);
  return m ? m[1] : null;
}
