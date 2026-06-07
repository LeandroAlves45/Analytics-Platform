/**
 * Testes de integração para o endpoint POST /api/metrics.
 *
 * O que estes testes verificam que os unitários não conseguem:
 * - O SQL gerado pelo Drizzle é válido e executado correctamente pelo PostgreSQL
 * - A idempotência transaccional com ON CONFLICT DO NOTHING funciona sob carga real
 * - O TimescaleDB aceita os tipos de dados enviados (UUID, timestamps, etc.)
 * - O router, middleware de erro e controller estão correctamente ligados
 * - A resposta HTTP tem o formato e status code esperados end-to-end
 *
 * Cada teste começa com tabelas vazias (garantido pelo setup.ts via beforeEach).
 */

import request from 'supertest';
import { getTestApp } from './setup';
import { getDatabase } from '@infra/frameworks/database';
import { metricsRaw, metricIdempotencyKeys } from '@infra/frameworks/database/schema';
import { eq } from 'drizzle-orm';
import {
  TEST_WORKSPACE_ID,
  TEST_API_KEY_ID,
  TEST_REQUEST_ID,
  createUniqueRequestId,
} from '../fixtures/metrics';

/**
 * Payload HTTP válido para POST /api/metrics.
 * Os campos obrigatórios presentes e com valores válidos.
 *
 * workspaceId/apiKeyId NÃO fazem parte deste payload: o cliente nunca indica
 * o seu próprio workspace — esses valores vêm do contexto de autenticação
 * (req.workspaceId/req.apiKeyId), injectado pelo simulateAuthMiddleware em
 * bootstrapTest.ts com TEST_WORKSPACE_ID/TEST_API_KEY_ID.
 */
const validPayload = {
  endpoint: '/api/users',
  method: 'GET',
  latencyMs: 150,
  statusCode: 200,
  requestId: TEST_REQUEST_ID,
};

describe('POST /api/metrics -> integration test', () => {
  // Grupo 1: Happy path
  describe('Happy path', () => {
    it('should return 202 Accepted for a valid metric', async () => {
      const app = getTestApp();

      const res = await request(app)
        .post('/api/metrics')
        .send(validPayload)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(202);
    });

    it('should return metricId and recordedAt in response body', async () => {
      const app = getTestApp();

      const res = await request(app)
        .post('/api/metrics')
        .send(validPayload)
        .set('Content-Type', 'application/json');

      expect(res.body).toMatchObject({
        data: {
          metricId: expect.any(String),
          recordedAt: expect.any(String),
        },
      });
    });

    it('should persist the metric in metrics_raw table', async () => {
      const app = getTestApp();
      const requestId = createUniqueRequestId();

      await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, requestId })
        .set('Content-Type', 'application/json');

      // Verificar diretamente na BD que a métrica foi persistida
      const db = getDatabase();
      const rows = await db.select().from(metricsRaw).where(eq(metricsRaw.requestId, requestId));

      expect(rows).toHaveLength(1);
      expect(rows[0].workspaceId).toBe(TEST_WORKSPACE_ID);
      expect(rows[0].endpoint).toBe('/api/users');
      expect(rows[0].latencyMs).toBe(150);
      expect(rows[0].statusCode).toBe(200);
    });

    it('should persist the requestId in metric_idempotency_keys table', async () => {
      const app = getTestApp();
      const requestId = createUniqueRequestId();

      await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, requestId })
        .set('Content-Type', 'application/json');

      const db = getDatabase();
      const rows = await db
        .select()
        .from(metricIdempotencyKeys)
        .where(eq(metricIdempotencyKeys.requestId, requestId));

      // O requestId deve estar registado na tabela de idempotência
      expect(rows).toHaveLength(1);
      expect(rows[0].requestId).toBe(requestId);
    });

    it('should persist optional fields when provided', async () => {
      const app = getTestApp();
      const requestId = createUniqueRequestId();

      await request(app)
        .post('/api/metrics')
        .send({
          ...validPayload,
          requestId,
          userAgent: 'Mozilla/5.0',
          ipAddress: '127.0.0.1',
          payloadSizeBytes: 2048,
        })
        .set('Content-Type', 'application/json');

      const db = getDatabase();
      const rows = await db.select().from(metricsRaw).where(eq(metricsRaw.requestId, requestId));

      expect(rows[0].userAgent).toBe('Mozilla/5.0');
      expect(rows[0].ipAddress).toBe('127.0.0.1');
      expect(rows[0].payloadSizeBytes).toBe(2048);
    });

    it('should accept all valid HTTP methods', async () => {
      const app = getTestApp();
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

      for (const method of methods) {
        const res = await request(app)
          .post('/api/metrics')
          .send({ ...validPayload, method, requestId: createUniqueRequestId() })
          .set('Content-Type', 'application/json');

        // Cada método HTTP válido deve ser aceite com 202
        expect(res.status).toBe(202);
      }
    });
  });

  // Grupo 2: Idempotência
  describe('Idempotence', () => {
    it('should return 409 Conflict on duplicate requestId', async () => {
      const app = getTestApp();

      // Primeiro pedido: sucesso
      await request(app)
        .post('/api/metrics')
        .send(validPayload)
        .set('Content-Type', 'application/json');

      // Segundo pedido: duplicado e com conflito
      const res = await request(app)
        .post('/api/metrics')
        .send(validPayload)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(409);
    });

    it('should only insert one row despite duplicate requests', async () => {
      const app = getTestApp();
      const requestId = createUniqueRequestId();
      const payload = { ...validPayload, requestId };

      // Envia o mesmo payload duas vezes
      await request(app).post('/api/metrics').send(payload).set('Content-Type', 'application/json');
      await request(app).post('/api/metrics').send(payload).set('Content-Type', 'application/json');

      const db = getDatabase();
      const rows = await db.select().from(metricsRaw).where(eq(metricsRaw.requestId, requestId));

      // Deve existir apenas uma linha na BD
      expect(rows).toHaveLength(1);
    });

    it('should allow same workspaceId with different requestIds', async () => {
      const app = getTestApp();

      // Dois pedidos com o mesmo workspaceId, mas diferentes requestIds
      await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, requestId: createUniqueRequestId() })
        .set('Content-Type', 'application/json');

      const res = await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, requestId: createUniqueRequestId() })
        .set('Content-Type', 'application/json');

      // Devem ambos ser aceites
      expect(res.status).toBe(202);

      const db = getDatabase();
      const rows = await db.select().from(metricsRaw);
      expect(rows).toHaveLength(2);
    });

    it('should reject concurrent duplicate requestId with 409', async () => {
      const app = getTestApp();
      const requestId = createUniqueRequestId();
      const payload = { ...validPayload, requestId };

      const responses = await Promise.all([
        request(app).post('/api/metrics').send(payload).set('Content-Type', 'application/json'),
        request(app).post('/api/metrics').send(payload).set('Content-Type', 'application/json'),
      ]);

      const statusCodes = responses.map((res) => res.status).sort();

      // Exatamente um sucessoe um conflito
      expect(statusCodes).toEqual([202, 409]);

      const db = getDatabase();
      const rows = await db.select().from(metricsRaw).where(eq(metricsRaw.requestId, requestId));

      // Deve existir apenas uma linha na BD
      expect(rows).toHaveLength(1);
    });
  });

  // Grupo 3: Validação Zod
  describe('Input validation', () => {
    it('should return 422 when body is empty', async () => {
      const app = getTestApp();

      const res = await request(app)
        .post('/api/metrics')
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(422);
    });

    it('should return 422 when latencyMs is negative', async () => {
      const app = getTestApp();

      const res = await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, latencyMs: -1, requestId: createUniqueRequestId() })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(422);
    });

    it('should return 422 when statusCode is out of range', async () => {
      const app = getTestApp();

      const res = await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, statusCode: 99, requestId: createUniqueRequestId() })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(422);
    });

    it('should return 422 when method is not a valid HTTP method', async () => {
      const app = getTestApp();

      const res = await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, method: 'INVALID', requestId: createUniqueRequestId() })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(422);
    });

    it('should return 422 when requestId is missing', async () => {
      const app = getTestApp();
      const { requestId: _, ...payloadWithoutRequestId } = validPayload;

      const res = await request(app)
        .post('/api/metrics')
        .send(payloadWithoutRequestId)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(422);
    });

    it('should not persist metric when validation fails', async () => {
      const app = getTestApp();

      // Payload inválido
      await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, latencyMs: -1 })
        .set('Content-Type', 'application/json');

      const db = getDatabase();
      const rows = await db.select().from(metricsRaw);

      // Não deve existir nenhuma linha na BD
      expect(rows).toHaveLength(0);
    });

    it('should return 422 when payloadSizeBytes is zero', async () => {
      const app = getTestApp();

      const res = await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, payloadSizeBytes: 0, requestId: createUniqueRequestId() })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // Grupo 4: Integridade de dados na BD
  describe('Data integrity', () => {
    it('should store timestamp with milliseconds precision', async () => {
      const app = getTestApp();
      const requestId = createUniqueRequestId();
      const before = new Date();

      await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, requestId })
        .set('Content-Type', 'application/json');

      const after = new Date();

      const db = getDatabase();
      const rows = await db.select().from(metricsRaw).where(eq(metricsRaw.requestId, requestId));

      // O timestamp deve estar entre before e after
      expect(rows[0].time.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(rows[0].time.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should store correct workspaceId and apiKeyId UUIDs', async () => {
      const app = getTestApp();
      const requestId = createUniqueRequestId();

      await request(app)
        .post('/api/metrics')
        .send({ ...validPayload, requestId })
        .set('Content-Type', 'application/json');

      const db = getDatabase();
      const rows = await db.select().from(metricsRaw).where(eq(metricsRaw.requestId, requestId));

      expect(rows[0].workspaceId).toBe(TEST_WORKSPACE_ID);
      expect(rows[0].apiKeyId).toBe(TEST_API_KEY_ID);
    });

    it('should handle multiple metrics from same workspace independently', async () => {
      const app = getTestApp();

      // Inserie 5 métricas do mesmo workspace
      const inserts = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/metrics')
          .send({ ...validPayload, requestId: createUniqueRequestId() })
      );

      const responses = await Promise.all(inserts);

      // Todas as respostas devem ser 202
      responses.forEach((res) => expect(res.status).toBe(202));

      const db = getDatabase();
      const rows = await db.select().from(metricsRaw);

      // Devem existir 5 linhas na BD
      expect(rows).toHaveLength(5);
    });
  });

  // Grupo 5: infra HTTP
  describe('HTTP infrastructure', () => {
    it('should return 404 for unknown endpoint', async () => {
      const app = getTestApp();

      const res = await request(app).get('/api/unknown-endpoint');

      expect(res.status).toBe(404);
    });

    it('should return 200 for health check endpoint', async () => {
      const app = getTestApp();

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
    });

    it('should return 200 with degraded status when Redis is unavailable', async () => {
      const app = getTestApp();

      // bootstrapForTesting() usa NoOpMetricsCacheService e nunca chama
      // initializeRedis(), logo checkRedisConnection() devolve sempre false aqui —
      // este é o cenário real "BD ok + cache em baixo" que o /ready deve reportar
      // de forma consistente entre o status HTTP e o corpo da resposta.
      const res = await request(app).get('/ready');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'degraded',
        db: true,
        redis: false,
      });
    });

    it('should return JSON content type in response', async () => {
      const app = getTestApp();

      const res = await request(app)
        .post('/api/metrics')
        .send(validPayload)
        .set('Content-Type', 'application/json');

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
