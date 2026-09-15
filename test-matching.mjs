import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseRfq, matchRows} from './matching.mjs';
const text = await fs.readFile(new URL('./sample/extracted-text.txt', import.meta.url), 'utf8');
const catalogue = JSON.parse(await fs.readFile(new URL('./sample/catalogue.json', import.meta.url), 'utf8'));
const rows = parseRfq(text);
const result = matchRows(rows, catalogue);
assert.equal(result.length, 8);
assert.deepEqual(result.map(r => r.issue), ['', '', 'Unknown product code', 'Duplicate catalogue code', 'Unit mismatch', 'Missing approved price', 'Price not approved', 'Description mismatch']);
assert.equal(result[0].amount, 102);
assert.equal(result[1].amount, 47);
assert.ok(result.slice(2).every(r => r.amount === null && r.unitPrice === null));
assert.throws(() => parseRfq(text.replace('ITEM COUNT: 8', 'ITEM COUNT: 9')), /count mismatch/);
assert.throws(() => parseRfq(text.replace('12 | EA', '-12 | EA')), /Invalid quantity/);
assert.throws(() => parseRfq('unrecognized text'), /Unsupported layout/);
assert.throws(() => parseRfq(text.replace('02 | TRM-004', '01 | TRM-004')), /Duplicate RFQ/);
const zero = structuredClone(catalogue);
zero[0].price = '0.00';
assert.equal(matchRows(rows, zero)[0].amount, 0);
zero[0].price = '-5';
assert.equal(matchRows(rows, zero)[0].issue, 'Invalid approved price');
zero[0].price = '8.50'; zero[0].currency = 'EUR';
assert.equal(matchRows(rows, zero)[0].issue, 'Currency mismatch');
console.log('PASS: PDF row count, eight matching outcomes, amounts, missing prices, zero price, negative quantity, malformed layout, duplicate row and currency checks');

// Buyer-reported decimal ties must round half up, without binary-float drift.
const roundingRow = {line: 1, code: 'ROUND', description: 'Rounding regression', quantity: 0.145, unit: 'EA'};
const roundingProduct = {code: 'ROUND', description: 'Rounding regression', unit: 'EA', price: '1.00', currency: 'USD', approved: true};
const roundingCases = [
  [0.145, '1.00', 0.15], [1.005, '1.00', 1.01], [4.015, '1.00', 4.02],
  [0.005, '1.00', 0.01], [0.005, '0.99', 0], [0.144, '1.00', 0.14],
  [0.146, '1.00', 0.15], [1.005, '1.25', 1.26], [0.145, '0.00', 0],
];
for (const [quantity, price, expected] of roundingCases) {
  const actual = matchRows([{...roundingRow, quantity}], [{...roundingProduct, price}])[0].amount;
  assert.equal(actual, expected, `${quantity} x ${price} must round half up to ${expected}`);
}
const aed = matchRows([roundingRow], [{...roundingProduct, currency: 'AED'}], 'AED')[0];
assert.equal(aed.amount, 0.15);
assert.equal(aed.status, 'MATCHED');
assert.equal(matchRows([roundingRow], [roundingProduct], 'AED')[0].issue, 'Currency mismatch');
assert.equal(matchRows([roundingRow], [{...roundingProduct, currency: 'AED'}])[0].issue, 'Currency mismatch');
assert.throws(() => matchRows([roundingRow], [roundingProduct], 'EUR'), /Unsupported quotation currency/);
const large = matchRows([roundingRow], [{...roundingProduct, price: '90071992547410.00'}])[0];
assert.equal(large.status, 'REVIEW');
assert.equal(large.amount, null);
assert.throws(() => parseRfq(text.replace('12 | EA', '9007199254740993 | EA')), /Invalid quantity/);
console.log('PASS: 9 exact-decimal rounding cases; AED matching; mixed-currency rejection; unsafe numeric range rejection');
console.log(JSON.stringify({regression: '0.145 x 1.00', rule: 'decimal half-up to 2 places', USD: matchRows([roundingRow], [roundingProduct])[0].amount, AED: aed.amount}));
