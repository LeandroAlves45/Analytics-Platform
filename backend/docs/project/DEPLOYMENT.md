# DEPLOYMENT.MD

## Deployment Guide

Procedures for deploying Analytics SaaS to production environments.

---

## Pre-Deployment Checklist

Before any deployment:

- [ ] All tests passing locally
- [ ] All tests passing in CI
- [ ] Code reviewed and approved
- [ ] No TypeScript errors
- [ ] ESLint passes
- [ ] Migration tested locally
- [ ] Database backup recent
- [ ] Monitoring configured
- [ ] Alerts configured

---

## Environments

### Development

**URL**: http://localhost:3000  
**Database**: Local PostgreSQL  
**Redis**: Local Redis  
**Purpose**: Local development

Setup:
```bash
npm run dev
docker-compose up  # postgres + redis
```

---

### Staging

**URL**: https://staging-analytics.example.com  
**Database**: Staging PostgreSQL (Supabase/Neon)  
**Redis**: Staging Redis  
**Purpose**: Pre-production testing

Accessible to: Team only  
Data: Mirrors production (anonymized)

---

### Production

**URL**: https://analytics.example.com  
**Database**: Production PostgreSQL (managed)  
**Redis**: Production Redis  
**Purpose**: Live user traffic

SLA: 99.5% uptime  
Data: Real customer data (encrypted)

---

## Deployment Architecture

```
GitHub Push
    |
    v
GitHub Actions (CI)
    |
    +-- Lint & Type Check
    +-- Run Tests
    +-- Build
    |
    v
Build Artifacts (Docker image)
    |
    v
Docker Registry (e.g., ghcr.io)
    |
    v
Deploy to Staging
    +-- Health Check
    +-- Run Migrations
    +-- Smoke Tests
    |
    v
Deploy to Production
    +-- Blue-Green Deployment
    +-- Health Check
    +-- Run Migrations
    +-- Monitor Error Rate
```

---

## GitHub Actions Workflow

### CI Pipeline (.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test -- --coverage
      - uses: codecov/codecov-action@v3

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v3
      - uses: docker/setup-buildx-action@v2
      - uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - name: Deploy to Staging
        run: |
          curl -X POST https://api.railway.app/webhooks/deploy \
            -H "Authorization: Bearer ${{ secrets.RAILWAY_TOKEN }}" \
            -d '{"service": "analytics-staging"}'
      
      - name: Run Smoke Tests
        run: |
          npm install -g newman
          newman run postman_collection.json \
            --environment staging.json

  deploy-production:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    needs: [build, deploy-staging]
    environment: production
    steps:
      - name: Deploy to Production
        run: |
          curl -X POST https://api.railway.app/webhooks/deploy \
            -H "Authorization: Bearer ${{ secrets.RAILWAY_PROD_TOKEN }}" \
            -d '{"service": "analytics-production"}'
      
      - name: Health Check
        run: |
          for i in {1..30}; do
            if curl -f https://analytics.example.com/health; then
              echo "Health check passed"
              exit 0
            fi
            sleep 10
          done
          exit 1
      
      - name: Monitor Error Rate
        run: |
          # Check error rate in first 5 minutes
          # If > 1%, rollback
```

---

## Database Migrations

### Before Deployment

Test migrations locally:

```bash
# 1. Create migration
npm run db:generate

# 2. Test migration
npm run db:migrate

# 3. Verify data integrity
npm run db:test-integrity
```

### During Deployment

Migrations run automatically:

```typescript
// main.ts
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './infra/frameworks/database';

async function runMigrations() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './src/infra/frameworks/database/migrations' });
  console.log('Migrations completed');
}

if (process.env.RUN_MIGRATIONS === 'true') {
  await runMigrations();
}
```

Deploy command:

```bash
RUN_MIGRATIONS=true npm start
```

### Rollback Strategy

If migration fails:

```bash
# Stop deployment
# Rollback database to backup
# Check logs for error
# Fix migration
# Redeploy
```

---

## Deployment Checklist (Manual)

If deploying manually to Railway:

1. **Pre-Deployment**
   ```bash
   git checkout main
   git pull
   npm ci
   npm run lint
   npm run type-check
   npm run test -- --coverage
   ```

2. **Build**
   ```bash
   npm run build
   ```

3. **Staging Deployment**
   ```bash
   railway link <staging-project-id>
   railway up --detach
   
   # Verify
   curl https://staging-analytics.example.com/health
   ```

4. **Production Deployment**
   ```bash
   railway link <production-project-id>
   railway up --detach
   
   # Monitor
   railway logs -f
   ```

5. **Post-Deployment**
   - [ ] Health check passes
   - [ ] Metrics flowing
   - [ ] No error spikes
   - [ ] Monitor for 10 minutes
   - [ ] Announce in Slack

---

## Blue-Green Deployment

Minimize downtime with blue-green:

```
Blue Environment (Current)
├── 50% traffic
└── Running

Green Environment (New)
├── 50% traffic
└── Running

Traffic Router
├── Monitors error rates
├── If Green error rate < 1%, switch 100%
└── If error rate > 1%, revert to Blue
```

---

## Rollback Procedure

If issues detected post-deployment:

1. **Immediate Rollback** (< 1 minute)
   ```bash
   railway logs -f  # Check errors
   railway down     # Stop current
   railway deploy <previous-sha>
   ```

2. **Database Rollback** (if migration issue)
   ```sql
   -- Restore from backup
   psql <db-url> < backup.sql
   ```

3. **Communication**
   - Announce in Slack
   - Create incident
   - Post mortem within 24h

---

## Environment Variables

### Production Secrets (Railway Dashboard)

```
NODE_ENV=production
PORT=3000
API_BASE_URL=https://analytics.example.com

DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379

JWT_SECRET=<generate-secure-key>
JWT_EXPIRES_IN=24h

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

SLACK_WEBHOOK_URL=https://hooks.slack.com/...

LOG_LEVEL=info
SENTRY_DSN=https://...@sentry.io/...
```

Never commit secrets. Use environment variables or secrets manager.

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Application**
   - Error rate (target: < 0.1%)
   - P95 latency (target: < 150ms)
   - P99 latency (target: < 500ms)
   - Uptime (target: 99.5%)

2. **Database**
   - Query latency (target: < 50ms p95)
   - Connections (target: < 80% utilization)
   - Disk usage (target: < 80%)

3. **Infrastructure**
   - CPU usage (target: < 70%)
   - Memory usage (target: < 80%)
   - Network I/O

### Alert Configuration (Example)

```yaml
# monitoring/alerts.yml
alerts:
  - name: HighErrorRate
    condition: error_rate > 1%
    duration: 5m
    action: page_on_call
  
  - name: HighLatency
    condition: p95_latency > 500ms
    duration: 10m
    action: notify_slack
  
  - name: DiskFull
    condition: disk_usage > 90%
    duration: 5m
    action: page_on_call
  
  - name: DatabaseDown
    condition: database_unavailable
    duration: 1m
    action: page_on_call
```

---

## Performance Optimization for Deployment

Before going to production:

1. **Database Optimization**
   ```bash
   # Analyze query plans
   npm run db:analyze
   
   # Add missing indexes
   npm run db:optimize
   ```

2. **Redis Caching**
   - Cache dashboard queries (5 min TTL)
   - Cache API responses (1 min TTL)

3. **Load Testing**
   ```bash
   npm run test:load  # 10,000 req/s
   ```

4. **Bundle Size**
   ```bash
   npm run build -- --analyze
   ```

---

## Disaster Recovery

### Database Backup

Automated daily at 02:00 UTC:

```bash
# Restore from backup
railway database restore <backup-id>

# Or manual backup
pg_dump <db-url> > backup.sql
pg_restore -d <new-db-url> backup.sql
```

### Secrets Recovery

Backup JWT_SECRET and encryption keys in secure vault (1Password/Vault).

### Point-in-Time Recovery

PostgreSQL WAL archiving enabled:

```bash
# Restore to specific timestamp
SELECT pg_wal_replay_pause();
-- Restore from backup to timestamp
SELECT pg_wal_replay_resume();
```

---

## Version Management

### Semantic Versioning

```
MAJOR.MINOR.PATCH

1.0.0  = Initial release
1.1.0  = New feature (backward compatible)
1.0.1  = Bug fix
2.0.0  = Breaking changes
```

### Release Notes

On every release:

```markdown
# v1.2.0 - 2025-01-20

## Features
- Add percentile calculation
- Add custom alert rules

## Fixes
- Fix false positive anomalies
- Fix database connection pooling

## Performance
- 30% faster aggregation
- Reduced memory usage by 20%

## Migrations
- New table: alert_events
- Updated metrics schema

## Upgrade Instructions
```

---

## Post-Deployment

After successful deployment:

1. **Verify**
   - [ ] Health check passes
   - [ ] Metrics flowing
   - [ ] No errors in logs

2. **Announce**
   - Post in Slack #deployments
   - Include release notes
   - Tag stakeholders

3. **Monitor**
   - Watch error rate for 30min
   - Check performance metrics
   - Respond to customer reports

4. **Document**
   - Update deployment log
   - Record issues found
   - Plan improvements

---

## Troubleshooting

### Health Check Fails

```bash
# Check logs
railway logs -f

# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Check Redis connection
redis-cli -u $REDIS_URL ping
```

### High Error Rate After Deploy

```bash
# Check error logs
railway logs -f | grep ERROR

# Rollback if needed
railway deploy <previous-sha>

# Investigate locally
npm run test
npm run lint
```

### Database Migration Fails

```bash
# Check migration status
npm run db:status

# Rollback to previous
npm run db:rollback

# Check logs
cat drizzle/*.log
```

---

## Deployment Frequency

- **Staging**: Every merge to develop (continuous)
- **Production**: Every merge to main (daily or scheduled)
- **Hotfixes**: As needed (direct to main with approval)

---

## Team Responsibilities

- **Devs**: Ensure tests pass, migrations tested
- **QA**: Verify functionality in staging
- **DevOps**: Monitor deployment, handle issues
- **On-Call**: Monitor production, handle alerts

Last Updated: January 2025
