#!/bin/bash
# Re-injects critical project rules after context compaction.
# Used as a SessionStart hook with matcher "compact".
# ADJUSTED FOR PT MANAGER
#
# When Claude's context window fills up, compaction summarizes the conversation
# and loses specific details. This hook restores your non-negotiable project
# rules so Claude stays aligned even after compaction.

# ──────────────────────────────────────────────
# Find project root
# ──────────────────────────────────────────────

find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ] || [ -f "$dir/pyproject.toml" ] || [ -f "$dir/Cargo.toml" ] || [ -f "$dir/go.mod" ] || [ -d "$dir/.git" ]; then
      echo "$dir"
      return
    fi
    dir=$(dirname "$dir")
  done
  echo "$PWD"
}

ROOT=$(find_project_root)

# ──────────────────────────────────────────────
# Dynamic context (same as session-start.sh)
# ──────────────────────────────────────────────

CONTEXT=""

BRANCH=$(git branch --show-current 2>/dev/null)
if [ -n "$BRANCH" ]; then
  CONTEXT="Branch: $BRANCH"
fi

LAST_COMMIT=$(git log --oneline -1 2>/dev/null)
if [ -n "$LAST_COMMIT" ]; then
  CONTEXT="$CONTEXT | Last commit: $LAST_COMMIT"
fi

CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHANGES" -gt 0 ] 2>/dev/null; then
  CONTEXT="$CONTEXT | Uncommitted changes: $CHANGES files"
fi

# ──────────────────────────────────────────────
# Re-inject critical project rules (PT MANAGER)
# ──────────────────────────────────────────────

cat <<'RULES'
=== CONTEXT RECOVERED AFTER COMPACTION ===

CRITICAL PROJECT RULES (PT Manager SaaS v1.7):

1. CLEAN ARCHITECTURE - MANDATORY
   Domain layer: pure business logic (entities, value objects)
   Application layer: use cases, DTOs, mappers
   Infrastructure: repositories, Stripe, email, database
   NEVER bypass layers via direct DB queries from controllers
   Respect tenant isolation in all queries
   Business rules = framework-independent

2. MULTI-TENANT ISOLATION - CRITICAL
   All queries MUST filter by trainer_id (tenant)
   NEVER expose other trainers' data
   Client requests: extract trainer_id from JWT owner_trainer_id
   Test isolation: use separate test trainers per test
   If you see a query without trainer_id filter, STOP and fix it

3. DATABASE MIGRATIONS - NON-NEGOTIABLE
   Create migrations via python app/db/migrate.py
   NEVER edit existing migrations (already deployed to prod)
   New feature → new timestamped migration file in app/db/migrations/
   Always test UP and DOWN directions before commit
   Run with: python initdb, migrate_runner, app/db/migrate.py

4. TESTING REQUIREMENTS
   Run specific test file after changes (not full suite)
   Verify behavior, not implementation details
   One assertion per test. Arrange-Act-Assert structure
   Mock ONLY at system boundaries (Stripe, email, random, time)
   If test is flaky: fix or delete, never retry
   Prefer real implementations over mocks

5. CODE QUALITY STANDARDS
   No dead code or commented blocks (git has history)
   Don't add features beyond what was asked
   Naming: PascalCase components, kebab-case utils
   WHY comments, not WHAT comments
   Named exports over default exports
   One class/component per file

6. SECURITY REQUIREMENTS
   Validate ALL user input at API boundary (never trust input)
   Parameterized queries ONLY (never concatenate user input into SQL)
   JWT tokens: extract and validate on every request
   Never log credentials, tokens, or PII
   Stripe keys: ALWAYS in environment variables
   Connection strings: ALWAYS in env vars, never hardcoded
   CORS: whitelist specific origins, never allow *

7. EMAIL NOTIFICATIONS
   Use trainer.email from users table (NOT TRAINER_EMAIL env var)
   Log gracefully if trainer has no email registered
   Test email logic WITHOUT actually sending (mock Stripe, email)
   All trainer-directed emails use trainer.email
   Client emails use client.email

8. STRIPE INTEGRATION
   All Stripe keys in environment variables
   Test keys (sk_test_*) OK in development
   LIVE keys (sk_live_*) NEVER in code
   Handle Stripe webhooks securely
   Retry logic for transient failures
   Log Stripe events for audit trail

9. GIT WORKFLOW - PROTECTED
   Never push directly to main/master/production
   Create feature branches (feature/*, fix/*, chore/*)
   All work requires a PR and code review
   Test suite must pass before merge
   No force push (use --force-with-lease if necessary)
   Commit message: type(domain): description
   Examples: feat(nutrition): add macro editor, fix(auth): JWT validation

10. COMMIT DISCIPLINE
   Type: feat, fix, refactor, test, docs, chore
   Format: type(domain): brief description
   Examples:
     - feat(nutrition): implement calculator to builder flow
     - fix(auth): validate JWT on every request
     - test(training): add progress chart tests
     - refactor(domain): rename Trainer entity

RULES

# ──────────────────────────────────────────────
# Append dynamic context
# ──────────────────────────────────────────────

if [ -n "$CONTEXT" ]; then
  echo ""
  echo "Current state: $CONTEXT"
fi

# ──────────────────────────────────────────────
# Re-read CLAUDE.md if it exists (belt and suspenders)
# ──────────────────────────────────────────────

if [ -f "$ROOT/CLAUDE.md" ]; then
  echo ""
  echo "=== CLAUDE.md (re-injected) ==="
  cat "$ROOT/CLAUDE.md"
fi

echo ""
echo "=== END CONTEXT RECOVERY ==="

exit 0
