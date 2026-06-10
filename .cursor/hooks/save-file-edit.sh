#!/bin/bash
# save-file-edit.sh - Capture file edits as observations
# Triggered by: afterFileEdit

source "$(dirname "$0")/common.sh"

check_dependencies || exit 0

INPUT=$(read_json_input)

SESSION_ID=$(json_get "$INPUT" '.conversation_id')
[ -z "$SESSION_ID" ] && exit 0

FILE_PATH=$(json_get "$INPUT" '.file_path' '')
[ -z "$FILE_PATH" ] && exit 0

EDITS_RAW=$(json_get "$INPUT" '.edits' '[]')
if ! echo "$EDITS_RAW" | jq . &>/dev/null; then
  EDITS_RAW="[]"
fi

EDITS_COUNT=$(echo "$EDITS_RAW" | jq 'length' 2>/dev/null || echo 0)
[ "$EDITS_COUNT" -eq 0 ] && exit 0

# Build a short summary of the edit
SUMMARY="Edited ${FILE_PATH} (${EDITS_COUNT} change(s))"

TOOL_INPUT=$(jq -n \
  --arg filePath "$FILE_PATH" \
  --argjson edits "$EDITS_RAW" \
  --arg summary "$SUMMARY" \
  '{"file_path": $filePath, "edits": $edits, "summary": $summary}')

PORT=$(get_worker_port)
ensure_worker_running "$PORT" || exit 0

PAYLOAD=$(jq -n \
  --arg sessionId "$SESSION_ID" \
  --argjson toolInput "$TOOL_INPUT" \
  '{
    contentSessionId: $sessionId,
    toolName: "write_file",
    toolInput: $toolInput,
    toolResponse: {}
  }')

curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "http://127.0.0.1:${PORT}/api/sessions/observations" &>/dev/null &

exit 0
