# ANALYTICS SAAS - PROJECT.MD

## 1. Project Overview

Analytics SaaS é uma plataforma de observabilidade em tempo real para APIs de developers. A solução permite que desenvolvedores instalem um SDK leve nas suas aplicações, rastreiem a performance de endpoints, e visualizem métricas em um dashboard centralizado com alerting automático.

## 2. Project Objective

Desenvolver um SaaS de analytics que resolve o problema de observabilidade para startups sem infraestrutura DevOps complexa. Target: startups com 2-10 engineers dispostas a pagar 49-199 USD/mês.

## 3. Target Audience

- Startups técnicas (2-10 engineers)
- Equipas sem DevOps engineers dedicados
- Clientes que usam Vercel, Railway, ou cloud providers
- Dispostas a pagar subscription mensal

## 4. MVP Scope

### Funcionalidades Core

1. SDK para ingestão de métricas
   - Suporte Node.js, Python (fase 2)
   - Buffering automático de dados
   - Autenticação com API key
   - Zero overhead (<1ms overhead por request)

2. Armazenamento e agregação
   - Raw metrics em TimescaleDB (7 dias)
   - Agregações 5min/1h/1d
   - Cálculo automático de percentis (p50, p95, p99)

3. Dashboard
   - Gráficos de latência
   - Distribuição de status codes
   - Throughput (req/s)
   - Filtros por endpoint/período
   - Real-time updates (10s polling)

4. Alerting
   - Rules baseadas em condições
   - Slack webhook integration
   - Email notifications
   - History de triggers

5. Billing
   - Stripe integration
   - Pricing por requests rastreados
   - Usage tracking
   - Multi-tier plans (free, pro, enterprise)

6. Autenticação
   - JWT-based
   - Multi-tenant isolation
   - API key management
   - OAuth (fase 2)

### Out of Scope (Post-MVP)

- Machine learning para anomalias avançadas
- Comparação benchmarks entre endpoints
- Custom events tracking
- Mobile app
- Advanced authorization (roles/permissions)
- API key rotation automática

## 5. Success Metrics

- **Uptime**: 99.5%
- **Dashboard latency (P95)**: <200ms
- **Ingestão capacity**: 10,000 req/s
- **Error rate**: <0.1%
- **Customer acquisition**: 50 customers em 6 meses
- **NRR**: >120%

## 6. Positioning vs Competitors

### vs Datadog
- Mais barato (99 USD/mês vs 1000+)
- Mais simples (zero configuração)
- Foco em APIs, não em full observability
- Trade-off: menos features, mais simplicidade

### vs Vercel/Railway Analytics
- Agnóstico a hosting provider
- Mais granular (todos endpoints)
- Alerting built-in
- Trade-off: setup requer SDK

### vs LogRocket
- Focused em backend, não frontend
- Real-time server metrics
- Mais barato

## 7. Revenue Model

Pricing por consumption:

- **Free**: 100k requests/mês, 7 dias retenção
- **Pro**: 1M requests/mês, $49/mês
- **Business**: 10M requests/mês, $199/mês
- **Enterprise**: Custom pricing, SLA 99.9%

Billing: monthly, annual discount 20%

## 8. Go-to-Market Strategy

### Phase 1 (Months 1-3)
- Beta com 10 early adopters
- Product Hunt launch
- Technical blog posts
- Open source SDK

### Phase 2 (Months 4-6)
- Paid launch (Pro tier)
- Community building
- Partnerships (hosting providers)
- Case studies

### Phase 3 (Months 7-12)
- Enterprise sales
- Integration marketplace
- Expand language support

## 9. Team & Responsibilities

### Core Team

- **Product**: Define features, roadmap, customer feedback
- **Backend (2 engineers)**: API, workers, integrations
- **Frontend (1 engineer)**: Dashboard, UX
- **DevOps/Infra (shared)**: Database, hosting, monitoring

### External

- **Stripe**: Billing
- **Slack/AWS**: Integrations
- **Design (freelance)**: Branding, assets

## 10. Technology Decisions

### Why Node.js + Express

- Fast I/O (ingestão de métricas)
- Easy to scale horizontally
- Strong npm ecosystem
- TypeScript für type-safety

### Why Drizzle vs Prisma

- Lighter weight
- More control over queries
- Better for time-series data
- Learning curve: lower

### Why TimescaleDB

- PostgreSQL extension (familiar)
- Built for time-series
- Automatic partitioning
- Compression

### Why BullMQ + Redis

- Simple, proven pattern
- No separate service (vs RabbitMQ)
- Good for aggregations
- Easy to monitor

## 11. Project Timeline

**Sprint 1-2**: Infrastructure (Weeks 1-4)
**Sprint 3-4**: Core ingestão & processing (Weeks 5-8)
**Sprint 5-6**: Dashboard & alerting (Weeks 9-12)
**Sprint 7**: Billing & auth (Weeks 13-14)
**Sprint 8**: Polish & launch (Weeks 15-16)

Total: ~4 months para MVP

## 12. Key Dependencies & Risks

### Critical Dependencies
- TimescaleDB stability
- Stripe API reliability
- Cloud provider uptime

### Technical Risks

**High Impact, Low Likelihood**
- Database corruption
  - Mitigation: automated backups, WAL archiving
  
- SDK breaking change
  - Mitigation: semantic versioning, deprecation warnings

**Medium Impact, Medium Likelihood**
- Performance degradation under load
  - Mitigation: load testing, caching strategy
  
- Data loss in aggregation workers
  - Mitigation: idempotent operations, dead letter queues

### Business Risks

- Market adoption slower than expected
  - Mitigation: faster iteration, customer interviews

- Competitors copy (DataDog simple version)
  - Mitigation: community, integrations, customer lock-in

## 13. Metrics to Track

### Technical Metrics
- Ingestão latency (p50, p95, p99)
- Aggregation lag
- Database query times
- Worker processing time
- Error rates por endpoint

### Business Metrics
- Monthly recurring revenue (MRR)
- Customer acquisition cost (CAC)
- Lifetime value (LTV)
- Churn rate
- Net retention rate (NRR)

### Product Metrics
- DAU/MAU
- Feature adoption
- Dashboard session duration
- Alerts triggered

## 14. Future Roadmap (Post-MVP)

### Phase 2 (Months 7-12)
- Python SDK
- Custom events tracking
- Advanced alerting (ML anomalies)
- Integrations (PagerDuty, Opsgenie)
- API gateway integration

### Phase 3 (Year 2)
- Distributed tracing
- Frontend monitoring (RUM)
- Cost optimization recommendations
- Self-hosted version
- Mobile app

## 15. Documentation Structure

This project uses the following documentation:

- `PROJECT.md`: Project overview (this file)
- `ARCHITECTURE.md`: Technical architecture details
- `SPRINTS.md`: Sprint planning and milestones
- `DEVELOPMENT_GUIDELINES.md`: Day-to-day development standards
- `DATABASE_SCHEMA.md`: Complete database schema
- `API_REFERENCE.md`: API endpoints and contracts
- `DEPLOYMENT.md`: Deploy procedures and environments
- `TROUBLESHOOTING.md`: Common issues and solutions
- `DEPENDENCIES.md`: Why each library was chosen

Last Updated: January 2025
