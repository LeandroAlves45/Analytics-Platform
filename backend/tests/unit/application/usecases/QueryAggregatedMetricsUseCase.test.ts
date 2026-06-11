/**
 * Testes unitários para QueryAggregatedMetricsUseCase.
 */

import { QueryAggregatedMetricsUseCase } from '@application/usecases/metrics/QueryAggregatedMetricsUseCase';
import type { AggregationReadRepository } from '@application/contracts/repositories';
import type { AggregatedMetricRow } from '@application/dto/MetricsQueryDTO';
import { ValidationError } from '@shared/errors';
import { TEST_WORKSPACE_ID } from '../../../fixtures/metrics';

describe('QueryAggregatedMetricsUseCase', () => {
  const FROM = new Date('2026-06-01T10:00:00.000Z');
  const TO = new Date('2026-06-01T11:00:00.000Z');

  const BASE_ROW: AggregatedMetricRow = {
    time: new Date('2026-06-01T10:00:00.000Z'),
    endpoint: 'GET /api/users',
    method: 'GET',
    count: 100,
    latencyP50: 25,
    latencyP75: 40,
    latencyP95: 180,
    latencyP99: 320,
    latencyAvg: 45,
    latencyMin: 10,
    latencyMax: 500,
    status2xxCount: 95,
    status3xxCount: 0,
    status4xxCount: 3,
    status5xxCount: 2,
  };

  let mockReadRepository: jest.Mocked<AggregationReadRepository>;
  let useCase: QueryAggregatedMetricsUseCase;

  beforeEach(() => {
    mockReadRepository = {
      findAggregatedMetrics: jest.fn().mockResolvedValue([BASE_ROW]),
    };
    useCase = new QueryAggregatedMetricsUseCase(mockReadRepository);
  });

  it('should reject when from is before to', async () => {
    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        from: TO,
        to: FROM,
        interval: '5m',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should calculate errorRate as (4xx+5xx)/count', async () => {
    const result = await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      from: FROM,
      to: TO,
      interval: '5m',
    });

    expect(result.series[0].errorRate).toBe(0.05);
  });

  it('should calculate throughputPerSec as count divided by window seconds', async () => {
    const result = await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      from: FROM,
      to: TO,
      interval: '5m',
    });

    // 100 requests / 300 seconds (5min window)
    expect(result.series[0].throughputPerSec).toBeCloseTo(100 / 300, 5);
  });
});
