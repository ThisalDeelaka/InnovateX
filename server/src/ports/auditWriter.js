import fs from 'fs';
import path from 'path';

export function buildAuditWriter(eventsFile) {
  // ensure dir exists
  const dir = path.dirname(eventsFile);
  fs.mkdirSync(dir, { recursive: true });

  const writeEvent = (jsonLineObj) => {
    fs.appendFileSync(eventsFile, JSON.stringify(jsonLineObj) + '\n', 'utf-8');
  };

  return { writeEvent };
}
