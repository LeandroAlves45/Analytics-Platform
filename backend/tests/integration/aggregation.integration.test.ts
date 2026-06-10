/**
 * Testes de integração do pipeline de agregação.
 *
 * 1. DrizzleAggregationRepository.save() — upsert idempotente.
 *    Verificamos que inserir o mesmo job duas vezes produz uma linha, não duas.
 *
 * 2. DrizzleMetricsRepository.getActiveEndpoints() — query de descoberta.
 *    O scheduler depende deste método. Se retornar resultados errados,
 *    os jobs de agregação são criados para endpoints inexistentes ou em falta.
 *
 * 3. Pipeline end-to-end sem BullMQ — inserimos métricas raw, executamos
 *    o use case directamente, persistimos via repositório e verificamos
 *    o resultado na BD. Testamos o comportamento, não a implementação.
 */

import { getDatabase } from '@infra/frameworks/database/connection';
import { DrizzleMetricsRepository } from '@infra/repositories/DrizzleMetricsRepository';
import { DrizzleAggregationRepository } from '@infra/repositories/DrizzleAggregationRepository';
import { AggregateMetricsUseCase } from '@application/usecases/aggregation/AggregateMetricsUseCase';
import { NoOpMetricsCacheService } from '@infra/cache/NoOpMetricsCacheService';
import { metricsRaw, metrics5min, metrics1h, metrics1d } from '@infra/frameworks/database/schema';
import { eq, and } from 'drizzle-orm';
import { truncateToInterval } from '@shared/date-utils/truncate-to-interval';
import {
  TEST_WORKSPACE_ID,
  TEST_WORKSPACE_ID_2,
  TEST_API_KEY_ID,
  createUniqueRequestId,
} from '../fixtures/metrics';
import type { AggregationResult } from '@application/dto/AggregationDTO';

// windowStart fixo — múltiplo de 5min, 60min e 1440min para todos os testes de upsert.
const WINDOW_START = new Date('2024-01-01T00:00:00.000Z');

// Inicializado em beforeAll para garantir que o setup.ts já chamou initializeDatabase().
// Chamar getDatabase() no top-level do módulo corre ANTES do beforeAll do setup.ts
// e lança "Database not initialized".
let db: ReturnType<typeof getDatabase>;
let metricsRepository: DrizzleMetricsRepository;
let aggregationRepository: DrizzleAggregationRepository;
let aggregateUseCase: AggregateMetricsUseCase;

beforeAll(() => {
  db = getDatabase();
  const noOpCache = new NoOpMetricsCacheService();
  metricsRepository = new DrizzleMetricsRepository(db, noOpCache);
  aggregationRepository = new DrizzleAggregationRepository(db);
  aggregateUseCase = new AggregateMetricsUseCase(metricsRepository);
});

// Limpa apenas as tabelas de agregação antes de cada teste.
// As tabelas de métricas raw são limpas pelo beforeEach global do setup.ts.
beforeEach(async () => {
  await db.delete(metrics5min);
  await db.delete(metrics1h);
  await db.delete(metrics1d);
});

async function insertRawMetric(overrides: {
  endpoint?: string;
  method?: string;
  latencyMs?: number;
  statusCode?: number;
  workspaceId?: string;
}): Promise<void> {
  await db.insert(metricsRaw).values({
    time: new Date(),
    workspaceId: overrides.workspaceId ?? TEST_WORKSPACE_ID,
    apiKeyId: TEST_API_KEY_ID,
    endpoint: overrides.endpoint ?? '/api/users',
    method: overrides.method ?? 'GET',
    latencyMs: overrides.latencyMs ?? 100,
    statusCode: overrides.statusCode ?? 200,
    requestId: createUniqueRequestId(),
  });
}

describe('DrizzleAggregationRepository —> idempotency upsert', () => {
  it('should insert one aggregation result in metrics_5min', async () => {
    const result: AggregationResult = {
      processedCount: 10,
      hasData: true,
      workspaceId: TEST_WORKSPACE_ID,
      endpoint: '/api/users',
      method: 'GET',
      intervalMinutes: 5,
      windowStart: WINDOW_START,
      latencyP50: 100,
      latencyP75: 150,
      latencyP95: 200,
      latencyP99: 250,
      latencyAvg: 120,
      latencyMin: 50,
      latencyMax: 300,
      status2xxCount: 9,
      status3xxCount: 0,
      status4xxCount: 1,
      status5xxCount: 0,
    };

    await aggregationRepository.save(result);

    const rows = await db
      .select()
      .from(metrics5min)
      .where(
        and(eq(metrics5min.workspaceId, TEST_WORKSPACE_ID), eq(metrics5min.endpoint, '/api/users'))
      );

    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(10);
    expect(rows[0].latencyP50).toBeCloseTo(100);
    expect(rows[0].status2xxCount).toBe(9);
  });

  it('should do upsert when calling save() twice for the same interval', async () => {
    const base = {
      processedCount: 5,
      hasData: true as const,
      workspaceId: TEST_WORKSPACE_ID,
      endpoint: '/api/users',
      method: 'GET',
      intervalMinutes: 5,
      windowStart: WINDOW_START,
      latencyP50: 100,
      latencyP75: 100,
      latencyP95: 100,
      latencyP99: 100,
      latencyAvg: 100,
      latencyMin: 100,
      latencyMax: 100,
      status2xxCount: 5,
      status3xxCount: 0,
      status4xxCount: 0,
      status5xxCount: 0,
    };

    await aggregationRepository.save(base);
    await aggregationRepository.save({ ...base, processedCount: 8, latencyP95: 180 });

    const rows = await db
      .select()
      .from(metrics5min)
      .where(eq(metrics5min.workspaceId, TEST_WORKSPACE_ID));

    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(8);
    expect(rows[0].latencyP95).toBeCloseTo(180);
  });

  it('should not persist if hasData is false', async () => {
    const result: AggregationResult = {
      processedCount: 0,
      hasData: false,
      workspaceId: TEST_WORKSPACE_ID,
      endpoint: '/api/users',
      method: 'GET',
      intervalMinutes: 5,
      windowStart: WINDOW_START,
    };

    await aggregationRepository.save(result);

    const rows = await db.select().from(metrics5min);

    expect(rows).toHaveLength(0);
  });

  it('should insert into the correct table for intervalMinutes: 60', async () => {
    const result: AggregationResult = {
      processedCount: 100,
      hasData: true,
      workspaceId: TEST_WORKSPACE_ID,
      endpoint: '/api/users',
      method: 'GET',
      intervalMinutes: 60,
      windowStart: WINDOW_START,
      latencyP50: 100,
      latencyP75: 150,
      latencyP95: 200,
      latencyP99: 250,
      latencyAvg: 120,
      latencyMin: 50,
      latencyMax: 300,
      status2xxCount: 100,
      status3xxCount: 0,
      status4xxCount: 0,
      status5xxCount: 0,
    };

    await aggregationRepository.save(result);

    const rows5min = await db.select().from(metrics5min);
    const rows1h = await db.select().from(metrics1h);

    expect(rows5min).toHaveLength(0);
    expect(rows1h).toHaveLength(1);
  });

  it('should insert into metrics_1d for intervalMinutes: 1440', async () => {
    const result: AggregationResult = {
      processedCount: 500,
      hasData: true,
      workspaceId: TEST_WORKSPACE_ID,
      endpoint: '/api/users',
      method: 'GET',
      intervalMinutes: 1440,
      windowStart: WINDOW_START,
      latencyP50: 120,
      latencyP75: 160,
      latencyP95: 220,
      latencyP99: 280,
      latencyAvg: 130,
      latencyMin: 40,
      latencyMax: 400,
      status2xxCount: 490,
      status3xxCount: 5,
      status4xxCount: 3,
      status5xxCount: 2,
    };

    await aggregationRepository.save(result);

    const rows5min = await db.select().from(metrics5min);
    const rows1h = await db.select().from(metrics1h);
    const rows1d = await db.select().from(metrics1d);

    expect(rows5min).toHaveLength(0);
    expect(rows1h).toHaveLength(0);
    expect(rows1d).toHaveLength(1);
    expect(rows1d[0].count).toBe(500);
  });

  it('should throw for an unsupported intervalMinutes', async () => {
    const result: AggregationResult = {
      processedCount: 1,
      hasData: true,
      workspaceId: TEST_WORKSPACE_ID,
      endpoint: '/api/users',
      method: 'GET',
      intervalMinutes: 30,
      windowStart: WINDOW_START,
      latencyP50: 100,
      latencyP75: 100,
      latencyP95: 100,
      latencyP99: 100,
      latencyAvg: 100,
      latencyMin: 100,
      latencyMax: 100,
      status2xxCount: 1,
      status3xxCount: 0,
      status4xxCount: 0,
      status5xxCount: 0,
    };

    await expect(aggregationRepository.save(result)).rejects.toThrow(
      'Unsupported aggregation interval'
    );
  });
});

describe('DrizzleMetricsRepository —> getActiveEndpoints', () => {
  it('should return endpoints with recent activity', async () => {
    await insertRawMetric({ endpoint: '/api/users', method: 'GET' });

    const result = await metricsRepository.getActiveEndpoints(5);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      workspaceId: TEST_WORKSPACE_ID,
      endpoint: '/api/users',
      method: 'GET',
    });
  });

  it('should return unique pairs even with multiple metrics from the same endpoint', async () => {
    for (let i = 0; i < 3; i++) {
      await insertRawMetric({ endpoint: '/api/users', method: 'GET' });
    }

    const result = await metricsRepository.getActiveEndpoints(5);

    expect(result).toHaveLength(1);
  });

  it('should distinguish different endpoints/methods as distinct pairs', async () => {
    await insertRawMetric({ endpoint: '/api/users', method: 'GET' });
    await insertRawMetric({ endpoint: '/api/users', method: 'POST' });
    await insertRawMetric({ endpoint: '/api/orders', method: 'GET' });

    const result = await metricsRepository.getActiveEndpoints(5);

    expect(result).toHaveLength(3);
  });

  it('should distinguish different workspaces as distinct pairs', async () => {
    await insertRawMetric({
      workspaceId: TEST_WORKSPACE_ID,
      endpoint: '/api/users',
      method: 'GET',
    });
    await insertRawMetric({
      workspaceId: TEST_WORKSPACE_ID_2,
      endpoint: '/api/users',
      method: 'GET',
    });

    const result = await metricsRepository.getActiveEndpoints(5);

    expect(result).toHaveLength(2);
  });

  it('should return empty array if no recent activity', async () => {
    const result = await metricsRepository.getActiveEndpoints(5);

    expect(result).toHaveLength(0);
  });
});

describe('Aggregation pipeline end-to-end', () => {
  it('should calculate and persist accurate aggregation from raw metrics', async () => {
    const windowStart = truncateToInterval(new Date(), 5);

    await insertRawMetric({
      endpoint: '/api/users',
      method: 'GET',
      latencyMs: 100,
      statusCode: 200,
    });
    await insertRawMetric({
      endpoint: '/api/users',
      method: 'GET',
      latencyMs: 200,
      statusCode: 200,
    });
    await insertRawMetric({
      endpoint: '/api/users',
      method: 'GET',
      latencyMs: 300,
      statusCode: 500,
    });

    const result = await aggregateUseCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      endpoint: '/api/users',
      method: 'GET',
      intervalMinutes: 5,
      windowStart,
    });

    await aggregationRepository.save(result);

    const rows = await db
      .select()
      .from(metrics5min)
      .where(eq(metrics5min.workspaceId, TEST_WORKSPACE_ID));

    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(3);
    expect(rows[0].status2xxCount).toBe(2);
    expect(rows[0].status5xxCount).toBe(1);
    // p50 de [100, 200, 300] = 200 (elemento do meio)
    expect(rows[0].latencyP50).toBeCloseTo(200);
  });
});
