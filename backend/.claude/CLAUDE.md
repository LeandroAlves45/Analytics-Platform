# Analytics SaaS Backend

Node.js + TypeScript + Express + TimescaleDB + BullMQ.
MVP: Ingestão → Aggregation → Dashboard → Alerting → Billing.

## GOLDEN RULES

- Architecture: Domain → Application → Infrastructure
- Multi-tenant: EVERY query filters by workspaceId
- Type Safety: Zero `any` type
- Security: Secrets in env vars, parameterized queries
- Testing: TDD; coverage: entities 100%, use cases 100%, controllers 85%+
- Git: Feature branches, conventional commits, tests PASS
- NO edits: migrations (create new), .env, hardcoded values

## COMMANDS

npm run dev # Start server
npm run test # Run tests
npm run db:generate # Create migration
npm run db:migrate # Apply migrations

## PATTERNS

1. New feature: Entity → Use Case → Repository → Controller → Tests
2. Multi-tenant: Filter by workspaceId in repositories
3. Background jobs: BullMQ (idempotent operations)
4. Caching: Redis first → miss → DB → set TTL

## AVOID

❌ Queries sem workspaceId ❌ Logic em controllers ❌ Hardcoded values
❌ Edit migrations ❌ console.log ❌ Testing implementation

## DOCS

- Architecture: docs/project/ARCHITECTURE.md
- Code standards: docs/project/DEVELOPMENT_GUIDELINES.md
- Schema: docs/project/DATABASE_SCHEMA.md
