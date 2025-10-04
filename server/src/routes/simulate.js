import fs from 'fs';
import path from 'path';
import express from 'express';

export function buildSimulateRouter(routeFrame) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { scenario = 'scan_avoidance' } = req.body || {};
    const p = path.join(process.cwd(), 'data', 'scenarios', `${scenario}.jsonl`);
    if (!fs.existsSync(p)) return res.status(404).json({ ok: false, error: 'scenario not found' });

    const lines = fs.readFileSync(p, 'utf-8').split('\n').filter(Boolean);
    (async () => {
      for (const line of lines) {
        try { routeFrame(JSON.parse(line)); } catch {}
        await new Promise(r => setTimeout(r, 50));
      }
    })();

    res.json({ ok: true });
  });

  return router;
}
