import { describe, expect, it } from 'vitest';
import { deriveKpis } from '@/lib/kpi-derivation';
import { BASE_AGGREGATED_POINT } from '../../fixtures/metrics';

describe('deriveKpis', () => {
  it('should return zeroed summary for empty series', () => {
    const result = deriveKpis([]);

    expect(result.totalRequests).toBe(0);
    expect(result.errorRate).toBe(0);
  });

  it('should calculate errorRate as total errors divided by total requests', () => {
    const result = deriveKpis([BASE_AGGREGATED_POINT]);

    expect(result.totalRequests).toBe(100);
    expect(result.errorRate).toBe(0.05);
  });

  it('should calculate weighted p95 latency by request count', () => {
    const result = deriveKpis([
      BASE_AGGREGATED_POINT,
      {
        ...BASE_AGGREGATED_POINT,
        time: '2026-06-01T10:05:00.000Z',
        count: 50,
        latencyP95: 80,
      },
    ]);

    expect(result.p95LatencyMs).toBeCloseTo((180 * 100 + 80 * 50) / 150, 5);
  });
});
