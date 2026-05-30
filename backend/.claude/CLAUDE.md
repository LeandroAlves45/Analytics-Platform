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

## WORKFLOW ORCHESTRATION

### 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or
  architectural decisions)
- If something goes sideways, STOP and re-plan immediately -
  don't keep pushing.
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagent liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-improvement Loop

- After ANY correction from the user: update 'task/lessons.md'
  with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on the lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don´t over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve then
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to 'tasks/todo.md' with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to 'tasks/todo.md'
6. **Capture Lessons**: Update 'tasks/lessons.md' adter corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact
  minimal code
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards
- **Minimal Impact**: Changes should only touch what's necessary. Avoid
  introducing bugs.
