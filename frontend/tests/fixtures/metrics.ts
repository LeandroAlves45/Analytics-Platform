/**
 * Fixtures centralizadas para testes do dashboard frontend.
 * Espelha o padrão de backend/tests/fixtures/metrics.ts.
 */

import type { AggregatedMetricPoint } from '@/types/metrics';

export const TEST_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';

export const BASE_AGGREGATED_POINT: AggregatedMetricPoint = {
  time: '2026-06-01T10:00:00.000Z',
  endpoint: '/api/users',
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
  errorRate: 0.05,
  throughputPerSec: 100 / 300,
};
