import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const isAed = process.env.RFQ_CASE === 'aed-rounding';
const currency = isAed ? 'AED' : 'USD';
const pdfName = isAed ? 'aed-rounding-rfq.pdf' : 'sample-rfq.pdf';
const workbookName = isAed ? 'quotation-native-aed.xlsx' : 'quotation-native-n8n.xlsx';
const pdf = fs.readFileSync(path.join(here, 'sample', pdfName)).toString('base64');
const catalogue = JSON.parse(fs.readFileSync(path.join(here, isAed ? 'sample/aed-rounding-catalogue.json' : 'sample/catalogue.json'), 'utf8'));
const source = fs.readFileSync(path.join(here, 'matching.mjs'), 'utf8').replaceAll('export function ', 'function ');
const node = (id, name, type, typeVersion, position, parameters) => ({id, name, type, typeVersion, position, parameters});
const names = ['Run demonstration', 'Load synthetic PDF', 'Extract PDF text', 'Parse and match approved prices', 'Create Excel draft'];
const workflow = {
  id: isAed ? 'RFQDemoAED' : 'RFQDemoSynthetic',
  name: isAed ? 'RFQ to quotation - AED rounding regression' : 'RFQ to quotation - synthetic demonstration',
  active: false,
  nodes: [
    node('rfq-trigger', names[0], 'n8n-nodes-base.manualTrigger', 1, [0, 0], {}),
    node('rfq-load', names[1], 'n8n-nodes-base.code', 2, [250, 0], {
      mode: 'runOnceForAllItems',
      jsCode: `// Embedded synthetic fixture; no credentials or network requests.\nreturn [{json: {reference: 'RFQ-DEMO-001', synthetic: true}, binary: {data: {data: '${pdf}', mimeType: 'application/pdf', fileName: '${pdfName}', fileExtension: 'pdf'}}}];`
    }),
    node('rfq-extract', names[2], 'n8n-nodes-base.extractFromFile', 1.1, [500, 0], {
      operation: 'pdf', binaryPropertyName: 'data', options: {joinPages: true}
    }),
    node('rfq-match', names[3], 'n8n-nodes-base.code', 2, [750, 0], {
      mode: 'runOnceForAllItems',
      jsCode: `${source}\nconst catalogue = ${JSON.stringify(catalogue, null, 2)};\nconst rows = matchRows(parseRfq($input.first().json.text), catalogue, '${currency}');\nreturn rows.map(r => ({json: {Reference: 'RFQ-DEMO-001', Line: r.line, Code: r.code, Description: r.description, Quantity: r.quantity, Unit: r.unit, 'Catalogue description': r.catalogueDescription, 'Catalogue unit': r.catalogueUnit, 'Unit price ${currency}': r.unitPrice, 'Amount ${currency}': r.amount, Status: r.status, 'Review reason': r.issue, Notice: 'SYNTHETIC DATA - human review required; incomplete draft'}}));`
    }),
    node('rfq-xlsx', names[4], 'n8n-nodes-base.convertToFile', 1.1, [1000, 0], {
      operation: 'xlsx', binaryPropertyName: 'data', options: {fileName: workbookName, headerRow: true, sheetName: 'Quotation draft', compression: true}
    }),
    node('rfq-note', 'Read before running', 'n8n-nodes-base.stickyNote', 1, [180, -310], {
      content: (isAed ? 'AED regression: 0.145 x 1.00 = 0.15; 0.005 x 1.00 = 0.01; 0.144 x 1.00 = 0.14. Three AED matches, one USD currency mismatch left unpriced. No currency conversion.\n\n' : '') + '## Synthetic PDF → quotation draft\nRun manually, then download **data** from Create Excel draft.\n\nThe default USD fixture has 8 rows: 2 matched (149 subtotal), 6 unpriced REVIEW rows. All products/prices are invented. Only the deliberately agreed text layout is supported. No OCR, external APIs, credentials or automatic substitutions.\n\nThe formatted companion workbook is a separate presentation sample; this workflow creates a plain XLSX table. Adaptation to actual buyer documents requires sample review.',
      height: 250, width: 960, color: 5
    })
  ],
  connections: Object.fromEntries(names.slice(0, -1).map((name, i) => [name, {main: [[{node: names[i + 1], type: 'main', index: 0}]]}])),
  settings: {executionOrder: 'v1'},
  pinData: {},
  tags: []
};
fs.writeFileSync(path.join(here, isAed ? 'rfq-to-quotation-aed.n8n.json' : 'rfq-to-quotation.n8n.json'), JSON.stringify(workflow, null, 2) + '\n');
console.log('Built self-contained workflow with five executable nodes.');
