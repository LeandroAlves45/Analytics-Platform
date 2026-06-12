# API_REFERENCE.MD

Contrato HTTP do backend Analytics SaaS para consumo pelo dashboard (Sprint 4) e SDK.

**Fonte de verdade:** código em `backend/src/infra/controllers/` e `backend/src/infra/frameworks/express/app.ts`.

Last Updated: June 2026

---

## Base URL e variáveis de ambiente

| Variável | Onde | Valor local típico |
|----------|------|-------------------|
| `PORT` | Backend | `3000` |
| `CORS_ORIGIN` | Backend | `http://localhost:5173` |
| `VITE_API_URL` | Frontend (a criar) | `http://localhost:3000` |

```bash
# Backend — ver backend/.env.example
PORT=3000
CORS_ORIGIN=http://localhost:5173

# Frontend — criar frontend/.env
VITE_API_URL=http://localhost:3000
```

O servidor API corre no host (`cd backend && npm run dev`). Docker Compose fornece apenas Postgres e Redis.

---

## Autenticação (estado actual — Sprint 4)

AuthMiddleware real chega no **Sprint 6**. Até lá:

| Ambiente | Comportamento |
|----------|---------------|
| `development` / `test` | Sem header `Authorization` → usa workspace/API key de dev |
| `production` | Sem contexto de tenant → `401 UNAUTHORIZED` |

**UUIDs de desenvolvimento** (`resolveTenantContext.ts`):

```
workspaceId: 00000000-0000-4000-8000-000000000000
apiKeyId:    00000000-0000-4000-8000-000000000001
```

Os testes de integração usam `TEST_WORKSPACE_ID` em `backend/tests/fixtures/metrics.ts` — alinhar seed de dados de dev com este UUID ou com `DEV_WORKSPACE_ID`.

**Sprint 6:** header `Authorization: Bearer <jwt>` ou API key; o middleware injecta `req.workspaceId` e `req.apiKeyId`.

---

## CORS e preflight

Browsers em `http://localhost:5173` fazem pedidos cross-origin para `:3000`.

- Headers permitidos: `Content-Type`, `Authorization`, `X-Request-ID`
- Métodos: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`
- `OPTIONS` → **204** (sem body)

---

## Formato de resposta

### Sucesso

```json
{
  "data": { }
}
```

### Erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [
      { "field": "from", "message": "from must be before to" }
    ]
  }
}
```

| Código | HTTP | Quando |
|--------|------|--------|
| `VALIDATION_ERROR` | 422 | Query/body inválido (Zod) ou regra de negócio (`from >= to`) |
| `UNAUTHORIZED` | 401 | Produção sem credenciais |
| `NOT_FOUND` | 404 | Rota inexistente ou recurso de domínio |
| `INTERNAL_SERVER_ERROR` | 500 | Erro inesperado |

`details` é opcional; presente em erros de validação.

---

## Endpoints

### GET /health

Liveness — processo vivo.

**Response 200:**

```json
{
  "status": "ok",
  "timestamp": "2026-06-11T12:00:00.000Z"
}
```

---

### GET /ready

Readiness — BD obrigatória; Redis opcional (modo degradado).

**Response 200** (`ready` ou `degraded`):

```json
{
  "status": "ready",
  "db": true,
  "redis": true,
  "timestamp": "2026-06-11T12:00:00.000Z"
}
```

**Response 503** (BD indisponível):

```json
{
  "status": "not_ready",
  "db": false,
  "redis": false,
  "timestamp": "2026-06-11T12:00:00.000Z"
}
```

---

### POST /api/metrics

Ingestão de uma métrica (SDK ou seed manual).

**Body (JSON):**

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `endpoint` | string | sim | ex: `/api/users` |
| `method` | string | sim | normalizado para UPPERCASE |
| `latencyMs` | number | sim | > 0 |
| `statusCode` | integer | sim | |
| `requestId` | string | sim | idempotência |
| `payloadSizeBytes` | integer | não | > 0 |
| `userAgent` | string | não | fallback: header User-Agent |
| `ipAddress` | string | não | fallback: `req.ip` |

**Response 202:**

```json
{
  "data": {
    "metricId": "uuid",
    "recordedAt": "2026-06-11T12:00:00.000Z"
  }
}
```

**Exemplo curl:**

```bash
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "/api/users",
    "method": "GET",
    "latencyMs": 120,
    "statusCode": 200,
    "requestId": "req-demo-001"
  }'
```

---

### GET /api/metrics/aggregated

Série temporal agregada para gráficos do dashboard.

**Query params:**

| Param | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `from` | ISO 8601 datetime | sim | início inclusivo |
| `to` | ISO 8601 datetime | sim | fim exclusivo; deve ser **depois** de `from` |
| `interval` | enum | sim | `5m` \| `1h` \| `1d` |
| `endpoint` | string | não | filtro exacto |
| `method` | string | não | normalizado para UPPERCASE |

**Tabelas consultadas:**

| `interval` | Tabela |
|------------|--------|
| `5m` | `metrics_5min` |
| `1h` | `metrics_1h` |
| `1d` | `metrics_1d` |

**Response 200:**

```json
{
  "data": {
    "workspaceId": "00000000-0000-4000-8000-000000000000",
    "interval": "5m",
    "from": "2026-06-01T10:00:00.000Z",
    "to": "2026-06-01T10:05:00.000Z",
    "series": [
      {
        "time": "2026-06-01T10:00:00.000Z",
        "endpoint": "/api/users",
        "method": "GET",
        "count": 50,
        "latencyP50": 20,
        "latencyP75": 30,
        "latencyP95": 100,
        "latencyP99": 200,
        "latencyAvg": 35,
        "latencyMin": 5,
        "latencyMax": 250,
        "status2xxCount": 48,
        "status3xxCount": 0,
        "status4xxCount": 1,
        "status5xxCount": 1,
        "errorRate": 0.04,
        "throughputPerSec": 0.16666666666666666
      }
    ]
  }
}
```

**Campos derivados (calculados no use case):**

- `errorRate` = `(status4xxCount + status5xxCount) / count` (0 se `count === 0`)
- `throughputPerSec` = `count / duração_da_janela_em_segundos`

**Response 422** — params Zod inválidos ou `from >= to`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [{ "field": "from", "message": "from must be before to" }]
  }
}
```

**Exemplo curl:**

```bash
curl "http://localhost:3000/api/metrics/aggregated?\
from=2026-06-01T10:00:00.000Z&\
to=2026-06-01T10:05:00.000Z&\
interval=5m&\
endpoint=/api/users&\
method=GET"
```

**Nota frontend:** pedido sem query params obrigatórios devolve **422** (comportamento esperado).

---

### GET /api/endpoints

Lista endpoints/métodos activos no workspace (filtros do dashboard).

**Query params:**

| Param | Tipo | Default | Notas |
|-------|------|---------|-------|
| `minutes` | integer | `1440` | lookback; max `10080` (7 dias) |

**Response 200:**

```json
{
  "data": {
    "workspaceId": "00000000-0000-4000-8000-000000000000",
    "minutes": 1440,
    "endpoints": [
      { "endpoint": "/api/orders", "method": "POST" },
      { "endpoint": "/api/users", "method": "GET" }
    ]
  }
}
```

**Exemplo curl:**

```bash
curl "http://localhost:3000/api/endpoints?minutes=1440"
```

---

## Integração frontend (Sprint 4)

### Polling recomendado

React Query com `refetchInterval: 10_000` nos hooks de:

- `GET /api/metrics/aggregated` (gráficos)
- `GET /api/endpoints` (filtros — menos frequente, ex: 60s)

### Tipos TypeScript sugeridos

Espelhar `MetricsQueryDTO.ts`:

```typescript
export type AggregationInterval = '5m' | '1h' | '1d';

export interface AggregatedMetricPoint {
  time: string;
  endpoint: string;
  method: string;
  count: number;
  latencyP50: number;
  latencyP75: number;
  latencyP95: number;
  latencyP99: number;
  latencyAvg: number;
  latencyMin: number;
  latencyMax: number;
  status2xxCount: number;
  status3xxCount: number;
  status4xxCount: number;
  status5xxCount: number;
  errorRate: number;
  throughputPerSec: number;
}

export interface AggregatedMetricsResponse {
  workspaceId: string;
  interval: AggregationInterval;
  from: string;
  to: string;
  series: AggregatedMetricPoint[];
}

export interface ActiveEndpoint {
  endpoint: string;
  method: string;
}
```

### Axios — exemplo mínimo

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export async function fetchAggregatedMetrics(params: {
  from: string;
  to: string;
  interval: '5m' | '1h' | '1d';
  endpoint?: string;
  method?: string;
}) {
  const { data } = await api.get<{ data: AggregatedMetricsResponse }>(
    '/api/metrics/aggregated',
    { params }
  );
  return data.data;
}
```

---

## Endpoints futuros (não implementados)

| Método | Path | Sprint |
|--------|------|--------|
| CRUD | `/api/alert-rules` | 5 |
| Auth | `/api/auth/*` | 6 |
| Billing | `/api/billing/*` | 6 |

Ver [SPRINTS.md](./SPRINTS.md) para roadmap completo.
