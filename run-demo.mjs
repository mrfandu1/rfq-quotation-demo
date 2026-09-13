import fs from 'node:fs/promises';
import {parseRfq, matchRows} from './matching.mjs';
const text = await fs.readFile(new URL('./sample/extracted-text.txt', import.meta.url), 'utf8');
const catalogue = JSON.parse(await fs.readFile(new URL('./sample/catalogue.json', import.meta.url), 'utf8'));
const rows = matchRows(parseRfq(text), catalogue);
const result = {source: 'sample-rfq.pdf', currency: 'USD', rows,
  matched: rows.filter(r => r.status === 'MATCHED').length,
  needsReview: rows.filter(r => r.status === 'REVIEW').length,
  pricedSubtotal: rows.reduce((s,r) => s + Math.round((r.amount ?? 0) * 100), 0) / 100,
  quoteStatus: 'DRAFT - human review required'};
await fs.writeFile(new URL('./sample/result.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
