"""Generate an explicitly synthetic, text-based electrical-parts RFQ."""
import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.colors import HexColor
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'sample'
OUT.mkdir(exist_ok=True)
rows = [
    (1, 'MCB-016', 'MCB 16A single pole', '12', 'EA'),
    (2, 'TRM-004', 'Terminal block 4 mm2', '20', 'EA'),
    (3, 'UNK-999', 'Unlisted accessory', '4', 'EA'),
    (4, 'CNT-025', 'Contactor 25A', '2', 'EA'),
    (5, 'CBL-025', 'Cable 2.5 mm2', '10', 'EA'),
    (6, 'DIN-035', 'DIN rail 35 mm', '8', 'M'),
    (7, 'RLY-024', 'Relay 24V DC', '3', 'EA'),
    (8, 'MCB-032', 'MCB 32A three pole', '2', 'EA'),
]
catalogue = [
    dict(code='MCB-016', description='MCB 16A single pole', unit='EA', price='8.50', currency='USD', approved=True),
    dict(code='TRM-004', description='Terminal block 4 mm2', unit='EA', price='2.35', currency='USD', approved=True),
    dict(code='CNT-025', description='Contactor 25A', unit='EA', price='30.00', currency='USD', approved=True),
    dict(code='CNT-025', description='Contactor 25A', unit='EA', price='32.00', currency='USD', approved=True),
    dict(code='CBL-025', description='Cable 2.5 mm2', unit='M', price='0.90', currency='USD', approved=True),
    dict(code='DIN-035', description='DIN rail 35 mm', unit='M', price=None, currency='USD', approved=True),
    dict(code='RLY-024', description='Relay 24V DC', unit='EA', price='4.60', currency='USD', approved=False),
    dict(code='MCB-032', description='MCB 32A single pole', unit='EA', price='12.00', currency='USD', approved=True),
]
(OUT / 'catalogue.json').write_text(json.dumps(catalogue, indent=2), encoding='utf-8')
pdf = OUT / 'sample-rfq.pdf'
c = canvas.Canvas(str(pdf), pagesize=landscape(A4))
c.setTitle('Synthetic electrical-parts RFQ - RFQ-DEMO-001')
c.setAuthor('')
c.setFillColor(HexColor('#17324D'))
c.setFont('Helvetica-Bold', 25)
c.drawString(44, 530, 'Request for quotation')
c.setFont('Helvetica', 11)
c.drawString(44, 505, 'RFQ-DEMO-001   |   Synthetic electrical-parts sample   |   13 September 2026')
c.setFillColor(HexColor('#42566B'))
c.drawString(44, 477, 'Please quote the following items. Do not substitute products without approval.')
lines = ['BEGIN RFQ ITEMS', 'Item | Product code | Description | Quantity | Unit']
lines += [f'{n:02d} | {code} | {description} | {qty} | {unit}' for n, code, description, qty, unit in rows]
lines += ['END RFQ ITEMS', 'ITEM COUNT: 8']
c.setFont('Courier', 11)
for i, line in enumerate(lines):
    y = 440 - i * 23
    if i == 1:
        c.setFillColor(HexColor('#EAF0F5'))
        c.rect(38, y - 6, 765, 23, fill=1, stroke=0)
    c.setFillColor(HexColor('#17324D'))
    c.drawString(44, y, line)
c.setFont('Helvetica', 10)
c.setFillColor(HexColor('#64748B'))
c.drawString(44, 96, 'All product records and prices in the companion catalogue are invented for demonstration.')
c.drawString(44, 78, 'This PDF contains selectable text. Scanned documents and alternate layouts are outside this demo.')
c.save()
text = '\n'.join(page.extract_text() or '' for page in PdfReader(str(pdf)).pages)
(OUT / 'extracted-text.txt').write_text(text, encoding='utf-8')
print(f'Generated {pdf}; extracted {len(text)} characters')
