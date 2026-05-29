# DEVELOPMENT_GUIDELINES.MD

## 1. Code Standards

### TypeScript

Sempre use type-safe code. Zero `any`.

```typescript
// ❌ BAD
const processMetric = (data: any) => {
  return data.latency > 500;
};

// ✅ GOOD
interface MetricInput {
  latency: number;
  statusCode: number;
}

const processMetric = (data: MetricInput): boolean => {
  return data.latency > 500;
};
```

### Function Size

Max 50 linhas. Se função > 50 linhas, quebre em funções menores.

```typescript
// ❌ BAD: 80 linhas
const evaluateAlert = async (rule: AlertRule) => {
  // 80 linhas aqui
};

// ✅ GOOD
const evaluateAlert = async (rule: AlertRule): Promise<boolean> => {
  const metrics = await getMetrics(rule.workspaceId);
  const anomaly = detectAnomaly(metrics, rule.threshold);
  return anomaly;
};

const getMetrics = async (workspaceId: string): Promise<Metric[]> => {
  // 20 linhas
};

const detectAnomaly = (metrics: Metric[], threshold: number): boolean => {
  // 15 linhas
};
```

### Function Parameters

Max 3 parâmetros. Se > 3, use object.

```typescript
// ❌ BAD
const createUser = (
  email: string,
  password: string,
  name: string,
  timezone: string,
  theme: string
) => {
  // ...
};

// ✅ GOOD
interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  timezone: string;
  theme: string;
}

const createUser = (input: CreateUserInput): Promise<User> => {
  // ...
};
```

### Error Handling

Sempre trate erros explicitly. Não ignore promises.

```typescript
// ❌ BAD
const fetchMetrics = () => {
  metricsRepository.getRecent(workspaceId, 60); // ignores promise
};

// ✅ GOOD
const fetchMetrics = async (): Promise<void> => {
  try {
    const metrics = await metricsRepository.getRecent(workspaceId, 60);
    return metrics;
  } catch (error) {
    logger.error('fetch_metrics_failed', { error });
    throw new AppError('Failed to fetch metrics', 500);
  }
};
```

### Naming Conventions

```typescript
// Variables & Functions: camelCase
const metricsCount = 100;
const calculatePercentile = (values: number[]): number => { };

// Classes: PascalCase
class MetricsRepository { }

// Constants: UPPER_SNAKE_CASE
const MAX_METRICS_PER_REQUEST = 1000;
const DEFAULT_TIMEOUT_MS = 5000;

// Database columns: snake_case
workspace_id, created_at, status_code

// API endpoints: kebab-case
GET /api/v1/metrics
POST /api/v1/alert-rules
```

### Comments

Escreve comentários explicando POR QUÊ, não O QUÊ.

```typescript
// ❌ BAD: comentário explica o quê, o código já faz isso
const latency = end - start; // Calculate latency

// ✅ GOOD: comentário explica razão técnica
// We subtract at the last possible moment to minimize the impact
// of GC pauses on latency measurement accuracy
const latency = end - start;
```

### Logging

Use Pino logger. Nunca `console.log`.

```typescript
// ❌ BAD
console.log('Metric received:', metric);
console.error('Error processing', error);

// ✅ GOOD
logger.debug('metric_received', { metric });
logger.error('metric_processing_failed', { error, metric_id: metric.id });
```

Logs estruturados:

```typescript
// ❌ BAD
logger.info('User created');

// ✅ GOOD
logger.info('user_created', {
  user_id: user.id,
  email: user.email,
  source: 'api',
  timestamp: new Date().toISOString()
});
```

---

## 2. Git Workflow

### Branch Naming

```
feat/metrics-ingestition
fix/alert-calculation-bug
refactor/repository-pattern
test/metrics-aggregation
docs/api-reference
chore/update-dependencies
```

### Commit Messages

Conventional Commits format:

```
feat(metrics): add percentile calculation
fix(alerts): resolve false positive triggers
refactor(database): optimize query performance
test(controllers): add integration tests for ingest endpoint
docs(architecture): update clean architecture guidelines
chore(deps): upgrade typescript to 5.0
```

Format: `type(scope): description`

- **type**: feat, fix, refactor, test, docs, chore, perf
- **scope**: feature area (metrics, alerts, auth, etc)
- **description**: 50 chars max, lowercase, no period

### Commit Size

Commits pequenos e focados. Uma feature = múltiplos commits.

```bash
# ✅ GOOD sequence
git commit -m "feat(metrics): create metric entity"
git commit -m "feat(metrics): implement record metric use case"
git commit -m "feat(metrics): add metrics controller"
git commit -m "test(metrics): add integration tests"

# ❌ BAD
git commit -m "feat(metrics): everything metrics related"
```

### Pull Requests

PR template:

```markdown
## Description
Brief explanation of what this PR does.

## Related Issues
Closes #123

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Refactoring
- [ ] Documentation

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed my own code
- [ ] Comments added for clarity
- [ ] Tests pass locally
- [ ] No new warnings generated
```

---

## 3. Testing Guidelines

### Test Structure

```typescript
describe('Feature/Component', () => {
  let component: Component;
  let dependency: jest.Mocked<Dependency>;
  
  beforeEach(() => {
    // Setup
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  describe('Specific behavior', () => {
    it('should do X when Y happens', () => {
      // Arrange
      const input = { /* ... */ };
      
      // Act
      const result = component.method(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### What to Test

Test behavior, not implementation:

```typescript
// ❌ BAD: Testing implementation detail
it('should call database.insert', () => {
  expect(database.insert).toHaveBeenCalled();
});

// ✅ GOOD: Testing behavior
it('should save metric and trigger aggregation', async () => {
  const result = await useCase.execute(input);
  expect(result.success).toBe(true);
});
```

### Coverage Targets

- Entities: 100%
- Use cases: 100%
- Controllers: 85%
- Repositories: 90%
- Services: 90%
- Utilities: 80%

---

## 4. Code Review Checklist

Reviewing others' code?

- [ ] Code follows conventions
- [ ] No hardcoded values
- [ ] No console.log or debugger
- [ ] Error handling present
- [ ] No N+1 queries
- [ ] Tests covering happy path and errors
- [ ] No unnecessary complexity
- [ ] Performance considerations addressed
- [ ] Type-safe (no `any`)
- [ ] Documentation updated if needed

---

## 5. Performance Considerations

### Database Queries

Always add indexes for frequently queried columns:

```typescript
// ❌ BAD: N+1 query
const metrics = await db.select().from(metricsTable);
for (const metric of metrics) {
  const workspace = await db.select().from(workspacesTable)
    .where(eq(workspacesTable.id, metric.workspace_id));
}

// ✅ GOOD: Join query
const metrics = await db
  .select()
  .from(metricsTable)
  .leftJoin(workspacesTable, eq(metricsTable.workspace_id, workspacesTable.id));
```

### Caching Strategy

```typescript
// Check cache first
const cacheKey = `metrics:${workspaceId}:24h`;
let data = await redis.get(cacheKey);

if (!data) {
  // Cache miss: query database
  data = await database.getMetrics(workspaceId);
  
  // Store in cache (5 minute TTL)
  await redis.setex(cacheKey, 300, JSON.stringify(data));
}

return data;
```

### Batch Operations

```typescript
// ❌ BAD: N queries
for (const metric of metrics) {
  await db.insert(metricsTable).values(metric);
}

// ✅ GOOD: 1 query
await db.insert(metricsTable).values(metrics);
```

---

## 6. Security Practices

### API Keys

Never log or expose API keys:

```typescript
// ❌ BAD
logger.info('api_key', { key: apiKey });

// ✅ GOOD
logger.info('api_key_used', { key_preview: apiKey.slice(-4) });
```

### Database Queries

Always use parameterized queries (Drizzle handles this):

```typescript
// ✅ GOOD: Drizzle parameterizes automatically
const user = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, userInput.email));

// Never do this:
// const user = await db.raw(`SELECT * FROM users WHERE email = '${userInput.email}'`);
```

### Environment Variables

Never hardcode secrets:

```typescript
// ✅ GOOD: Load from env
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  throw new Error('STRIPE_SECRET_KEY not configured');
}
```

---

## 7. Documentation

### Code Comments

Document why, not what:

```typescript
// ✅ GOOD
// We delay the aggregation by 30 seconds to batch metrics together
// and reduce database writes from 60/min to 1/min
const AGGREGATION_DELAY_MS = 30000;

// ❌ BAD
// Delay for 30 seconds
const AGGREGATION_DELAY_MS = 30000;
```

### Function Documentation

```typescript
/**
 * Calculate latency percentiles from raw metrics.
 * 
 * @param metrics - Array of latency values in milliseconds
 * @param percentiles - Array of percentile values (0-100)
 * @returns Object with calculated percentiles
 * 
 * @example
 * const result = calculatePercentiles([100, 200, 300], [50, 95, 99]);
 * // result: { p50: 150, p95: 290, p99: 299 }
 */
export const calculatePercentiles = (
  metrics: number[],
  percentiles: number[]
): Record<string, number> => {
  // ...
};
```

---

## 8. Debugging

### Local Debugging

Use VSCode debugger:

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug",
      "program": "${workspaceFolder}/src/main.ts",
      "preLaunchTask": "tsc: build"
    }
  ]
}
```

Set breakpoints and press F5.

### Database Debugging

```typescript
// Enable query logging
const db = drizzle(connection, { logger: true });

// Run specific query
db.select().from(metricsTable)
  .where(eq(metricsTable.id, 'test-id'));
```

---

## 9. Performance Profiling

### Logging Performance

```typescript
const startTime = performance.now();
await someAsyncOperation();
const duration = performance.now() - startTime;

logger.info('operation_completed', { duration_ms: duration });
```

### Monitoring Key Metrics

Track in dashboard:

- Request latency (p50, p95, p99)
- Database query time
- Worker processing time
- Cache hit rate
- Error rate

---

## 10. Daily Workflow

### Morning

1. Check failed tests/builds
2. Review blocked PRs
3. Standup (15 min)

### During Sprint

1. Pick task from sprint board
2. Create feature branch
3. Implement feature
4. Write/update tests
5. Run linter and tests locally
6. Push and create PR
7. Address review comments
8. Merge when approved

### Evening

1. Update ticket status
2. Prepare for tomorrow
3. Document blockers

---

## Common Commands

```bash
# Development
npm run dev                # Start dev server
npm run lint              # Run ESLint
npm run lint:fix          # Fix ESLint issues
npm run type-check        # TypeScript check
npm run test              # Run tests
npm run test:watch        # Watch mode
npm run format            # Prettier formatting

# Database
npm run db:generate       # Generate Drizzle migrations
npm run db:migrate        # Run migrations
npm run db:studio         # Open Drizzle Studio

# Git
git commit -m "feat(scope): description"  # Commit
git push origin feat/name                 # Push
```

Last Updated: January 2025
