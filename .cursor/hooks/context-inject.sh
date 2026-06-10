#!/bin/bash
# context-inject.sh - Fetch context from claude-mem and write to Cursor rules file
# Triggered by: beforeSubmitPrompt (runs after session-init.sh)

source "$(dirname "$0")/common.sh"

check_dependencies || { echo '{"continue": true}'; exit 0; }

INPUT=$(read_json_input)

WORKSPACE_ROOT=$(json_get "$INPUT" '.workspace_roots[0]')
[ -z "$WORKSPACE_ROOT" ] && WORKSPACE_ROOT="$PWD"

# Normalise path for Linux/Mac (bash runs in WSL or Git Bash on Windows)
WORKSPACE_ROOT_NORM="${WORKSPACE_ROOT//\\//}"

PROJECT=$(get_project_name "$WORKSPACE_ROOT")
PROJECT_ENCODED=$(url_encode "$PROJECT")

PORT=$(get_worker_port)

ensure_worker_running "$PORT" || { echo '{"continue": true}'; exit 0; }

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
*Updated before this session. Do not edit manually — this file is auto-generated.*
RULEFILE
fi

echo '{"continue": true}'
exit 0
