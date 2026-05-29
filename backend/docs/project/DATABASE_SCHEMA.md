# DATABASE_SCHEMA.MD

## Complete Analytics SaaS Database Schema

Total: 11 tables (3 hypertables time-series, 8 relational)

---

## TIME-SERIES TABLES

### metrics_raw (Hypertable)

Raw metrics ingested from SDKs. 7-day retention.

```sql
CREATE TABLE metrics_raw (
  time TIMESTAMPTZ NOT NULL,
  workspace_id UUID NOT NULL,
  api_key_id UUID NOT NULL,
  
  endpoint VARCHAR NOT NULL,
  method VARCHAR NOT NULL,
  latency_ms FLOAT NOT NULL,
  status_code INT NOT NULL,
  payload_size_bytes INT,
  request_id UUID NOT NULL UNIQUE,
  user_agent VARCHAR,
  ip_address INET,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT create_hypertable('metrics_raw', 'time', if_not_exists => TRUE);

CREATE INDEX ON metrics_raw (workspace_id, time DESC);
CREATE INDEX ON metrics_raw (endpoint, time DESC);
CREATE INDEX ON metrics_raw (api_key_id, time DESC);
CREATE INDEX ON metrics_raw (status_code, time DESC);
```

**Rationale**:
- `time` is primary dimension (TimescaleDB optimized)
- `workspace_id` for tenant isolation
- `endpoint` + `method` for grouping
- Indexes on common queries
- `request_id` for idempotency checks

**Retention**: Automatic delete after 7 days

---

### metrics_5min (Hypertable)

5-minute aggregations. 90-day retention.

```sql
CREATE TABLE metrics_5min (
  time TIMESTAMPTZ NOT NULL,
  workspace_id UUID NOT NULL,
  endpoint VARCHAR NOT NULL,
  method VARCHAR NOT NULL,
  
  count INT NOT NULL,
  
  latency_p50 FLOAT,
  latency_p75 FLOAT,
  latency_p95 FLOAT,
  latency_p99 FLOAT,
  latency_avg FLOAT,
  latency_max FLOAT,
  latency_min FLOAT,
  
  status_2xx_count INT,
  status_3xx_count INT,
  status_4xx_count INT,
  status_5xx_count INT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT create_hypertable('metrics_5min', 'time', if_not_exists => TRUE);

CREATE INDEX ON metrics_5min (workspace_id, time DESC);
CREATE INDEX ON metrics_5min (endpoint, time DESC);
```

**Populated by**: AggregationWorker every 5 minutes

**Data structure**: Aggregates percentiles, counts

---

### metrics_1h (Hypertable)

1-hour aggregations. 1-year retention.

```sql
CREATE TABLE metrics_1h (
  time TIMESTAMPTZ NOT NULL,
  workspace_id UUID NOT NULL,
  endpoint VARCHAR NOT NULL,
  method VARCHAR NOT NULL,
  
  count INT NOT NULL,
  
  latency_p50 FLOAT,
  latency_p75 FLOAT,
  latency_p95 FLOAT,
  latency_p99 FLOAT,
  latency_avg FLOAT,
  latency_max FLOAT,
  latency_min FLOAT,
  
  status_2xx_count INT,
  status_3xx_count INT,
  status_4xx_count INT,
  status_5xx_count INT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT create_hypertable('metrics_1h', 'time', if_not_exists => TRUE);

CREATE INDEX ON metrics_1h (workspace_id, time DESC);
```

---

### metrics_1d (Hypertable)

1-day aggregations. Infinite retention.

```sql
CREATE TABLE metrics_1d (
  time TIMESTAMPTZ NOT NULL,
  workspace_id UUID NOT NULL,
  endpoint VARCHAR NOT NULL,
  method VARCHAR NOT NULL,
  
  count INT NOT NULL,
  
  latency_p50 FLOAT,
  latency_p75 FLOAT,
  latency_p95 FLOAT,
  latency_p99 FLOAT,
  latency_avg FLOAT,
  latency_max FLOAT,
  latency_min FLOAT,
  
  status_2xx_count INT,
  status_3xx_count INT,
  status_4xx_count INT,
  status_5xx_count INT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT create_hypertable('metrics_1d', 'time', if_not_exists => TRUE);

CREATE INDEX ON metrics_1d (workspace_id, time DESC);
```

---

## METADATA TABLES

### workspaces

Organizations in multi-tenant system.

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE NOT NULL,
  
  plan VARCHAR DEFAULT 'free',
  status VARCHAR DEFAULT 'active',
  
  settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON workspaces (user_id);
CREATE INDEX ON workspaces (slug);
```

**Fields**:
- `plan`: free, pro, business, enterprise
- `status`: active, suspended, deleted
- `settings`: JSON for future extensibility

---

### api_keys

SDK authentication keys.

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  name VARCHAR NOT NULL,
  key_hash VARCHAR NOT NULL UNIQUE,
  key_preview VARCHAR NOT NULL,
  
  status VARCHAR DEFAULT 'active',
  
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON api_keys (workspace_id);
CREATE INDEX ON api_keys (key_hash);
```

**Security**:
- `key_hash`: bcrypt of actual key (never store plaintext)
- `key_preview`: last 6 chars for UI identification
- `status`: can be revoked without deletion

---

### endpoints

Metadata about tracked API endpoints.

```sql
CREATE TABLE endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  endpoint VARCHAR NOT NULL,
  method VARCHAR NOT NULL,
  description VARCHAR,
  
  alerts_enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX ON endpoints (workspace_id, endpoint, method);
```

**Rationale**:
- Unique constraint: can't track same endpoint twice
- Optional description: for UI labeling
- `alerts_enabled`: bulk disable alerts per endpoint

---

### users

Platform users.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  name VARCHAR,
  
  email_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR DEFAULT 'active',
  
  settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON users (email);
```

---

### workspace_members

Join table: users + workspaces (many-to-many).

```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  role VARCHAR DEFAULT 'member',
  
  joined_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX ON workspace_members (workspace_id, user_id);
CREATE INDEX ON workspace_members (user_id);
```

**Roles**: owner, admin, member, viewer

---

## ALERTING TABLES

### alert_rules

User-defined alert conditions.

```sql
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  endpoint_id UUID REFERENCES endpoints(id) ON DELETE SET NULL,
  
  name VARCHAR NOT NULL,
  description VARCHAR,
  
  condition VARCHAR NOT NULL,
  threshold FLOAT NOT NULL,
  window_minutes INT DEFAULT 5,
  
  slack_webhook_url VARCHAR,
  email_addresses VARCHAR[],
  
  status VARCHAR DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON alert_rules (workspace_id);
CREATE INDEX ON alert_rules (status);
```

**Conditions** (examples):
- `latency_p95 > 500`
- `error_rate > 0.05`
- `status_5xx_count > 10`

**Notification**: Slack webhook OR email addresses (or both)

---

### alert_events

Log of alert triggers.

```sql
CREATE TABLE alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  triggered_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  
  value FLOAT NOT NULL,
  message VARCHAR,
  
  slack_sent BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON alert_events (workspace_id, triggered_at DESC);
CREATE INDEX ON alert_events (alert_rule_id, triggered_at DESC);
CREATE INDEX ON alert_events (resolved_at);
```

**Rationale**:
- `triggered_at` + `resolved_at`: track alert duration
- `value`: actual metric value when alert triggered
- Flags for notification status
- Queryable by workspace or rule

---

## BILLING TABLES

### usage_tracking

Monthly usage aggregation.

```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  month DATE NOT NULL,
  requests_tracked INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX ON usage_tracking (workspace_id, month);
```

**Updated by**: Nightly aggregation job

---

### stripe_subscriptions

Billing integration.

```sql
CREATE TABLE stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  
  stripe_customer_id VARCHAR NOT NULL UNIQUE,
  stripe_subscription_id VARCHAR NOT NULL UNIQUE,
  stripe_product_id VARCHAR,
  
  plan VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  
  current_period_start DATE,
  current_period_end DATE,
  
  trial_end DATE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON stripe_subscriptions (status);
```

**Status**: active, past_due, canceled, unpaid

---

## QUERY PATTERNS

### Recent Metrics (Dashboard)

```sql
SELECT 
  time,
  endpoint,
  latency_p95,
  latency_p99,
  status_5xx_count
FROM metrics_1h
WHERE workspace_id = $1
  AND time > now() - interval '24 hours'
ORDER BY time DESC;
```

**Expected**: < 1000 rows, completes in < 100ms

---

### Aggregation Pipeline

```sql
-- 1. Get raw metrics for last 5 minutes
SELECT latency_ms, status_code
FROM metrics_raw
WHERE workspace_id = $1
  AND endpoint = $2
  AND time > now() - interval '5 minutes'

-- 2. Calculate percentiles in worker (application code)
-- 3. Insert aggregated result
INSERT INTO metrics_5min VALUES (...)
```

---

### Alert Evaluation

```sql
SELECT latency_p95, count
FROM metrics_5min
WHERE alert_rule_id = $1
  AND time > now() - interval '5 minutes'
ORDER BY time DESC
LIMIT 1;
```

---

## Retention Policy

| Table | Retention | Action |
|-------|-----------|--------|
| metrics_raw | 7 days | Auto-delete (TimescaleDB) |
| metrics_5min | 90 days | Manual cleanup job |
| metrics_1h | 1 year | Manual cleanup job |
| metrics_1d | Infinite | Keep forever |
| alert_events | 90 days | Manual cleanup job |
| Other | Infinite | Keep forever |

---

## Backup Strategy

- **Frequency**: Daily at 02:00 UTC
- **Retention**: 30 days
- **Type**: Full backup + WAL archiving
- **Test**: Weekly restore test
- **Location**: S3 (cross-region replication)

---

## Performance Tuning

### TimescaleDB Specific

```sql
-- Chunk interval (optimize for your data volume)
SELECT set_chunk_time_interval('metrics_raw', interval '1 hour');

-- Compression (compress older chunks)
ALTER TABLE metrics_raw SET (
  timescaledb.compress,
  timescaledb.compress_orderby = 'time DESC'
);

-- Enable compression policy
SELECT add_compression_policy('metrics_raw', before => interval '3 days');
```

### Statistics

```sql
-- Update table statistics
ANALYZE metrics_raw;
ANALYZE metrics_5min;
```

---

## Monitoring Queries

### Disk Usage

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Table Bloat

```sql
SELECT
  schemaname,
  tablename,
  ROUND(100.0 * (pg_relation_size(schemaname||'.'||tablename) -
  pg_relation_size(schemaname||'.'||tablename, 'main')) /
  pg_relation_size(schemaname||'.'||tablename), 2) AS bloat_percentage
FROM pg_tables
WHERE schemaname = 'public';
```

---

## Migration Strategy

### Add New Column

```typescript
// 1. Create migration
npm run db:generate

// 2. Update Drizzle schema
// 3. Run migration
npm run db:migrate

// 4. Update application code to handle new column
```

### Rename Column

```sql
-- 1. Add new column with new name
ALTER TABLE metrics_raw ADD COLUMN latency_milliseconds FLOAT;

-- 2. Copy data
UPDATE metrics_raw SET latency_milliseconds = latency_ms;

-- 3. Drop old column
ALTER TABLE metrics_raw DROP COLUMN latency_ms;
```

---

## Data Types Reference

| Type | Usage |
|------|-------|
| UUID | Primary keys, foreign keys |
| VARCHAR | Text fields (URLs, emails, names) |
| TEXT | Long text (descriptions) |
| INT | Counts, small numbers |
| FLOAT | Decimal numbers (latency, percentages) |
| TIMESTAMPTZ | Always with timezone |
| BOOLEAN | True/false flags |
| INET | IP addresses |
| JSONB | Flexible data (settings, metadata) |

Last Updated: January 2025
