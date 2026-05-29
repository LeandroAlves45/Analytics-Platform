# SPRINTS.MD

## Sprint Overview

Total: 8 sprints de 2 semanas cada (16 semanas = 4 meses até MVP)

Estrutura: Daily standups (15min), sprint planning (4h), sprint review (2h), retrospective (1.5h)

---

## Sprint 1: Infrastructure & Setup

**Duration**: Weeks 1-2  
**Goal**: Projectsetup, infrastructure, database schema, CI/CD pipeline

### Deliverables

- Repositório Git com estrutura inicial (Clean Architecture)
- PostgreSQL com TimescaleDB extension
- Redis configurado (local + Docker)
- Express server base com middleware
- Database migrations (Drizzle)
- ESLint + Prettier configurado
- GitHub Actions CI pipeline
- Environment variables setup

### Technical Tasks

#### Database Setup (3 days)
- [ ] PostgreSQL local setup
- [ ] TimescaleDB extension install
- [ ] Drizzle schema para todas as 11 tabelas
- [ ] Migration scripts
- [ ] Database indexes
- [ ] Seed script para dev
- [ ] Estimated: 16h

#### Backend Infrastructure (3 days)
- [ ] Express app base
- [ ] Middleware stack (CORS, auth, error handling)
- [ ] Logger (Pino) setup
- [ ] Environment variables loading
- [ ] TypeScript configuration
- [ ] Health check endpoint
- [ ] Estimated: 12h

#### Code Quality (2 days)
- [ ] ESLint configuration
- [ ] Prettier setup
- [ ] Husky pre-commit hooks
- [ ] lint-staged
- [ ] TypeScript strict mode
- [ ] Estimated: 8h

#### CI/CD Pipeline (2 days)
- [ ] GitHub Actions workflows
- [ ] Lint job
- [ ] Type check job
- [ ] Unit test job (empty)
- [ ] Build job
- [ ] Estimated: 12h

#### Docker Setup (1 day)
- [ ] docker-compose.yml (postgres, redis)
- [ ] Dockerfile para dev
- [ ] .dockerignore
- [ ] Development docs
- [ ] Estimated: 8h

### Testing Requirements

- Setup Jest configuration
- First test passing
- Coverage threshold set to 80%

### Acceptance Criteria

- [ ] `npm run dev` starts server without errors
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] PostgreSQL migrations run successfully
- [ ] Redis connects successfully
- [ ] CI pipeline runs on PR
- [ ] All ESLint/Prettier rules enforce

### Risks & Mitigation

**Risk**: Database setup complexity  
**Mitigation**: Use docker-compose, pre-built images

**Risk**: TypeScript learning curve for team  
**Mitigation**: Strict mode gradual, start with basics

### Definition of Done

- [ ] All acceptance criteria met
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Tested on 2+ environments

---

## Sprint 2: Core Ingestão

**Duration**: Weeks 3-4  
**Goal**: Implement metric ingestão flow

### Deliverables

- Node.js SDK para clients
- HTTP endpoint POST /api/metrics
- Zod validation
- Metrics guardados em metrics_raw
- Redis cache strategy
- Unit tests (80%+ coverage)
- Integration tests

### Technical Tasks

#### Metric Entity (1 day)
- [ ] Metric class definition
- [ ] Validations (latency > 0, status 100-599, etc)
- [ ] Business methods (isError, isSlow)
- [ ] Unit tests 100% coverage
- [ ] Estimated: 8h

#### Use Case Layer (2 days)
- [ ] RecordMetricUseCase definition
- [ ] MetricsRepository interface
- [ ] AggregationService interface
- [ ] DTO definitions
- [ ] Error handling
- [ ] Unit tests
- [ ] Estimated: 16h

#### Repository Implementation (2 days)
- [ ] DrizzleMetricsRepository
- [ ] Insert logic
- [ ] Read logic (getRecent)
- [ ] Error handling
- [ ] Integration tests
- [ ] Estimated: 16h

#### Controller Layer (1 day)
- [ ] MetricsController class
- [ ] HTTP binding
- [ ] Input validation (Zod)
- [ ] Response formatting
- [ ] Unit tests
- [ ] Estimated: 8h

#### SDK (Node.js) (2 days)
- [ ] Package structure
- [ ] MetricsClient class
- [ ] Buffering logic (batch 100 or 10s)
- [ ] Async sending
- [ ] Error retry logic
- [ ] Example usage
- [ ] Estimated: 16h

#### Redis Cache (1 day)
- [ ] Redis connection
- [ ] Cache key strategy
- [ ] TTL management
- [ ] Integration with repository
- [ ] Estimated: 8h

### Testing Requirements

- [ ] Unit tests: entities 100%, use cases 100%, controllers 90%
- [ ] Integration tests: repository + database
- [ ] E2E: SDK -> API -> Database

### Acceptance Criteria

- [ ] SDK sends metric to API
- [ ] Metric validated and stored
- [ ] Metric appears in database
- [ ] Cache hit rate > 70% (local)
- [ ] Latency < 100ms (p95)
- [ ] Error handling working
- [ ] Coverage > 80%

### Load Testing

- [ ] Test 1,000 req/s locally
- [ ] Test 10,000 req/s (expected phase 1 capacity)
- [ ] Document bottlenecks

### Definition of Done

- [ ] All acceptance criteria met
- [ ] Load testing passed
- [ ] SDK published to npm (private/beta)
- [ ] Documentation updated
- [ ] Code reviewed

---

## Sprint 3: Agregação & Processing

**Duration**: Weeks 5-6  
**Goal**: Implement background aggregation workers

### Deliverables

- BullMQ workers
- Percentile calculations (p50, p95, p99)
- Data aggregation (5min, 1h, 1d)
- Dead letter queue handling
- Integration tests

### Technical Tasks

#### BullMQ Setup (1 day)
- [ ] Bull queue configuration
- [ ] Worker base class
- [ ] Idempotency handling
- [ ] Error retry logic
- [ ] Estimated: 8h

#### Aggregation Worker (3 days)
- [ ] AggregateMetricsUseCase
- [ ] Percentile calculation logic (math)
- [ ] Status code aggregation (2xx, 4xx, 5xx)
- [ ] Batch processing
- [ ] Performance optimization
- [ ] Estimated: 24h

#### Data Insertion (2 days)
- [ ] Insert to metrics_5min
- [ ] Insert to metrics_1h
- [ ] Retention policy implementation
- [ ] Old data deletion (scheduled)
- [ ] Estimated: 16h

#### Alerting Trigger (1 day)
- [ ] Basic anomaly detection
- [ ] Queue alert evaluation jobs
- [ ] Estimated: 8h

### Monitoring & Observability

- [ ] Worker metrics (processed count, duration)
- [ ] Lag monitoring (data freshness)
- [ ] Error tracking

### Acceptance Criteria

- [ ] Raw metrics aggregated every 5 minutes
- [ ] Percentiles calculated correctly
- [ ] 7-day retention on raw metrics
- [ ] 90-day retention on 5min aggregates
- [ ] Lag < 1 minute
- [ ] Error rate < 0.1%

### Definition of Done

- [ ] All acceptance criteria met
- [ ] Performance tested (10k metrics/min)
- [ ] Dead letter queue working
- [ ] Monitoring configured
- [ ] Code reviewed

---

## Sprint 4: Dashboard Frontend

**Duration**: Weeks 7-8  
**Goal**: React dashboard with real-time charts

### Deliverables

- React + Vite + TypeScript setup
- Recharts integration
- API client with Axios
- React Query setup
- Zustand stores
- Filters and date range picker
- Real-time updates (10s polling)
- Responsive layout

### Technical Tasks

#### Frontend Setup (1 day)
- [ ] Vite configuration
- [ ] TypeScript setup
- [ ] Tailwind CSS
- [ ] shadcn/ui installation
- [ ] Folder structure
- [ ] Estimated: 8h

#### API Client (1 day)
- [ ] Axios setup
- [ ] API endpoints mapping
- [ ] Error handling
- [ ] Request/response types
- [ ] Estimated: 8h

#### React Query Setup (1 day)
- [ ] React Query configuration
- [ ] Query hooks
- [ ] Caching strategy
- [ ] Refetch intervals
- [ ] Estimated: 8h

#### Dashboard Layout (2 days)
- [ ] Header/navigation
- [ ] Sidebar
- [ ] Main content area
- [ ] Responsive design
- [ ] Theme switching (light/dark)
- [ ] Estimated: 16h

#### Charts Component (2 days)
- [ ] Recharts setup
- [ ] Latency chart (p50, p95, p99)
- [ ] Error rate chart
- [ ] Throughput chart
- [ ] Custom tooltips
- [ ] Estimated: 16h

#### Filters & Controls (1 day)
- [ ] Date range picker
- [ ] Endpoint filter
- [ ] Method filter
- [ ] Refresh controls
- [ ] Estimated: 8h

#### State Management (1 day)
- [ ] Zustand setup
- [ ] Filters store
- [ ] Dashboard state
- [ ] Estimated: 8h

### Testing

- [ ] Component tests
- [ ] Query hooks tests
- [ ] E2E tests with Cypress

### Acceptance Criteria

- [ ] Dashboard loads in <2s
- [ ] Charts render correctly
- [ ] Data updates every 10s
- [ ] Filters work
- [ ] Responsive < 768px breakpoint
- [ ] Accessibility score > 90

### Definition of Done

- [ ] All acceptance criteria met
- [ ] Performance metrics captured
- [ ] Accessibility tested
- [ ] Code reviewed
- [ ] UI/UX approval

---

## Sprint 5: Alerting & Integrations

**Duration**: Weeks 9-10  
**Goal**: Alert rules and Slack notifications

### Deliverables

- Alert rules CRUD
- Rule evaluation logic
- Slack webhook integration
- Email notifications
- Alert history/logs
- Dashboard alert widget

### Technical Tasks

#### Alert Entity (1 day)
- [ ] AlertRule class
- [ ] Condition parsing
- [ ] Validation
- [ ] Estimated: 8h

#### Use Case Layer (2 days)
- [ ] CreateAlertRuleUseCase
- [ ] EvaluateAlertsUseCase
- [ ] TriggerAlertUseCase
- [ ] Estimated: 16h

#### Repository (1 day)
- [ ] DrizzleAlertRepository
- [ ] CRUD operations
- [ ] Query optimization
- [ ] Estimated: 8h

#### Controllers (1 day)
- [ ] AlertRulesController
- [ ] Endpoints: POST, GET, PUT, DELETE
- [ ] Estimated: 8h

#### Slack Gateway (1 day)
- [ ] SlackGateway class
- [ ] Webhook sending
- [ ] Retry logic
- [ ] Error handling
- [ ] Estimated: 8h

#### Email Service (1 day)
- [ ] EmailService class
- [ ] SMTP setup
- [ ] Email templates
- [ ] Estimated: 8h

#### Alert Worker (1 day)
- [ ] AlertEvaluationWorker
- [ ] Condition evaluation
- [ ] Trigger notifications
- [ ] Estimated: 8h

#### Dashboard Widget (1 day)
- [ ] Recent alerts display
- [ ] Alert status indicator
- [ ] Estimated: 8h

### Acceptance Criteria

- [ ] Alert rules can be created/updated/deleted
- [ ] Evaluations run every minute
- [ ] Slack notifications sent within 30s
- [ ] Email sent within 5 minutes
- [ ] Alert history logged
- [ ] False positive rate < 5%

### Definition of Done

- [ ] All acceptance criteria met
- [ ] Integration tests with mocked Slack
- [ ] Performance under load tested
- [ ] Code reviewed

---

## Sprint 6: Billing & Auth

**Duration**: Weeks 11-12  
**Goal**: JWT auth, Stripe integration, usage tracking

### Deliverables

- JWT authentication
- API key management
- Stripe integration
- Usage tracking/billing
- Multi-tenant isolation
- Performance optimizations

### Technical Tasks

#### Auth System (2 days)
- [ ] JWT generation
- [ ] Token validation
- [ ] Refresh token logic
- [ ] AuthMiddleware
- [ ] API key validation
- [ ] Estimated: 16h

#### User & Workspace (1 day)
- [ ] User entity
- [ ] Workspace entity
- [ ] User creation
- [ ] Workspace creation
- [ ] Estimated: 8h

#### Stripe Integration (2 days)
- [ ] StripeGateway
- [ ] Create customer
- [ ] Create subscription
- [ ] Webhook handling
- [ ] Invoice creation
- [ ] Estimated: 16h

#### Usage Tracking (1 day)
- [ ] UsageTracker service
- [ ] Count metrics per workspace
- [ ] Daily aggregation
- [ ] Usage report
- [ ] Estimated: 8h

#### Rate Limiting (1 day)
- [ ] Per API key rate limits
- [ ] Graceful degradation
- [ ] Estimated: 8h

#### Database Indexes (1 day)
- [ ] Performance analysis
- [ ] Create missing indexes
- [ ] Query optimization
- [ ] Estimated: 8h

### Performance & Load Testing

- [ ] Load test 1,000 concurrent users
- [ ] Query performance baseline
- [ ] Bottleneck identification

### Acceptance Criteria

- [ ] JWT tokens generated/validated correctly
- [ ] Stripe charges work
- [ ] Usage tracking accurate
- [ ] Multi-tenant isolation verified
- [ ] P95 latency < 150ms
- [ ] Support 1M metrics/day

### Definition of Done

- [ ] All acceptance criteria met
- [ ] Load testing passed
- [ ] Security audit done
- [ ] Compliance (PCI) verified
- [ ] Code reviewed

---

## Sprint 7-8: Polish & Launch

**Duration**: Weeks 13-16  
**Goal**: Bug fixes, documentation, launch preparation

### Sprint 7: Bug Fixes & Polish (Weeks 13-14)

- [ ] Dashboard UX improvements
- [ ] Error handling refinement
- [ ] Documentation completion
- [ ] Help center setup
- [ ] Email templates
- [ ] Onboarding flow
- [ ] Analytics (Mixpanel/Amplitude)

### Sprint 8: Launch Preparation (Weeks 15-16)

- [ ] Security audit
- [ ] Penetration testing
- [ ] Performance optimization
- [ ] Scaling testing (10k req/s)
- [ ] Disaster recovery testing
- [ ] Monitoring setup
- [ ] Alerts configuration
- [ ] Launch checklist
- [ ] Marketing assets

---

## Post-MVP Roadmap

### Phase 2 (Months 5-8)
- Python SDK
- Custom events tracking
- Advanced alerting (ML anomalies)
- API gateway integration
- Mobile app

### Phase 3 (Year 2)
- Distributed tracing
- Frontend monitoring (RUM)
- Self-hosted version
- Integrations marketplace

---

## Key Metrics per Sprint

Each sprint should track:

- **Velocity**: Points completed / Sprint
- **Burndown**: Ideal vs actual
- **Code quality**: Test coverage, lint score
- **Performance**: P95 latency, error rate
- **Deployment**: Time from merge to production

---

## Sprint Template

### Sprint Planning (Day 1, 4 hours)

1. Refinement (1h)
   - Review backlog
   - Clarify requirements
   - Estimate remaining items

2. Sprint goal definition (30min)
   - What success looks like
   - Key deliverables
   - Risks

3. Task breakdown (1.5h)
   - Technical tasks
   - Story points estimation
   - Assignments

4. Commitment (1h)
   - Team commits to sprint goal
   - Identify dependencies
   - Risk mitigation

### Daily Standup (15 min)

- What did I complete?
- What am I working on?
- Any blockers?

### Sprint Review (2 hours)

- Demo completed work
- Gather feedback
- Update backlog
- Metrics review

### Retrospective (1.5 hours)

- What went well?
- What could improve?
- Action items for next sprint

---

## Deployment Schedule

- **Sprint 1-2**: Deploy to staging only
- **Sprint 3-4**: Deploy to staging, test production readiness
- **Sprint 5-6**: Deploy to production (internal users)
- **Sprint 7-8**: Public launch

---

## Success Criteria by Sprint

| Sprint | Metric | Target |
|--------|--------|--------|
| 1 | CI/CD working | 100% |
| 2 | Ingestão latency (p95) | <100ms |
| 3 | Aggregation lag | <1min |
| 4 | Dashboard load time | <2s |
| 5 | Alert delivery time | <30s |
| 6 | P95 latency | <150ms |
| 7 | Coverage | >80% |
| 8 | Uptime | 99.5% |

Last Updated: January 2025
