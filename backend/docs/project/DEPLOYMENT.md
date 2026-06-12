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
**Frontend**: http://localhost:5173 (`CORS_ORIGIN`)  
**Database**: PostgreSQL via Docker — host `localhost:5433` (mapeamento `5433→5432` no container)  
**Redis**: Local via Docker  
**Purpose**: Local development

> **Windows:** se existir PostgreSQL nativo na porta 5432, usar `DATABASE_PORT=5433` em `.env` (ver `backend/.env.example`). Sem isto, `npm run db:migrate` pode ligar à instância errada.

Setup:
```bash
# Na raiz do repo — só infra
docker-compose up -d

# Backend — API no host
cd backend
cp .env.example .env   # ajustar DATABASE_PORT=5433 se necessário
npm run db:migrate
npm run dev
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

### CI Pipeline (`.github/workflows/ci.yml`)

Pipeline actual (Node **24**, `working-directory: backend`):

| Job | O que faz |
|-----|-----------|
| `lint` | ESLint + `npm run type-check` |
| `test-unit` | Testes unitários + Codecov (`flags: unit`) |
| `test-integration` | TimescaleDB service, migrations, testes integração + Codecov |
| `sdk-lint` | Lint/type-check/build do pacote `sdk/` |
| `sdk-test` | Testes do SDK |
| `build` | `npm run build` + Docker image → GHCR (push só em `push` event) |

Integração usa `DATABASE_HOST/PORT/USER/PASSWORD/NAME` (porta **5432** no runner CI — sem conflito Windows).

**CD (deploy staging/production):** não implementado — previsto Sprint 7–8. Ver `.github/workflows/cd.yml` quando activo.

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

**Estado actual:** migrations correm manualmente ou via CI (`npm run db:migrate`). `RUN_MIGRATIONS` em `main.ts` **ainda não está implementado** — Sprint 7.

Local / CI:
```bash
cd backend
npm run db:migrate
```

Deploy command (quando CD estiver activo):

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

A aplicação lê variáveis individuais (ver `backend/src/infra/frameworks/config.ts` e `.env.example`):

```
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://app.example.com

DATABASE_HOST=<host>
DATABASE_PORT=5432
DATABASE_NAME=analytics_db
DATABASE_USER=analytics_user
DATABASE_PASSWORD=<secret>

REDIS_URL=redis://host:6379/0
METRICS_CACHE_TTL_SECONDS=300

JWT_SECRET=<generate-secure-key>
JWT_EXPIRES_IN=24h

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

SLACK_WEBHOOK_URL=https://hooks.slack.com/...

LOG_LEVEL=info
```

> Alguns providers expõem `DATABASE_URL` — converter para `DATABASE_*` ou adaptar `config.ts` no Sprint 7.

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

### `db:migrate` falha em desenvolvimento (Windows)

Sintoma: `database_setup_failed` ou credenciais recusadas.

Causa frequente: PostgreSQL nativo na porta **5432** + Docker na mesma porta.

Fix: `docker-compose.yml` mapeia `5433:5432`; definir `DATABASE_PORT=5433` em `backend/.env`.

### API não responde / curl connection refused

Docker Compose **não** inicia o servidor Express. Correr `cd backend && npm run dev`.

### Health Check Fails

```bash
# Check logs
railway logs -f

# Check database connection (local)
PGPASSWORD=analyticspass psql -h localhost -p 5433 -U analytics_user -d analytics_db -c "SELECT 1"

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

Last Updated: June 2026
