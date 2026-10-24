#!/usr/bin/env bash
set -o pipefail

if [ -z "${OPENHANDS_API_KEY:-}" ]; then
  echo 'OPENHANDS_API_KEY is missing' >&2
  exit 2
fi

payload='{
  "initial_message": {
    "content": [
      {
        "type": "text",
        "text": "Read-only bounded task: inspect the highfive251677-wq/ember-lite repository structure and identify the next single spec or test file that should be reviewed. Do not edit files, create commits, open pull requests, deploy, or access secrets. Return only the proposed file path and a one-sentence reason."
      }
    ]
  },
  "selected_repository": "highfive251677-wq/ember-lite"
}'

curl -sS --max-time 90 \
  -X POST 'https://app.openhands.dev/api/v1/app-conversations' \
  -H "Authorization: Bearer ${OPENHANDS_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d "$payload" \
  -w '\nHTTP_STATUS:%{http_code}\n' \
  | sed -E 's/(OPENHANDS_API_KEY|Bearer)[^,}" ]*/\1 [REDACTED]/g'
