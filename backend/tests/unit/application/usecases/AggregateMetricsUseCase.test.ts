/**
 * Testes unitários do use case de agregação.
 * Mock apenas no repositório — sem base de dados, sem cache, sem filas.
 * O objectivo é testar a orquestração e os cálculos estatísticos do use case.
 */

import { AggregateMetricsUseCase } from '@application/usecases/aggregation/AggregateMetricsUseCase';
import { MetricsRepository } from '@application/contracts/repositories';
import type { ScheduleAggregationInput } from '@application/dto/AggregationDTO';
import { Metric, type CreateMetricInput } from '@domain/entities/Metric';
import { BASE_METRIC_INPUT, createUniqueRequestId } from '../../../fixtures/metrics';

const baseJob: ScheduleAggregationInput = {
  workspaceId: BASE_METRIC_INPUT.workspaceId,
  endpoint: BASE_METRIC_INPUT.endpoint,
  method: BASE_METRIC_INPUT.method,
  intervalMinutes: 5,
};

const buildMetric = (overrides: Partial<CreateMetricInput> = {}): Metric =>
  new Metric({
    ...BASE_METRIC_INPUT,
    requestId: createUniqueRequestId(),
    ...overrides,
  });

describe('AggregateMetricsUseCase', () => {
  let useCase: AggregateMetricsUseCase;
  let metricsRepository: jest.Mocked<MetricsRepository>;

  beforeEach(() => {
    metricsRepository = {
      save: jest.fn(),
      existsByRequestId: jest.fn(),
      getRecent: jest.fn().mockResolvedValue([]),
    };

    useCase = new AggregateMetricsUseCase(metricsRepository);
  });

  describe('execute -> reading the window', () => {
    it('should request recent metrics for the job workspace and interval', async () => {
      await useCase.execute(baseJob);

      expect(metricsRepository.getRecent).toHaveBeenCalledWith(
        baseJob.workspaceId,
        baseJob.intervalMinutes
      );
    });
  });

  describe('execute -> empty window', () => {
    it('should return hasData false with zeroed metadata when the window has no metrics', async () => {
      const result = await useCase.execute(baseJob);

      expect(result).toEqual({
        processedCount: 0,
        hasData: false,
        workspaceId: baseJob.workspaceId,
        endpoint: baseJob.endpoint,
        method: baseJob.method,
        intervalMinutes: baseJob.intervalMinutes,
      });
    });
  });

  describe('execute -> filtering by endpoint and method', () => {
    it('should ignore metrics from other endpoints and methods when computing statistics', async () => {
      metricsRepository.getRecent.mockResolvedValue([
        buildMetric({ latencyMs: 100 }),
        buildMetric({ endpoint: '/api/orders', latencyMs: 9999 }),
        buildMetric({ method: 'POST', latencyMs: 9999 }),
      ]);

      const result = await useCase.execute(baseJob);

      expect(result).toMatchObject({ processedCount: 1, hasData: true, latencyAvg: 100 });
    });

    it('should return hasData false when no metric matches the job endpoint and method', async () => {
      metricsRepository.getRecent.mockResolvedValue([
        buildMetric({ endpoint: '/api/orders' }),
        buildMetric({ method: 'POST' }),
      ]);

      const result = await useCase.execute(baseJob);

      expect(result.hasData).toBe(false);
    });
  });

  describe('execute -> single metric in window', () => {
    it('should use the single latency value for every percentile and for min/max/avg', async () => {
      metricsRepository.getRecent.mockResolvedValue([buildMetric({ latencyMs: 120 })]);

      const result = await useCase.execute(baseJob);

      expect(result).toMatchObject({
        latencyP50: 120,
        latencyP75: 120,
        latencyP95: 120,
        latencyP99: 120,
        latencyAvg: 120,
        latencyMin: 120,
        latencyMax: 120,
      });
    });
  });

  describe('execute -> percentile interpolation across multiple metrics', () => {
    it('should interpolate percentiles linearly over sorted latencies', async () => {
      metricsRepository.getRecent.mockResolvedValue(
        [50, 10, 30, 20, 40].map((latencyMs) => buildMetric({ latencyMs }))
      );

      const result = await useCase.execute(baseJob);

      expect(result).toMatchObject({
        latencyP50: 30,
        latencyP75: 40,
        latencyP95: 48,
        latencyP99: 49.6,
        latencyMin: 10,
        latencyMax: 50,
        latencyAvg: 30,
      });
    });
  });

  describe('execute -> status code family counts', () => {
    it('should count matching metrics per status code family and ignore families outside 2xx-5xx', async () => {
      metricsRepository.getRecent.mockResolvedValue(
        [100, 200, 304, 404, 503].map((statusCode) => buildMetric({ statusCode }))
      );

      const result = await useCase.execute(baseJob);

      expect(result).toMatchObject({
        processedCount: 5,
        status2xxCount: 1,
        status3xxCount: 1,
        status4xxCount: 1,
        status5xxCount: 1,
      });
    });
  });

  describe('execute -> job metadata', () => {
    it('should echo the job workspaceId, endpoint, method and intervalMinutes in the result', async () => {
      metricsRepository.getRecent.mockResolvedValue([buildMetric()]);

      const result = await useCase.execute(baseJob);

      expect(result).toMatchObject({
        workspaceId: baseJob.workspaceId,
        endpoint: baseJob.endpoint,
        method: baseJob.method,
        intervalMinutes: baseJob.intervalMinutes,
      });
    });
  });
});
