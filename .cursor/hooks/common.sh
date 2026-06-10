#!/bin/bash
# common.sh - Shared utilities for claude-mem cursor hooks
# Source this file in other hook scripts: source "$(dirname "$0")/common.sh"

# Check required dependencies
check_dependencies() {
  local missing=0
  for cmd in jq curl; do
    if ! command -v "$cmd" &>/dev/null; then
      echo "Warning: $cmd not found - claude-mem hooks will not function" >&2
      missing=1
    fi
  done
  return $missing
}

# Read JSON from stdin safely
read_json_input() {
  local input
  input=$(cat 2>/dev/null)
  if [ -z "$input" ]; then
    echo "{}"
    return
  fi
  if ! echo "$input" | jq . &>/dev/null; then
    echo "{}"
    return
  fi
  echo "$input"
}

# Get worker port from settings
get_worker_port() {
  local settings_file="$HOME/.claude-mem/settings.json"
  local port=37777
  if [ -f "$settings_file" ]; then
    local configured_port
    configured_port=$(jq -r '.CLAUDE_MEM_WORKER_PORT // empty' "$settings_file" 2>/dev/null)
    if [ -n "$configured_port" ] && [ "$configured_port" -ge 1 ] && [ "$configured_port" -le 65535 ] 2>/dev/null; then
      port=$configured_port
    fi
  fi
  echo "$port"
}

# Ensure worker is running (polls readiness endpoint)
ensure_worker_running() {
  local port="${1:-37777}"
  local retries=30
  local interval=0.2
  local i=0
  while [ $i -lt $retries ]; do
    if curl -s --max-time 1 "http://127.0.0.1:${port}/api/readiness" &>/dev/null; then
      return 0
    fi
    sleep $interval
    i=$((i + 1))
  done
  return 1
}

# URL encode a string
url_encode() {
  local string="$1"
  if command -v jq &>/dev/null; then
    local encoded
    encoded=$(printf '%s' "$string" | jq -sRr @uri 2>/dev/null)
    if [ -n "$encoded" ]; then
      echo "$encoded"
      return
    fi
  fi
  echo "$string"
}

# Get project name from workspace root
get_project_name() {
  local workspace_root="${1:-$PWD}"
  # Strip Windows drive prefix if present (C:\, D:\, etc.)
  workspace_root="${workspace_root#*:}"
  # Normalise backslashes
  workspace_root="${workspace_root//\\//}"
  # Remove trailing slash
  workspace_root="${workspace_root%/}"
  # Return basename
  basename "$workspace_root" 2>/dev/null || echo "unknown"
}

# Safely extract a JSON field
json_get() {
  local json="$1"
  local field="$2"
  local default="${3:-}"
  local value
  value=$(echo "$json" | jq -r "$field // empty" 2>/dev/null)
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    echo "$default"
  else
    echo "$value"
  fi
}

# Check if a value is empty or null
is_empty() {
  local value="$1"
  [ -z "$value" ] || [ "$value" = "null" ]
}
