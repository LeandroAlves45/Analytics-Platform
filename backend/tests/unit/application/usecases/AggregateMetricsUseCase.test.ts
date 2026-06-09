/**
 * Testes unitários do use case de agregação.
 * Mock apenas no repositório — sem base de dados, sem cache, sem filas.
 * O objectivo é testar a orquestração e os cálculos estatísticos do use case.
 */

import { AggregateMetricsUseCase } from '@application/usecases/aggregation/AggregateMetricsUseCase';
import type { MetricsRepository } from '@application/contracts/repositories';
import { Metric } from '@domain/entities/Metric';
import {
  TEST_WORKSPACE_ID,
  TEST_API_KEY_ID,
  createUniqueRequestId,
} from '../../../fixtures/metrics';

// Fábrica de métricas de teste para evitar repetição nos testes
function makeMetric(overrides: {
  endpoint?: string;
  method?: string;
  latencyMs?: number;
  statusCode?: number;
  workspaceId?: string;
}): Metric {
  return Metric.reconstitute({
    workspaceId: overrides.workspaceId ?? TEST_WORKSPACE_ID,
    apiKeyId: TEST_API_KEY_ID,
    endpoint: overrides.endpoint ?? '/api/test',
    method: overrides.method ?? 'GET',
    latencyMs: overrides.latencyMs ?? 100,
    statusCode: overrides.statusCode ?? 200,
    requestId: createUniqueRequestId(),
    timestamp: new Date(),
  });
}

// Mock do repositório — não queremos BD nos unitários
function makeMockRepository(metrics: Metric[]): jest.Mocked<MetricsRepository> {
  return {
    save: jest.fn(),
    existsByRequestId: jest.fn(),
    getRecent: jest.fn().mockResolvedValue(metrics),
    getActiveEndpoints: jest.fn(),
  };
}

const BASE_INPUT = {
  workspaceId: TEST_WORKSPACE_ID,
  endpoint: '/api/users',
  method: 'GET',
  intervalMinutes: 5,
};

describe('AggregateMetricsUseCase', () => {
  describe('when there are no metrics in the window', () => {
    it('should return hasData: false and processedCount: 0', async () => {
      const repo = makeMockRepository([]);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.hasData).toBe(false);
      expect(result.processedCount).toBe(0);
    });

    it('should not include statistical fields in the result', async () => {
      const repo = makeMockRepository([]);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.latencyP50).toBeUndefined();
      expect(result.latencyP95).toBeUndefined();
      expect(result.latencyP99).toBeUndefined();
      expect(result.status2xxCount).toBeUndefined();
    });

    it('should preserve identification fields even without data', async () => {
      const repo = makeMockRepository([]);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.workspaceId).toBe(BASE_INPUT.workspaceId);
      expect(result.endpoint).toBe(BASE_INPUT.endpoint);
      expect(result.method).toBe(BASE_INPUT.method);
      expect(result.intervalMinutes).toBe(BASE_INPUT.intervalMinutes);
    });
  });

  describe('filter by endpoint and method', () => {
    it('should ignore metrics from other endpoints of the same workspace', async () => {
      // O repositório devolve métricas de dois endpoints diferentes.
      // O use case deve usar apenas as do endpoint do input.
      const metrics = [
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          latencyMs: 100,
        }),
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/orders',
          method: 'GET',
          latencyMs: 999,
        }),
      ];
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      // Apenas 1 métrica pertence ao endpoint correcto
      expect(result.processedCount).toBe(1);
      // A latência 999 do outro endpoint não deve afectar o resultado
      expect(result.latencyP50).toBe(100);
    });

    it('should ignore metrics from the same endpoint with a different method', async () => {
      const metrics = [
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          latencyMs: 50,
        }),
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'POST',
          latencyMs: 999,
        }),
      ];
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.processedCount).toBe(1);
      expect(result.latencyP50).toBe(50);
    });
  });

  describe('percentile calculation', () => {
    it('should calculate p50 correctly with an odd array', async () => {
      // [10, 20, 30] — p50 é o elemento do meio: 20
      const metrics = [10, 20, 30].map((latencyMs) =>
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          latencyMs,
        })
      );
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.latencyP50).toBe(20);
    });

    it('should calculate p50 correctly with an even array using linear interpolation', async () => {
      // [10, 20, 30, 40] — p50 está entre 20 e 30
      // index = 0.50 * (4-1) = 1.5 → lower=1 (20), upper=2 (30), fraction=0.5
      // resultado = 20 + 0.5 * (30 - 20) = 25
      const metrics = [10, 20, 30, 40].map((latencyMs) =>
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          latencyMs,
        })
      );
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.latencyP50).toBe(25);
    });

    it('should calculate p75 correctly', async () => {
      // [10, 20, 30, 40] — p75: index = 0.75 * 3 = 2.25 → lower=2 (30), upper=3 (40), fraction=0.25
      // resultado = 30 + 0.25 * (40 - 30) = 32.5
      const metrics = [10, 20, 30, 40].map((latencyMs) =>
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          latencyMs,
        })
      );
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.latencyP75).toBe(32.5);
    });

    it('should calculate p95 correctly with 20 elements', async () => {
      // [10, 20, 30, ..., 200] — 20 elementos
      // p95: index = 0.95 * 19 = 18.05 → lower=18 (190), upper=19 (200), fraction=0.05
      // resultado = 190 + 0.05 * (200 - 190) = 190.5
      const latencies = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
      const metrics = latencies.map((latencyMs) =>
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          latencyMs,
        })
      );
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.latencyP95).toBeCloseTo(190.5, 5);
    });

    it('should calculate p99 as the maximum value in a 1-element array', async () => {
      const metrics = [
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          latencyMs: 42,
        }),
      ];
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.latencyP99).toBe(42);
    });

    it('should calculate latencyMin and latencyMax correctly', async () => {
      const metrics = [50, 10, 200, 75].map((latencyMs) =>
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          latencyMs,
        })
      );
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.latencyMin).toBe(10);
      expect(result.latencyMax).toBe(200);
    });

    it('should calculate latencyAvg correctly', async () => {
      // [100, 200, 300] → avg = 200
      const metrics = [100, 200, 300].map((latencyMs) =>
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          latencyMs,
        })
      );
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.latencyAvg).toBe(200);
    });
  });

  describe('counting by status code family', () => {
    it('should count 2xx, 3xx, 4xx and 5xx correctly', async () => {
      const metrics = [
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
        }),
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 201,
        }),
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 301,
        }),
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 404,
        }),
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 422,
        }),
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 500,
        }),
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 503,
        }),
      ];
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.status2xxCount).toBe(2);
      expect(result.status3xxCount).toBe(1);
      expect(result.status4xxCount).toBe(2);
      expect(result.status5xxCount).toBe(2);
    });

    it('should return zero for non-2xx counts when all metrics are 2xx', async () => {
      const metrics = [200, 201, 204].map((statusCode) =>
        makeMetric({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          statusCode,
        })
      );
      const repo = makeMockRepository(metrics);
      const useCase = new AggregateMetricsUseCase(repo);

      const result = await useCase.execute(BASE_INPUT);

      expect(result.status2xxCount).toBe(3);
      expect(result.status3xxCount).toBe(0);
      expect(result.status4xxCount).toBe(0);
      expect(result.status5xxCount).toBe(0);
    });
  });

  describe('passing parameters to the repository', () => {
    it('should call getRecent with correct workspaceId and intervalMinutes', async () => {
      const repo = makeMockRepository([]);
      const useCase = new AggregateMetricsUseCase(repo);

      await useCase.execute(BASE_INPUT);

      expect(repo.getRecent).toHaveBeenCalledWith(
        BASE_INPUT.workspaceId,
        BASE_INPUT.intervalMinutes
      );
    });
  });
});
