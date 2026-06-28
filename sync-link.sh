#!/bin/bash
# sync-link.sh (updated)
# Sincroniza skills E agents do .claude/ para .cursor/
# Uso: ./sync-link.sh [--dry-run]
#
# Sincroniza:
#   - .claude/skills → .cursor/skills
#   - .claude/agents → .cursor/agents
#
# O .claude/ é a fonte de verdade.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=0

for arg in "$@"; do
  [ "$arg" = "--dry-run" ] && DRY_RUN=1
done

# Função para sincronizar
sync_directory() {
  local type=$1
  local SRC="$SCRIPT_DIR/.claude/$type"
  local DST="$SCRIPT_DIR/.cursor/$type"
  
  if [ ! -d "$SRC" ]; then
    echo "⚠ Source not found: $SRC (skipping $type)" >&2
    return 0
  fi

  mkdir -p "$DST"

  local SYNCED=0
  local SKIPPED=0
  local ERRORS=0

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Syncing $type: $SRC → $DST"
  [ "$DRY_RUN" -eq 1 ] && echo "(dry-run mode — no changes written)"
  echo ""

  case $type in
    skills)
      # Sincronizar directories (skills)
      for item_dir in "$SRC"/*/; do
        item_name=$(basename "$item_dir")
        dst_item="$DST/$item_name"

        if [ -d "$dst_item" ]; then
          src_mtime=$(find "$item_dir" -newer "$dst_item/SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
          if [ "$src_mtime" -eq 0 ]; then
            echo "  [skip]  $item_name (up to date)"
            SKIPPED=$((SKIPPED + 1))
            continue
          fi
        fi

        if [ "$DRY_RUN" -eq 1 ]; then
          echo "  [sync]  $item_name"
          SYNCED=$((SYNCED + 1))
        else
          if cp -r "$item_dir" "$DST/" 2>/dev/null; then
            echo "  [sync]  $item_name"
            SYNCED=$((SYNCED + 1))
          else
            echo "  [fail]  $item_name" >&2
            ERRORS=$((ERRORS + 1))
          fi
        fi
      done
      ;;

    agents)
      # Sincronizar ficheiros (agents)
      for agent_file in "$SRC"/*.md; do
        [ -e "$agent_file" ] || continue
        
        agent_name=$(basename "$agent_file")
        dst_file="$DST/$agent_name"

        if [ -f "$dst_file" ]; then
          if [ "$agent_file" -ot "$dst_file" ]; then
            echo "  [skip]  $agent_name (up to date)"
            SKIPPED=$((SKIPPED + 1))
            continue
          fi
        fi

        if [ "$DRY_RUN" -eq 1 ]; then
          echo "  [sync]  $agent_name"
          SYNCED=$((SYNCED + 1))
        else
          if cp "$agent_file" "$DST/$agent_name" 2>/dev/null; then
            echo "  [sync]  $agent_name"
            SYNCED=$((SYNCED + 1))
          else
            echo "  [fail]  $agent_name" >&2
            ERRORS=$((ERRORS + 1))
          fi
        fi
      done
      ;;
  esac

  echo ""
  echo "Result: ${SYNCED} synced, ${SKIPPED} skipped, ${ERRORS} errors"
  
  [ "$ERRORS" -gt 0 ] && return 1
  return 0
}

# Executar sincronizações
TOTAL_ERRORS=0

sync_skills() {
  sync_directory "skills" || TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
}

sync_agents() {
  sync_directory "agents" || TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
}

# Sincronizar skills
sync_skills

# Sincronizar agents
sync_agents

# Informação sobre hooks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "ℹ Hook scripts in .claude/hooks/"
echo "  (not synced — cursor manages its own hooks)"

echo ""
echo "✓ Sync completed"

[ "$TOTAL_ERRORS" -gt 0 ] && exit 1
exit 0
