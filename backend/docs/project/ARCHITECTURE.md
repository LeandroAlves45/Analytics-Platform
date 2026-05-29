# ARCHITECTURE.MD

## 1. Clean Architecture Overview

Este projeto implementa Clean Architecture em 4 camadas independentes. Cada camada tem responsabilidades bem definidas. Dependências sempre apontam para dentro (inward rule).

```
                      User Request
                          |
                          v
                  HTTP Layer (Express)
                          |
                          v
        Interface Adapters (Controllers, Presenters)
                          |
                          v
            Application Layer (Use Cases)
                          |
                          v
                Domain Layer (Entities)
                          |
                          v
    Interface Adapters (Repositories, Gateways)
                          |
                          v
        Frameworks & Drivers (Drizzle, Redis, BullMQ)
```

### Dependency Rule

Camadas internas não conhecem camadas externas. Apenas dependência para dentro.

```
domain/
├── Métrica é criada aqui
├── Validações de negócio
└── Zero conhecimento de Express, Drizzle, Redis

application/
├── Use cases orquestram entities
├── Definem interfaces que repositories devem implementar
└── Zero conhecimento de HTTP, database specifics

infra/
├── Controllers recebem HTTP requests
├── Repositories implementam interfaces do application
├── Gateways chamam serviços externos
└── Conhecem about frameworks

frameworks/
├── Express setup
├── Drizzle queries
├── Redis client
└── BullMQ workers
```

## 2. Layer Details

### Layer 1: Domain (Entities)

Regras de negócio fundamentais. Business logic pura.

**Característica**: Zero dependências externas.

#### Example: Metric Entity

```typescript
export class Metric {
  id: string;
  workspaceId: string;
  endpoint: string;
  method: string;
  latencyMs: number;
  statusCode: number;
  timestamp: Date;
  
  constructor(
    workspaceId: string,
    endpoint: string,
    method: string,
    latencyMs: number,
    statusCode: number
  ) {
    // Validações de negócio (não database, não HTTP)
    if (latencyMs <= 0) {
      throw new Error('Latency must be positive');
    }
    if (statusCode < 100 || statusCode > 599) {
      throw new Error('Invalid status code');
    }
    
    this.id = crypto.randomUUID();
    this.workspaceId = workspaceId;
    this.endpoint = endpoint;
    this.method = method;
    this.latencyMs = latencyMs;
    this.statusCode = statusCode;
    this.timestamp = new Date();
  }
  
  isError(): boolean {
    return this.statusCode >= 400;
  }
  
  isSlow(threshold: number): boolean {
    return this.latencyMs > threshold;
  }
}
```

**Key Points**:
- Constructor valida business rules
- Métodos representam ações de domínio
- Zero conhecimento de como é persistido
- Testável sem qualquer infrastructure

#### Value Objects (Opcional)

Para conceitos que têm valor mas não identidade:

```typescript
// Email como value object
export class Email {
  readonly value: string;
  
  constructor(value: string) {
    if (!this.isValid(value)) {
      throw new Error('Invalid email');
    }
    this.value = value;
  }
  
  private isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
```

### Layer 2: Application (Use Cases)

Orquestração de entities. Business logic de aplicação.

**Característica**: Define interfaces que implementações devem cumprir. Dependency Injection obrigatório.

#### Example: RecordMetricUseCase

```typescript
// Define contract que repositories devem implementar
export interface MetricsRepository {
  save(metric: Metric): Promise<void>;
  getRecent(workspaceId: string, minutes: number): Promise<Metric[]>;
}

// Define contract para serviços externos
export interface AggregationService {
  scheduleAggregation(workspaceId: string, endpoint: string): Promise<void>;
}

// Input/Output DTOs
export interface RecordMetricInput {
  workspaceId: string;
  endpoint: string;
  method: string;
  latencyMs: number;
  statusCode: number;
}

// Use case é testável sem frameworks
export class RecordMetricUseCase {
  constructor(
    private metricsRepository: MetricsRepository,
    private aggregationService: AggregationService
  ) {}
  
  async execute(input: RecordMetricInput): Promise<void> {
    // Criar entity (regras de negócio validadas aqui)
    const metric = new Metric(
      input.workspaceId,
      input.endpoint,
      input.method,
      input.latencyMs,
      input.statusCode
    );
    
    // Persistir via repository (não sabe como)
    await this.metricsRepository.save(metric);
    
    // Trigger aggregation (não sabe como)
    await this.aggregationService.scheduleAggregation(
      input.workspaceId,
      input.endpoint
    );
  }
}
```

**Key Points**:
- Dependências injetadas (never new)
- Define interfaces, não implementações
- Testável com mocks/stubs
- Lógica pura (sem side effects)

#### Test Example

```typescript
describe('RecordMetricUseCase', () => {
  let useCase: RecordMetricUseCase;
  let metricsRepository: jest.Mocked<MetricsRepository>;
  let aggregationService: jest.Mocked<AggregationService>;
  
  beforeEach(() => {
    metricsRepository = {
      save: jest.fn(),
      getRecent: jest.fn()
    };
    aggregationService = {
      scheduleAggregation: jest.fn()
    };
    
    useCase = new RecordMetricUseCase(
      metricsRepository,
      aggregationService
    );
  });
  
  it('should save metric and trigger aggregation', async () => {
    await useCase.execute({
      workspaceId: 'ws-1',
      endpoint: 'GET /api/users',
      method: 'GET',
      latencyMs: 100,
      statusCode: 200
    });
    
    expect(metricsRepository.save).toHaveBeenCalled();
    expect(aggregationService.scheduleAggregation).toHaveBeenCalled();
  });
  
  it('should throw error if latency negative', async () => {
    await expect(
      useCase.execute({
        workspaceId: 'ws-1',
        endpoint: 'GET /api/users',
        method: 'GET',
        latencyMs: -100,
        statusCode: 200
      })
    ).rejects.toThrow('Latency must be positive');
  });
});
```

### Layer 3: Interface Adapters

Controllers, Repositories, Presenters. Traduzem dados entre camadas.

#### Example: MetricsController

```typescript
export class MetricsController {
  constructor(
    private recordMetricUseCase: RecordMetricUseCase
  ) {}
  
  async ingest(req: Request, res: Response): Promise<void> {
    try {
      const { endpoint, method, latencyMs, statusCode } = req.body;
      const workspaceId = req.user.workspaceId;
      
      // Valida input
      const validated = metricInputSchema.parse(req.body);
      
      // Chama use case (não sabe implementação)
      await this.recordMetricUseCase.execute({
        workspaceId,
        ...validated
      });
      
      // Responde (apresentação)
      res.status(202).json({ message: 'Metric queued' });
    } catch (error) {
      // Error handling
      res.status(400).json({ error: error.message });
    }
  }
}
```

#### Example: DrizzleMetricsRepository

```typescript
export class DrizzleMetricsRepository implements MetricsRepository {
  constructor(private db: Database) {}
  
  async save(metric: Metric): Promise<void> {
    // Implementa interface definida em application layer
    await this.db.insert(metricsRawTable).values({
      id: metric.id,
      workspace_id: metric.workspaceId,
      endpoint: metric.endpoint,
      method: metric.method,
      latency_ms: metric.latencyMs,
      status_code: metric.statusCode,
      time: metric.timestamp
    });
  }
  
  async getRecent(
    workspaceId: string,
    minutes: number
  ): Promise<Metric[]> {
    const results = await this.db
      .select()
      .from(metricsRawTable)
      .where(
        and(
          eq(metricsRawTable.workspace_id, workspaceId),
          gte(
            metricsRawTable.time,
            new Date(Date.now() - minutes * 60000)
          )
        )
      );
    
    return results.map(r => new Metric(
      r.workspace_id,
      r.endpoint,
      r.method,
      r.latency_ms,
      r.status_code
    ));
  }
}
```

**Key Points**:
- Implementa interfaces definidas em application
- Knows about frameworks (Drizzle) mas não sobre HTTP
- Transformações entre entity e database format
- Testável com test database

### Layer 4: Frameworks & Drivers

Express, Drizzle, Redis, BullMQ. Dependências externas.

#### Example: Express App Bootstrap

```typescript
import express from 'express';
import { MetricsController } from './infra/controllers/MetricsController';
import { RecordMetricUseCase } from './application/usecases/metrics/RecordMetricUseCase';
import { DrizzleMetricsRepository } from './infra/repositories/DrizzleMetricsRepository';
import { BullMQAggregationService } from './infra/queue/BullMQAggregationService';

const app = express();

// Initialize external dependencies
const db = initializeDatabase();
const redis = initializeRedis();

// Create repositories (implements application contracts)
const metricsRepository = new DrizzleMetricsRepository(db);
const aggregationService = new BullMQAggregationService(redis);

// Create use cases (depends on repositories)
const recordMetricUseCase = new RecordMetricUseCase(
  metricsRepository,
  aggregationService
);

// Create controllers (depends on use cases)
const metricsController = new MetricsController(recordMetricUseCase);

// Setup routes
app.post('/api/metrics', (req, res) => 
  metricsController.ingest(req, res)
);

export default app;
```

## 3. Project Structure

```
src/
├── domain/
│   ├── entities/
│   │   ├── Metric.ts
│   │   ├── AlertRule.ts
│   │   ├── Workspace.ts
│   │   ├── ApiKey.ts
│   │   └── User.ts
│   └── value-objects/
│       ├── Email.ts
│       └── Endpoint.ts
├── application/
│   ├── usecases/
│   │   ├── metrics/
│   │   │   ├── RecordMetricUseCase.ts
│   │   │   ├── GetEndpointLatencyUseCase.ts
│   │   │   └── AggregateMetricsUseCase.ts
│   │   ├── alerts/
│   │   │   ├── CreateAlertRuleUseCase.ts
│   │   │   ├── EvaluateAlertsUseCase.ts
│   │   │   └── TriggerAlertUseCase.ts
│   │   └── workspaces/
│   │       ├── CreateWorkspaceUseCase.ts
│   │       └── GetWorkspaceUseCase.ts
│   ├── contracts/
│   │   ├── repositories.ts (interfaces)
│   │   ├── services.ts (interfaces)
│   │   └── gateways.ts (interfaces)
│   └── dto/
│       ├── MetricsDTO.ts
│       ├── AlertsDTO.ts
│       └── WorkspacesDTO.ts
├── infra/
│   ├── controllers/
│   │   ├── MetricsController.ts
│   │   ├── AlertsController.ts
│   │   └── WorkspacesController.ts
│   ├── presenters/
│   │   ├── MetricsPresenter.ts
│   │   └── ErrorPresenter.ts
│   ├── repositories/
│   │   ├── DrizzleMetricsRepository.ts
│   │   ├── DrizzleAlertRepository.ts
│   │   └── RedisMetricsCache.ts
│   ├── gateways/
│   │   ├── StripeGateway.ts
│   │   └── SlackGateway.ts
│   ├── middleware/
│   │   ├── AuthMiddleware.ts
│   │   ├── ValidationMiddleware.ts
│   │   └── ErrorHandlerMiddleware.ts
│   └── frameworks/
│       ├── express/
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── routes.ts
│       │   └── bootstrap.ts
│       ├── database/
│       │   ├── connection.ts
│       │   ├── schema.ts
│       │   ├── migrations/
│       │   └── drizzle.config.ts
│       ├── cache/
│       │   └── redis.ts
│       ├── queue/
│       │   ├── bullmq.ts
│       │   ├── workers/
│       │   │   ├── aggregation.worker.ts
│       │   │   └── alerts.worker.ts
│       │   └── index.ts
│       └── external/
│           ├── stripe.ts
│           ├── slack.ts
│           └── index.ts
├── shared/
│   ├── errors/
│   │   ├── AppError.ts
│   │   ├── ValidationError.ts
│   │   ├── NotFoundError.ts
│   │   └── UnauthorizedError.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── validators.ts
│       ├── helpers.ts
│       └── constants.ts
└── main.ts

tests/
├── unit/
│   ├── domain/
│   │   └── entities/
│   │       ├── Metric.test.ts
│   │       └── AlertRule.test.ts
│   ├── application/
│   │   └── usecases/
│   │       ├── RecordMetricUseCase.test.ts
│   │       └── EvaluateAlertsUseCase.test.ts
│   └── infra/
│       ├── repositories/
│       │   └── DrizzleMetricsRepository.test.ts
│       └── controllers/
│           └── MetricsController.test.ts
├── integration/
│   ├── metrics.integration.test.ts
│   └── alerts.integration.test.ts
└── e2e/
    └── api.e2e.test.ts
```

## 4. Adding a New Feature

### Example: Export Metrics to CSV

**Step 1: Define Entity**

```typescript
// src/domain/entities/ExportJob.ts
export class ExportJob {
  id: string;
  workspaceId: string;
  format: 'csv' | 'json';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  
  constructor(workspaceId: string, format: 'csv' | 'json') {
    if (!['csv', 'json'].includes(format)) {
      throw new Error('Invalid format');
    }
    this.id = crypto.randomUUID();
    this.workspaceId = workspaceId;
    this.format = format;
    this.status = 'pending';
    this.createdAt = new Date();
  }
}
```

**Step 2: Define Use Case**

```typescript
// src/application/usecases/exports/RequestMetricsExportUseCase.ts
export interface ExportsRepository {
  save(exportJob: ExportJob): Promise<void>;
  getById(id: string): Promise<ExportJob | null>;
}

export class RequestMetricsExportUseCase {
  constructor(private exportsRepository: ExportsRepository) {}
  
  async execute(input: {
    workspaceId: string;
    format: 'csv' | 'json';
  }): Promise<{ exportJobId: string }> {
    const exportJob = new ExportJob(input.workspaceId, input.format);
    await this.exportsRepository.save(exportJob);
    return { exportJobId: exportJob.id };
  }
}
```

**Step 3: Implement Repository**

```typescript
// src/infra/repositories/DrizzleExportsRepository.ts
export class DrizzleExportsRepository implements ExportsRepository {
  constructor(private db: Database) {}
  
  async save(exportJob: ExportJob): Promise<void> {
    await this.db.insert(exportsTable).values({
      id: exportJob.id,
      workspace_id: exportJob.workspaceId,
      format: exportJob.format,
      status: exportJob.status,
      created_at: exportJob.createdAt
    });
  }
  
  async getById(id: string): Promise<ExportJob | null> {
    const result = await this.db
      .select()
      .from(exportsTable)
      .where(eq(exportsTable.id, id))
      .limit(1);
    
    return result.length ? /* hydrate */ : null;
  }
}
```

**Step 4: Create Controller**

```typescript
// src/infra/controllers/ExportsController.ts
export class ExportsController {
  constructor(private requestMetricsExportUseCase: RequestMetricsExportUseCase) {}
  
  async requestExport(req: Request, res: Response): Promise<void> {
    const result = await this.requestMetricsExportUseCase.execute({
      workspaceId: req.user.workspaceId,
      format: req.body.format
    });
    res.status(202).json(result);
  }
}
```

**Step 5: Wire in Bootstrap**

```typescript
// src/infra/frameworks/express/bootstrap.ts
const exportsRepository = new DrizzleExportsRepository(db);
const requestMetricsExportUseCase = new RequestMetricsExportUseCase(exportsRepository);
const exportsController = new ExportsController(requestMetricsExportUseCase);

app.post('/api/exports', (req, res) => exportsController.requestExport(req, res));
```

**Step 6: Write Tests**

```typescript
// tests/unit/application/usecases/RequestMetricsExportUseCase.test.ts
describe('RequestMetricsExportUseCase', () => {
  // ... tests
});
```

## 5. Benefits of This Architecture

- **Testability**: Mock repositories, test use cases isoladamente
- **Flexibility**: Trocar Drizzle por TypeORM? Apenas muda uma classe
- **Clareza**: Business logic separado de plumbing
- **Manutenção**: Código organizado por domínio
- **Escalabilidade**: Adicionar nova feature é adicionar novo use case

## 6. Common Mistakes to Avoid

❌ Colocar lógica de negócio em controllers
✅ Controllers são thin adapters apenas

❌ Usar entities como DTOs de API
✅ Criar DTOs separados, mapeias na controller

❌ Repositories retornam raw database rows
✅ Repositories retornam hydrated entities

❌ Use cases conhecem sobre HTTP/database
✅ Use cases usam interfaces abstratas

❌ Circular dependencies entre camadas
✅ Dependências sempre para dentro

Last Updated: January 2025
