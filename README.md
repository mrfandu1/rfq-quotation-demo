# RFQ to quotation demonstration

An explicitly synthetic electrical-parts RFQ, deterministic matching code and Excel quotation draft. Created with AI assistance for a focused RFQ prototype proposal. This is a new demonstration, not a past client project.

## What is verified

- The supplied text-based PDF was generated and its actual text extracted with pypdf.
- All eight rows were parsed and reconciled against the fixture count.
- Two unambiguous, approved catalogue entries produce USD 102 and USD 47. The priced subtotal is USD 149.
- Six rows retain blank prices/amounts and explain why human review is needed: unknown code, duplicate catalogue code, unit mismatch, missing approved price, unapproved price and description mismatch.
- Matching regression checks pass, including zero prices, invalid quantities, malformed layouts, duplicate line numbers and currency mismatch.
- The formatted companion workbook was recalculated and visually checked. Its six unresolved rows are not represented as zero-price matches.

All prices and product records are invented. This is an incomplete quotation draft and requires human review. No customer data is included.

## n8n workflow

`rfq-to-quotation.n8n.json` is a self-contained workflow definition. It embeds the synthetic PDF and catalogue and needs no credentials, external API calls or local file paths.

Manual Trigger → Load synthetic PDF → Extract PDF text → Parse and match approved prices → Create Excel draft.

Import the JSON into n8n, run it manually and download the `data` binary output from the final node. The native XLSX output is a plain table. `quotation-demo.xlsx` is a separately formatted presentation example; the workflow does not reproduce that styling.

**The supplied synthetic workflow has been verified end to end in n8n 2.38.7.** The [native execution](https://github.com/mrfandu1/rfq-quotation-demo/actions/runs/34863146567) completed all five nodes, extracted the actual PDF text, and generated an Excel file whose eight rows match the fixture. The six review rows keep their prices and amounts blank. The runtime ran with external networking disabled.

Download the [native Excel output](quotation-native-n8n.xlsx), inspect the [execution evidence and checksums](native-execution-evidence.json), or get the [complete demonstration ZIP](rfq-demonstration.zip). This verifies the supplied layout and synthetic data; buyer documents and production hosting remain untested.

## Files

- `sample/sample-rfq.pdf`: invented input document.
- `sample/catalogue.json`: invented approved-price data, including deliberate exceptions.
- `sample/extracted-text.txt`: actual pypdf output.
- `sample/result.json`: expected matching results and subtotal.
- `matching.mjs`: parsing and matching source.
- `test-matching.mjs`: executable regression checks.
- `run-demo.mjs`: reproduce the JSON matching output.
- `make_fixture.py`: reproduce the PDF and catalogue (requires Python, reportlab and pypdf).
- `build-workflow.mjs`: reproduce the embedded workflow from the fixture and matching source.
- `quotation-demo.xlsx`: formatted Excel presentation sample.
- `quotation-native-n8n.xlsx`: plain-table Excel output from the verified native run.
- `native-execution-evidence.json`: runtime versions, fixture/output hashes, checks, and CI link.
- `verify-native.py`, `native-run.sh`: native verification and container execution scripts.
- `quotation-preview.png`, `catalogue-preview.png`, `rfq-preview.png`: visual evidence.

Run the dependency-free matching checks with Node.js:

```sh
node test-matching.mjs
node run-demo.mjs
```

## Deliberate scope limits

The parser accepts only the supplied text layout, its pipe-separated table and item-count marker, up to 100 rows. It stops on unsupported layouts/count mismatches. It is not a general-purpose PDF table extractor. No OCR, fuzzy substitutions, inferred prices, taxes, delivery charges, multiple currencies, ERP integration, email sending or dashboard is implemented.

Matching requires the exact normalized product code, unit and description, a unique catalogue entry, an approved numeric price and USD currency. Text normalization covers case and whitespace only. Matching is intentionally conservative.

Adapting to a buyer's real PDF layout and catalogue requires reviewing representative samples and agreeing the acceptance data before a paid test. Production hosting, authentication, upload limits and operational support would also need agreement.
