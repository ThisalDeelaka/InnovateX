import fs from 'fs';

export function readProductsWeights(csvPath) {
  const weights = {}; // sku -> weight_g
  if (!fs.existsSync(csvPath)) return weights;

  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (!header) return weights;

  const cols = header.split(',');
  const idxSKU = cols.findIndex(c => c.trim().toLowerCase() === 'sku');
  const idxWeight = cols.findIndex(c => c.trim().toLowerCase().includes('weight'));

  for (const line of lines) {
    const parts = line.split(',');
    const sku = parts[idxSKU]?.trim();
    const w = Number(parts[idxWeight]);
    if (sku && Number.isFinite(w)) weights[sku] = w;
  }
  return weights;
}
