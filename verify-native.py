"""Validate a real n8n CLI execution and its generated XLSX, using stdlib."""
import argparse
import base64
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import io
import json
import os
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile

parser = argparse.ArgumentParser()
parser.add_argument('execution_log')
parser.add_argument('--n8n-version', required=True)
parser.add_argument('--node-version', required=True)
parser.add_argument('--case', choices=['usd', 'aed-rounding'], default='usd')
args = parser.parse_args()
root = Path(__file__).resolve().parent
raw = Path(args.execution_log).read_text(encoding='utf-8-sig')
decoder = json.JSONDecoder()
execution = None
for candidate in re.finditer(r'^\{', raw, re.MULTILINE):
    try:
        value, _ = decoder.raw_decode(raw[candidate.start():])
    except json.JSONDecodeError:
        continue
    if isinstance(value, dict) and 'data' in value and 'resultData' in value['data']:
        execution = value
        break
assert execution is not None, 'No native execution JSON found; inspect the CLI log'
assert execution.get('finished') is True, 'Execution did not finish'
assert execution.get('status') == 'success', 'Execution status is not success'
result = execution['data']['resultData']
assert not result.get('error'), result.get('error')
runs = result['runData']
names = ['Run demonstration', 'Load synthetic PDF', 'Extract PDF text',
         'Parse and match approved prices', 'Create Excel draft']
assert set(runs) == set(names), f'Unexpected executed nodes: {list(runs)}'
for name in names:
    assert len(runs[name]) == 1
    assert not runs[name][0].get('error')

def output(name):
    return runs[name][0]['data']['main'][0]

pdf_text = output(names[2])[0]['json']['text']
assert 'BEGIN RFQ ITEMS' in pdf_text and 'END RFQ ITEMS' in pdf_text
expected_path = 'sample/aed-rounding-result.json' if args.case == 'aed-rounding' else 'sample/result.json'
expected = json.loads((root / expected_path).read_text())
currency = expected['currency']
count = len(expected['rows'])
assert f'ITEM COUNT: {count}' in pdf_text
rows = [item['json'] for item in output(names[3])]
assert len(rows) == count
fields = {'Line': 'line', 'Code': 'code', 'Description': 'description',
          'Quantity': 'quantity', 'Unit': 'unit', f'Unit price {currency}': 'unitPrice',
          f'Amount {currency}': 'amount', 'Status': 'status', 'Review reason': 'issue'}
for row, want in zip(rows, expected['rows'], strict=True):
    for column, key in fields.items():
        assert row[column] == want[key], (row['Line'], column, row[column], want[key])
assert sum(Decimal(str(row[f'Amount {currency}'] or 0)) for row in rows) == Decimal(str(expected['pricedSubtotal']))
binary = output(names[4])[0]['binary']['data']
assert not binary.get('id'), 'Expected inline binary storage for this verification'
assert binary['fileName'] == ('quotation-native-aed.xlsx' if args.case == 'aed-rounding' else 'quotation-native-n8n.xlsx')
workbook = base64.b64decode(binary['data'], validate=True)
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with ZipFile(io.BytesIO(workbook)) as archive:
    assert archive.testzip() is None
    strings = []
    if 'xl/sharedStrings.xml' in archive.namelist():
        for element in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', ns):
            strings.append(''.join(element.itertext()))
    sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
    records = []
    for xml_row in sheet.findall('s:sheetData/s:row', ns):
        record = {}
        for cell in xml_row.findall('s:c', ns):
            column = re.match(r'[A-Z]+', cell.attrib['r'])[0]
            value_element = cell.find('s:v', ns)
            value = None if value_element is None else value_element.text
            kind = cell.attrib.get('t', 'n')
            if kind == 's':
                value = strings[int(value)]
            elif kind == 'inlineStr':
                value = ''.join(cell.find('s:is', ns).itertext())
            elif kind == 'n' and value is not None:
                value = float(value)
            record[column] = value
        records.append(record)
    assert len(records) == count + 1, 'XLSX row count mismatch'
    headers = records[0]
    for record, expected_row in zip(records[1:], rows, strict=True):
        actual = {label: record.get(column) for column, label in headers.items()}
        for column in fields:
            # Excel may omit empty strings; numeric exceptions must stay truly blank.
            want = expected_row[column]
            if want == '':
                assert actual.get(column) in ('', None)
            else:
                assert actual.get(column) == want, (column, actual.get(column), want)

(root / binary['fileName']).write_bytes(workbook)
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
run_url = None
if os.environ.get('GITHUB_ACTIONS') == 'true':
    run_url = f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
evidence = {
    'verifiedAtUtc': datetime.now(timezone.utc).isoformat(),
    'n8nVersion': args.n8n_version, 'nodeVersion': args.node_version,
    'executionStatus': execution['status'], 'nativeNodesExecuted': names,
    'sourceWorkflowSha256': digest(root / ('rfq-to-quotation-aed.n8n.json' if args.case == 'aed-rounding' else 'rfq-to-quotation.n8n.json')),
    'sourcePdfSha256': digest(root / 'sample' / expected['source']),
    'nativeWorkbookSha256': digest(root / binary['fileName']),
    'nativeWorkbookBytes': len(workbook), 'rows': count, 'matched': expected['matched'],
    'unpricedReviewRows': expected['needsReview'], 'currency': currency,
    'syntheticPricedSubtotal': expected['pricedSubtotal'],
    'roundingRule': 'Decimal half-up, quantity thousandths times integer minor units',
    'checks': ['Actual native PDF text extraction', f'All {count} row values match fixture',
               'Five native nodes completed', 'Generated XLSX ZIP integrity',
               f'All {count} XLSX rows match execution data', f'{expected["needsReview"]} review prices remain blank'],
    'runUrl': run_url,
    'limits': 'Synthetic supplied layout only; buyer documents and production hosting are untested. All prices are invented; no earnings are represented.'
}
(root / ('native-aed-evidence.json' if args.case == 'aed-rounding' else 'native-execution-evidence.json')).write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
print(json.dumps(evidence, indent=2))
