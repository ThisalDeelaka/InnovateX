import 'dotenv/config';

export const CONFIG = {
  tcp: {
    host: process.env.TCP_HOST || '127.0.0.1',
    port: Number(process.env.TCP_PORT || 8765),
  },
  http: {
    port: Number(process.env.HTTP_PORT || 4000),
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
  thresholds: {
    visionConfidence: Number(process.env.VISION_CONFIDENCE || 0.85),
    weightTolerancePct: Number(process.env.WEIGHT_TOLERANCE_PCT || 0.07),
    nudge: Number(process.env.NUDGE_THRESHOLD || 0.60),
    hold: Number(process.env.HOLD_THRESHOLD || 0.85),
  },
  files: {
    eventsJsonl: process.env.EVENTS_FILE || './data/output/events.jsonl',
    productsCsv: process.env.PRODUCTS_CSV || './data/input/products_list.csv',
  }
};
