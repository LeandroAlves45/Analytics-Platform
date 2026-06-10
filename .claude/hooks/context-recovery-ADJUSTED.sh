#!/bin/bash
# Re-injects critical project rules after context compaction.
# Used as a SessionStart hook with matcher "compact".
#
# When Claude's context window fills up, compaction summarises the conversation
# and loses specific details. This hook restores non-negotiable project rules
# so Claude stays aligned even after compaction.

find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ] || [ -d "$dir/.git" ]; then
      echo "$dir"
      return
    fi
    dir=$(dirname "$dir")
  done
  echo "$PWD"
}

ROOT=$(find_project_root)

CONTEXT=""
BRANCH=$(git branch --show-current 2>/dev/null)
[ -n "$BRANCH" ] && CONTEXT="Branch: $BRANCH"
LAST_COMMIT=$(git log --oneline -1 2>/dev/null)
[ -n "$LAST_COMMIT" ] && CONTEXT="$CONTEXT | Last commit: $LAST_COMMIT"
CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
[ "$CHANGES" -gt 0 ] 2>/dev/null && CONTEXT="$CONTEXT | Uncommitted changes: $CHANGES files"

cat <<'RULES'
=== CONTEXT RECOVERED AFTER COMPACTION ===

CRITICAL PROJECT RULES (Analytics SaaS Backend)
Stack: Node.js + TypeScript + Express + TimescaleDB + BullMQ + Redis + Drizzle

1. CLEAN ARCHITECTURE - MANDATORY
   Layer order: Domain -> Application -> Infrastructure -> Frameworks
   Domain: pure entities and business rules, zero external dependencies
   Application: use cases + contracts (interfaces) + DTOs
   Infra: controllers, repositories, gateways (Stripe, Slack)
   Frameworks: Express, Drizzle, BullMQ, Redis setup
   NEVER put business logic in controllers
   NEVER let use cases know about HTTP or database specifics
   Dependency rule: dependencies always point inward

2. MULTI-TENANT ISOLATION - CRITICAL
   Every query MUST filter by workspaceId
   NEVER expose one workspace's data to another
   workspaceId is extracted from JWT on every request
   If you see a query without workspaceId filter, STOP and fix it

3. DATABASE MIGRATIONS - NON-NEGOTIABLE
   Create migrations via: npm run db:generate
   Apply migrations via: npm run db:migrate
   NEVER edit existing migration files (they may be deployed)
   New feature = new migration file
   TimescaleDB hypertables: metrics_raw is time-series partitioned by timestamp

4. TESTING REQUIREMENTS
   TDD: write tests first, then implementation
   Coverage: entities 100%, use cases 100%, controllers 85%+
   Mock only at system boundaries (Stripe, Slack, Redis, BullMQ)
   Never test implementation details, test behaviour
   Run before marking done: npm run test

5. TYPE SAFETY
   Zero `any` types - use proper TypeScript always
   DTOs defined at use case boundaries
   Repositories return hydrated entities, never raw DB rows

6. BACKGROUND JOBS (BullMQ)
   All workers must be idempotent (safe to retry)
   Use dead letter queues for failed jobs
   Aggregation workers: 5min/1h/1d buckets
   Alert workers: evaluate rules, trigger notifications

7. CACHING (Redis)
   Pattern: Redis first -> cache miss -> DB -> set TTL
   Cache invalidation non-blocking (fire-and-forget)
   TTL defined centrally - no magic numbers
   Always include workspaceId in cache key

8. SECURITY
   All secrets in environment variables - never hardcoded
   Parameterized queries only (Drizzle handles this)
   JWT validated on every authenticated request
   Stripe keys always in env vars

9. INGEST ENDPOINT (high-volume: 10k req/s)
   Validate with Zod at API boundary
   Write to BullMQ queue, not directly to DB
   Response: 202 Accepted (async processing)

10. GIT WORKFLOW
    Feature branches only: feature/*, fix/*, chore/*
    Conventional commits: type(domain): description
    Tests must pass before commit

COMMANDS:
  npm run dev            # Start server
  npm run test           # Run tests
  npm run db:generate    # Create migration
  npm run db:migrate     # Apply migrations
  npm run typecheck      # Type check only
RULES

[ -n "$CONTEXT" ] && echo "" && echo "Current state: $CONTEXT"

if [ -f "$ROOT/.claude/CLAUDE.md" ]; then
  echo ""
  echo "=== CLAUDE.md (re-injected) ==="
  cat "$ROOT/.claude/CLAUDE.md"
elif [ -f "$ROOT/CLAUDE.md" ]; then
  echo ""
  echo "=== CLAUDE.md (re-injected) ==="
  cat "$ROOT/CLAUDE.md"
fi

echo ""
echo "=== END CONTEXT RECOVERY ==="
exit 0
