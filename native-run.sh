#!/bin/sh
set -eu

# Runs in the official n8n image with the synthetic fixture mounted read-only.
n8n --version > /output/n8n-version.txt
node --version > /output/node-version.txt
test "$(cat /output/n8n-version.txt)" = 2.38.7
n8n import:workflow --input=/work/rfq-to-quotation.n8n.json
n8n export:workflow --all --output=/output/imported-workflows.json
RFQ_WORKFLOW_ID=$(node -e 'const fs=require("fs");const workflows=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(workflows.length!==1)process.exit(1);console.log(workflows[0].id)' /output/imported-workflows.json)
# n8n emits --rawOutput through its info logger; warn suppresses that JSON.
N8N_LOG_LEVEL=info n8n execute --id="$RFQ_WORKFLOW_ID" --rawOutput > /output/native-execution.log 2>&1
