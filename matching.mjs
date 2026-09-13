// Deterministic matching for the agreed demonstration layout. No external API.
export function parseRfq(text) {
  if (typeof text !== 'string') throw new Error('PDF extraction returned no text');
  const section = text.match(/BEGIN RFQ ITEMS([\s\S]*?)END RFQ ITEMS/);
  const count = text.match(/ITEM COUNT:\s*(\d+)/);
  if (!section || !count) throw new Error('Unsupported layout: item boundaries/count missing');
  const lines = section[1].split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (lines.shift() !== 'Item | Product code | Description | Quantity | Unit') {
    throw new Error('Unsupported table header');
  }
  const rows = lines.map(line => {
    const fields = line.split('|').map(x => x.trim());
    if (fields.length !== 5 || !/^\d+$/.test(fields[0]) || !fields[1] || !fields[2] || !fields[4]) {
      throw new Error(`Malformed item row: ${line}`);
    }
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(fields[3]) || Number(fields[3]) <= 0) {
      throw new Error(`Invalid quantity on row ${fields[0]}`);
    }
    return {line: Number(fields[0]), code: fields[1], description: fields[2], quantity: Number(fields[3]), unit: fields[4]};
  });
  if (rows.length !== Number(count[1]) || rows.length === 0 || rows.length > 100) {
    throw new Error('Item count mismatch or unsupported row count');
  }
  if (new Set(rows.map(r => r.line)).size !== rows.length) throw new Error('Duplicate RFQ line number');
  return rows;
}

export function matchRows(rows, catalogue) {
  const normalize = x => String(x).trim().replace(/\s+/g, ' ').toUpperCase();
  const index = new Map();
  for (const product of catalogue) {
    const key = normalize(product.code);
    index.set(key, [...(index.get(key) || []), product]);
  }
  return rows.map(row => {
    const candidates = index.get(normalize(row.code)) || [];
    let issue = '';
    let product = null;
    if (candidates.length === 0) issue = 'Unknown product code';
    else if (candidates.length !== 1) issue = 'Duplicate catalogue code';
    else {
      product = candidates[0];
      if (normalize(product.unit) !== normalize(row.unit)) issue = 'Unit mismatch';
      else if (normalize(product.description) !== normalize(row.description)) issue = 'Description mismatch';
      else if (product.approved !== true) issue = 'Price not approved';
      else if (product.price === null || product.price === undefined || product.price === '') issue = 'Missing approved price';
      else if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(product.price))) issue = 'Invalid approved price';
      else if (product.currency !== 'USD') issue = 'Currency mismatch';
    }
    const unitCents = issue ? null : Math.round(Number(product.price) * 100);
    const amountCents = issue ? null : Math.round(row.quantity * unitCents);
    return {...row, status: issue ? 'REVIEW' : 'MATCHED', issue, unitPrice: unitCents === null ? null : unitCents / 100,
      amount: amountCents === null ? null : amountCents / 100, catalogueDescription: product?.description ?? '', catalogueUnit: product?.unit ?? ''};
  });
}
