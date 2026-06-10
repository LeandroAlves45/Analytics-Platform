#!/bin/bash
# sync-skills.sh
# Sincroniza skills do .claude/skills para .cursor/skills
# Uso: ./sync-skills.sh [--dry-run]
#
# O .claude/skills é a fonte de verdade.
# O .cursor/skills recebe cópias actualizadas.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/.claude/skills"
DST="$SCRIPT_DIR/.cursor/skills"
DRY_RUN=0

for arg in "$@"; do
  [ "$arg" = "--dry-run" ] && DRY_RUN=1
done

if [ ! -d "$SRC" ]; then
  echo "Error: source directory not found: $SRC" >&2
  exit 1
fi

mkdir -p "$DST"

SYNCED=0
SKIPPED=0
ERRORS=0

echo "Syncing: $SRC -> $DST"
[ "$DRY_RUN" -eq 1 ] && echo "(dry-run mode — no changes written)"
echo ""

for skill_dir in "$SRC"/*/; do
  skill_name=$(basename "$skill_dir")
  dst_skill="$DST/$skill_name"

  # Check if destination is newer (skip if up to date)
  if [ -d "$dst_skill" ]; then
    src_mtime=$(find "$skill_dir" -newer "$dst_skill/SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [ "$src_mtime" -eq 0 ]; then
      echo "  [skip]  $skill_name (up to date)"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  [sync]  $skill_name"
    SYNCED=$((SYNCED + 1))
  else
    if cp -r "$skill_dir" "$DST/" 2>/dev/null; then
      echo "  [sync]  $skill_name"
      SYNCED=$((SYNCED + 1))
    else
      echo "  [fail]  $skill_name" >&2
      ERRORS=$((ERRORS + 1))
    fi
  fi
done

# Sync hooks that should also live in .cursor (non-claude-mem hooks)
# The claude-mem hooks in .cursor/hooks/ are managed separately
HOOKS_SRC="$SCRIPT_DIR/.claude/hooks"
if [ -d "$HOOKS_SRC" ]; then
  echo ""
  echo "Hook scripts in .claude/hooks/ (not synced to .cursor — cursor uses its own hooks)"
fi

echo ""
echo "Done: ${SYNCED} synced, ${SKIPPED} skipped, ${ERRORS} errors"
[ "$ERRORS" -gt 0 ] && exit 1
exit 0
