// server/src/ports/auditWriter.js
import fs from 'fs';
import path from 'path';

export function buildAuditWriter(filePath) {
  const abs = path.resolve(filePath);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return {
    writeEvent: (obj) => {
      try {
        fs.appendFileSync(abs, JSON.stringify(obj) + '\n', 'utf-8');
      } catch (e) {
        console.error('writeEvent failed:', e?.message || e);
      }
    }
  };
}
