# 📊 Analytics SaaS - Backend

> **Real-time observability platform for APIs**  
> A lightweight, developer-friendly analytics solution for startups who need enterprise-grade insights without enterprise complexity.

---

## ✨ What is Analytics SaaS?

Analytics SaaS is a **real-time observability platform** designed for developers and startup teams. Install our lightweight SDK in your API, track performance metrics, and visualize everything in a beautiful dashboard with automated alerting.

Perfect for startups with 2-10 engineers who want production visibility without complicated DevOps infrastructure.

### Why Choose Analytics SaaS?

| Feature | Analytics SaaS | Datadog | Vercel Analytics |
|---------|---|---|---|
| **Price** | $49-199/month | $1000+/month | Per-provider |
| **Setup** | 2 minutes | Complex | Provider-locked |
| **API Focus** | ✅ Yes | Partial | No |
| **Alerts** | ✅ Built-in | Yes | No |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** 15+ with TimescaleDB extension
- **Redis** 6+
- **npm** or **yarn**

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/analytics-saas.git
cd analytics-saas/backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database and service credentials

# Initialize database
npm run db:migrate

# Start development server
npm run dev
```

Server runs on `http://localhost:3000`

---

## 📦 Core Features

### 1. **Metrics Ingestion** 🔄
- Zero-configuration SDK for Node.js
- Sub-millisecond overhead
- Automatic buffering and batching
- Unlimited metrics volume

```bash
# SDK Usage (in your application)
import { AnalyticsSDK } from '@analytics-saas/sdk';

const analytics = new AnalyticsSDK({ apiKey: 'your-api-key' });

analytics.recordMetric({
  endpoint: 'GET /api/users',
  latency: 125,
  statusCode: 200
});
```

### 2. **Real-time Dashboard** 📈
- Latency percentiles (p50, p95, p99)
- Status code distribution
- Throughput monitoring (req/s)
- Endpoint filtering and drilldown
- 10-second refresh rate

### 3. **Intelligent Alerting** 🔔
- Rule-based conditions (latency, error rate, throughput)
- Multi-channel notifications (Slack, Email)
- Alert history and analytics
- Smart noise reduction

### 4. **Time-Series Database** 📊
- **metrics_raw**: 7-day raw data retention
- **metrics_5min**: 90-day 5-minute aggregations
- **metrics_1h**: 1-year hourly aggregations
- **metrics_1d**: Infinite daily summaries
- Automatic data retention policies

### 5. **Billing Integration** 💳
- Stripe-powered subscriptions
- Usage-based pricing (per request)
- Free tier: 100k requests/month
- Pro/Business/Enterprise tiers

### 6. **Multi-tenant Security** 🔐
- JWT-based authentication
- API key management
- Workspace isolation
- Role-based access control

---

## 🏗️ Architecture

This project implements **Clean Architecture** with 4 independent layers:

```
HTTP Request
    ↓
[HTTP Layer] Express
    ↓
[Interface Adapters] Controllers, Presenters
    ↓
[Application Layer] Use Cases, Business Logic
    ↓
[Domain Layer] Entities, Value Objects
    ↓
[Frameworks] Drizzle, Redis, BullMQ
```

### Project Structure

```
src/
├── domain/              # Business entities & rules
│   ├── entities/
│   ├── value-objects/
│   └── usecases/
├── application/         # Application logic
│   ├── usecases/
│   ├── contracts/
│   └── dto/
├── infra/              # External integrations
│   ├── controllers/
│   ├── repositories/
│   ├── gateways/
│   └── middleware/
├── frameworks/         # Express, Database, Cache
│   ├── express/
│   ├── database/
│   ├── cache/
│   ├── queue/
│   └── external/
├── shared/             # Constants, types, utils
└── main.ts
```

**Key Principle**: Dependencies flow **inward only**. Inner layers know nothing about outer layers.

Learn more → [Architecture Documentation](./docs/project/ARCHITECTURE.md)

---

## 📋 Available Commands

### Development

```bash
npm run dev              # Start dev server with hot reload
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues automatically
npm run type-check      # TypeScript type checking
npm run format          # Prettier formatting
```

### Testing

```bash
npm run test            # Run all tests
npm run test:watch      # Watch mode (re-run on changes)
npm run test:coverage   # Generate coverage report
```

### Database

```bash
npm run db:generate     # Generate Drizzle migration
npm run db:migrate      # Run pending migrations
npm run db:studio       # Open Drizzle Studio (UI browser)
npm run db:seed         # Seed test data
```

### Production

```bash
npm run build           # Compile TypeScript
npm run start           # Start production server
npm run health          # Health check endpoint
```

---

## 🗄️ Database Schema

The system uses **11 tables** optimized for analytics:

### Time-Series Tables (TimescaleDB Hypertables)

| Table | Purpose | Retention | Grain |
|-------|---------|-----------|-------|
| `metrics_raw` | Raw ingested metrics | 7 days | Per request |
| `metrics_5min` | 5-minute aggregations | 90 days | 5 minutes |
| `metrics_1h` | Hourly aggregations | 1 year | 1 hour |
| `metrics_1d` | Daily aggregations | ∞ | 1 day |

### Metadata Tables

| Table | Purpose |
|-------|---------|
| `workspaces` | Organizations (multi-tenant) |
| `users` | Platform users |
| `api_keys` | SDK authentication keys |
| `endpoints` | Tracked API endpoints |
| `workspace_members` | User-workspace relationships |

### Alerting & Billing

| Table | Purpose |
|-------|---------|
| `alert_rules` | Alert conditions |
| `alert_events` | Alert trigger history |
| `stripe_subscriptions` | Billing data |
| `usage_tracking` | Monthly request counts |

Detailed schema → [Database Documentation](./docs/project/DATABASE_SCHEMA.md)

---

## 🔄 Data Flow

```
SDK sends metric
    ↓
[Express] /api/metrics endpoint
    ↓
[Controller] Validates input
    ↓
[Use Case] Creates Metric entity
    ↓
[Repository] Saves to metrics_raw table
    ↓
[BullMQ Worker] Triggers aggregation job
    ↓
[Aggregation] Calculate p50, p95, p99
    ↓
[Insert] Store in metrics_5min
    ↓
[Alerts Worker] Evaluate alert rules
    ↓
[Notifications] Send Slack/Email if triggered
```

---

## 🛡️ Security Features

✅ **JWT Authentication** - Token-based auth  
✅ **API Key Management** - SDK authentication  
✅ **Multi-tenant Isolation** - Workspace-level data separation  
✅ **Parameterized Queries** - SQL injection prevention  
✅ **Secrets Management** - Environment variables only  
✅ **Rate Limiting** - DDoS protection  
✅ **HTTPS/TLS** - Encrypted transport  

Security Checklist → [Security Guidelines](./docs/project/DEVELOPMENT_GUIDELINES.md#6-security-practices)

---

## 📊 Performance Targets

Our MVP is built to scale:

| Metric | Target |
|--------|--------|
| **Ingestión Capacity** | 10,000 req/s |
| **Dashboard Latency** | <200ms (P95) |
| **Ingest Latency** | <50ms (P99) |
| **Uptime SLA** | 99.5% |
| **Error Rate** | <0.1% |

---

## 🧪 Testing Strategy

We follow **Test-Driven Development (TDD)**:

- **Unit Tests**: Entities, Use Cases (100% coverage)
- **Integration Tests**: Repositories, Controllers (90%+ coverage)
- **E2E Tests**: Full API flows (critical paths)

```bash
# Run specific test file
npm run test -- src/domain/entities/Metric.test.ts

# Watch mode for fast feedback
npm run test:watch

# Generate coverage report
npm run test:coverage
```

Testing Guide → [Testing Guidelines](./docs/project/DEVELOPMENT_GUIDELINES.md#3-testing-guidelines)

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [PROJECT.md](./docs/project/PROJECT.md) | Product vision, roadmap, business metrics |
| [ARCHITECTURE.md](./docs/project/ARCHITECTURE.md) | Clean architecture, layer details, patterns |
| [DEVELOPMENT_GUIDELINES.md](./docs/project/DEVELOPMENT_GUIDELINES.md) | Code standards, git workflow, testing |
| [DATABASE_SCHEMA.md](./docs/project/DATABASE_SCHEMA.md) | Complete schema with queries and tuning |
| [DEPLOYMENT.md](./docs/project/DEPLOYMENT.md) | Staging/production procedures |

---

## 🚢 Deployment

### Staging

```bash
npm run build
npm run test:coverage
npm run lint

git push origin feature/branch
# Create PR for review
```

### Production

```bash
# Merge to main
git checkout main
git pull origin main

# Tag release
git tag -a v1.2.3 -m "Release 1.2.3"
git push origin v1.2.3

# Deploy via CI/CD
# (GitHub Actions / GitHub Workflows configured)
```

Deployment Guide → [DEPLOYMENT.md](./docs/project/DEPLOYMENT.md)

---

## 🛠️ Adding a New Feature

### Example: Export Metrics to CSV

```typescript
// 1. Define Entity (domain layer)
export class ExportJob {
  id: string;
  workspaceId: string;
  format: 'csv' | 'json';
  status: 'pending' | 'processing' | 'completed';
}

// 2. Create Use Case (application layer)
export class RequestMetricsExportUseCase {
  async execute(workspaceId: string, format: string) {
    // Orchestrate entities
  }
}

// 3. Implement Repository (infra layer)
export class DrizzleExportsRepository {
  async save(job: ExportJob): Promise<void> { }
  async getById(id: string): Promise<ExportJob> { }
}

// 4. Create Controller (infra layer)
export class ExportsController {
  async requestExport(req: Request, res: Response) { }
}

// 5. Wire Dependencies (bootstrap)
const exportsRepository = new DrizzleExportsRepository(db);
const useCase = new RequestMetricsExportUseCase(exportsRepository);
const controller = new ExportsController(useCase);

app.post('/api/exports', (req, res) => controller.requestExport(req, res));

// 6. Write Tests
describe('RequestMetricsExportUseCase', () => { /* ... */ });
```

Learn more → [Architecture: Adding Features](./docs/project/ARCHITECTURE.md#4-adding-a-new-feature)

---

## 🤝 Contributing

1. **Create feature branch**: `git checkout -b feat/your-feature`
2. **Follow conventions**: See [DEVELOPMENT_GUIDELINES.md](./docs/project/DEVELOPMENT_GUIDELINES.md#2-git-workflow)
3. **Write tests**: TDD - tests first
4. **Run checks**: `npm run lint`, `npm run test`, `npm run type-check`
5. **Create PR**: Include description, tests, documentation
6. **Get reviewed**: Address feedback
7. **Merge**: Squash and merge to main

---

## 🐛 Troubleshooting

### Database Connection Fails

```bash
# Check PostgreSQL is running
psql -U postgres -h localhost -c "SELECT 1"

# Check TimescaleDB extension
psql -U postgres -d analytics_saas -c "CREATE EXTENSION IF NOT EXISTS timescaledb"

# Run migrations
npm run db:migrate
```

### Tests Failing

```bash
# Clear cache
rm -rf .jest_cache

# Run specific test with verbose output
npm run test -- --verbose src/domain/entities/Metric.test.ts

# Check environment variables
cat .env
```

### High Memory Usage

```bash
# Check Node memory
NODE_OPTIONS=--max-old-space-size=2048 npm run dev

# Profile with clinic.js
npm install -g clinic
clinic doctor -- node dist/main.js
```

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/analytics-saas/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/analytics-saas/discussions)
- **Documentation**: See `docs/` folder
- **Slack**: #analytics-saas-dev

---

## 📈 Roadmap

### Phase 1 (MVP - Weeks 1-16)
- ✅ Core ingestión & processing
- ✅ Dashboard & real-time updates
- ✅ Alerting system
- ✅ Billing integration

### Phase 2 (Months 7-12)
- 🔄 Python SDK
- 🔄 Advanced alerting (ML anomalies)
- 🔄 Integration marketplace (PagerDuty, Opsgenie)
- 🔄 Custom events tracking

### Phase 3 (Year 2)
- 📋 Distributed tracing
- 📋 Frontend monitoring (RUM)
- 📋 Cost optimization recommendations
- 📋 Self-hosted version
- 📋 Mobile app

---

## 📄 License

MIT License - See [LICENSE](./LICENSE)

---

## 👥 Team

**Built by developers, for developers.**

- **Backend**: TypeScript + Express + Clean Architecture
- **Database**: PostgreSQL + TimescaleDB (time-series)
- **Queue**: BullMQ + Redis (background jobs)
- **Testing**: Jest + Supertest (TDD)

---

<div align="center">

**[Documentation](./docs/project/) • [Architecture](./docs/project/ARCHITECTURE.md) • [Guidelines](./docs/project/DEVELOPMENT_GUIDELINES.md) • [Issues](https://github.com/your-org/analytics-saas/issues)**

Made with ❤️ for developers who care about observability.

</div>
