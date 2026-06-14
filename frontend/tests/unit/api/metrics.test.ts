import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '@/api/client';
import { fetchAggregatedMetrics } from '@/api/metrics';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('fetchAggregatedMetrics', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('should send endpoint query param matching backend contract', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          workspaceId: '550e8400-e29b-41d4-a716-446655440000',
          interval: '1h',
          from: '2026-06-01T10:00:00.000Z',
          to: '2026-06-01T11:00:00.000Z',
          series: [],
        },
      },
    });

    await fetchAggregatedMetrics({
      from: '2026-06-01T10:00:00.000Z',
      to: '2026-06-01T11:00:00.000Z',
      interval: '1h',
      endpoint: '/api/users',
      method: 'GET',
    });

    expect(apiClient.get).toHaveBeenCalledWith('/api/metrics/aggregated', {
      params: {
        from: '2026-06-01T10:00:00.000Z',
        to: '2026-06-01T11:00:00.000Z',
        interval: '1h',
        endpoint: '/api/users',
        method: 'GET',
      },
    });
  });
});
