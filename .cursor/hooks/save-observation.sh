#!/bin/bash
# save-observation.sh - Capture MCP tool usage and shell commands as observations
# Triggered by: afterMCPExecution, afterShellExecution

source "$(dirname "$0")/common.sh"

check_dependencies || exit 0

INPUT=$(read_json_input)

SESSION_ID=$(json_get "$INPUT" '.conversation_id')
[ -z "$SESSION_ID" ] && exit 0

HOOK_EVENT=$(json_get "$INPUT" '.hook_event_name' '')
TOOL_NAME=$(json_get "$INPUT" '.tool_name' '')

# For shell execution, tool name is "Bash"
if [ "$HOOK_EVENT" = "afterShellExecution" ]; then
  TOOL_NAME="Bash"
  COMMAND=$(json_get "$INPUT" '.command' '')
  TOOL_INPUT=$(jq -n --arg cmd "$COMMAND" '{"command": $cmd}')
  TOOL_RESPONSE="{}"
else
  [ -z "$TOOL_NAME" ] && exit 0
  TOOL_INPUT_RAW=$(json_get "$INPUT" '.tool_input' '{}')
  TOOL_RESPONSE_RAW=$(json_get "$INPUT" '.result_json' '{}')

  # Validate JSON or default to {}
  if echo "$TOOL_INPUT_RAW" | jq . &>/dev/null; then
    TOOL_INPUT="$TOOL_INPUT_RAW"
  else
    TOOL_INPUT="{}"
  fi

  if echo "$TOOL_RESPONSE_RAW" | jq . &>/dev/null; then
    TOOL_RESPONSE="$TOOL_RESPONSE_RAW"
  else
    TOOL_RESPONSE="{}"
  fi
fi

PORT=$(get_worker_port)
ensure_worker_running "$PORT" || exit 0

PAYLOAD=$(jq -n \
  --arg sessionId "$SESSION_ID" \
  --arg toolName "$TOOL_NAME" \
  --argjson toolInput "$TOOL_INPUT" \
  --argjson toolResponse "$TOOL_RESPONSE" \
  '{
    contentSessionId: $sessionId,
    toolName: $toolName,
    toolInput: $toolInput,
    toolResponse: $toolResponse
  }')

# Fire and forget — never block Cursor
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "http://127.0.0.1:${PORT}/api/sessions/observations" &>/dev/null &

exit 0
