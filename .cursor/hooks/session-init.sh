#!/bin/bash
# session-init.sh - Initialise claude-mem session on prompt submission
# Triggered by: beforeSubmitPrompt

source "$(dirname "$0")/common.sh"

check_dependencies || exit 0

INPUT=$(read_json_input)

SESSION_ID=$(json_get "$INPUT" '.conversation_id')
[ -z "$SESSION_ID" ] && SESSION_ID=$(json_get "$INPUT" '.generation_id')
[ -z "$SESSION_ID" ] && exit 0

WORKSPACE_ROOT=$(json_get "$INPUT" '.workspace_roots[0]')
[ -z "$WORKSPACE_ROOT" ] && WORKSPACE_ROOT="$PWD"

PROJECT=$(get_project_name "$WORKSPACE_ROOT")

PROMPT=$(json_get "$INPUT" '.prompt' '')
# Strip leading slash if present (parity with claude-mem's hook)
PROMPT="${PROMPT#/}"

PORT=$(get_worker_port)

ensure_worker_running "$PORT" || exit 0

PAYLOAD=$(jq -n \
  --arg sessionId "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg workspacePath "$WORKSPACE_ROOT" \
  --arg prompt "$PROMPT" \
  '{
    contentSessionId: $sessionId,
    agentType: "cursor",
    project: $project,
    workspacePath: $workspacePath,
    initialPrompt: $prompt
  }')

curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "http://127.0.0.1:${PORT}/api/sessions/init" &>/dev/null

exit 0
