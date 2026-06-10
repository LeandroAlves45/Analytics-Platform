#!/bin/bash
# session-summary.sh - Generate session summary when agent loop ends
# Triggered by: stop

source "$(dirname "$0")/common.sh"

check_dependencies || { echo '{}'; exit 0; }

INPUT=$(read_json_input)

SESSION_ID=$(json_get "$INPUT" '.conversation_id')
[ -z "$SESSION_ID" ] && { echo '{}'; exit 0; }

WORKSPACE_ROOT=$(json_get "$INPUT" '.workspace_roots[0]')
[ -z "$WORKSPACE_ROOT" ] && WORKSPACE_ROOT="$PWD"
WORKSPACE_ROOT_NORM="${WORKSPACE_ROOT//\\//}"

PROJECT=$(get_project_name "$WORKSPACE_ROOT")
PROJECT_ENCODED=$(url_encode "$PROJECT")

PORT=$(get_worker_port)
ensure_worker_running "$PORT" || { echo '{}'; exit 0; }

# Generate summary (worker uses stored observations)
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"contentSessionId\": \"${SESSION_ID}\", \"messages\": []}" \
  "http://127.0.0.1:${PORT}/api/sessions/summarize" &>/dev/null

# Update context file for next session
CONTEXT=$(curl -s --max-time 5 \
  "http://127.0.0.1:${PORT}/api/context/inject?project=${PROJECT_ENCODED}" 2>/dev/null)

if [ -n "$CONTEXT" ] && [ "$CONTEXT" != "null" ]; then
  RULES_DIR="${WORKSPACE_ROOT_NORM}/.cursor/rules"
  mkdir -p "$RULES_DIR" 2>/dev/null

  cat > "${RULES_DIR}/claude-mem-context.mdc" << RULEFILE
---
alwaysApply: true
description: "claude-mem context from past sessions (auto-updated)"
---

# Memory Context from Past Sessions

${CONTEXT}

---
*Updated at end of session. Do not edit manually.*
RULEFILE
fi

# Cursor stop hook requires valid JSON output
echo '{}'
exit 0
