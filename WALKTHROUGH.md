# Two-minute walkthrough

This uses invented data and a deliberately supported text-PDF layout. No buyer documents or paid client implementation are involved.

1. Import `rfq-to-quotation-aed.n8n.json` into n8n 2.38.7 and keep it inactive. The workflow embeds [this four-row PDF](sample/aed-rounding-rfq.pdf) and [this catalogue](sample/aed-rounding-catalogue.json); no credentials or paid API are needed.
2. Run the manual trigger. The workflow loads the PDF, extracts its real text, checks the item-count/table boundaries, and matches each row against a unique approved catalogue entry with the same code, description, unit and currency.
3. Open **Parse and match approved prices**. Quantity is represented in thousandths and price in integer minor units for multiplication. The result rounds half up to two decimal places before becoming an Excel number. The AED output must be:

| Quantity | Approved unit price | Catalogue currency | AED line amount | Result |
| --- | --- | --- | --- | --- |
| 0.145 | 1.00 | AED | 0.15 | MATCHED |
| 0.005 | 1.00 | AED | 0.01 | MATCHED |
| 0.144 | 1.00 | AED | 0.14 | MATCHED |
| 1 | 1.00 | USD | blank | REVIEW: Currency mismatch |

4. Open **Create Excel draft** and download its `data` binary. The three priced rows total AED 0.30. The USD catalogue entry remains unpriced; the workflow does not convert currencies. The workbook is an incomplete quotation draft until exceptions are resolved and a person reviews it.
5. For the original USD demonstration, import `rfq-to-quotation.n8n.json` instead. Its eight rows remain two priced matches totaling USD 149 and six unpriced review rows. Both workflows use the same corrected matching source.

Run the code regression checks locally with `node test-matching.mjs`. The AED expected fixture was calculated independently with Python `Decimal` and `ROUND_HALF_UP`. The native verification workflow separately checks actual PDF extraction, the values produced by the Code node, and every row in the generated XLSX.

AED support means one AED quotation using approved AED catalogue prices. Foreign exchange, taxes/VAT, mixed-currency quotations, scans/OCR and new PDF layouts are outside this demonstration. A real pilot still needs agreed sample documents, an unseen acceptance PDF, and review/support arrangements.
