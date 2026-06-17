/**
 * Testes unitários para api/alerts.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '@/api/client';
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertEvents,
  fetchAlertRule,
  fetchAlertRules,
  updateAlertRule,
} from '@/api/alerts';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const MOCK_RULE = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  workspaceId: '550e8400-e29b-41d4-a716-446655440000',
  endpointId: null,
  endpoint: null,
  method: null,
  name: 'High P95',
  description: null,
  condition: 'latency_p95' as const,
  threshold: 500,
  windowMinutes: 5,
  slackWebhookUrl: null,
  emailAddresses: [],
  status: 'active' as const,
  createdAt: '2026-06-14T10:00:00.000Z',
  updatedAt: '2026-06-14T10:00:00.000Z',
};

describe('fetchAlertRules', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('should unwrap list response from backend data envelope', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          workspaceId: MOCK_RULE.workspaceId,
          rules: [MOCK_RULE],
        },
      },
    });

    const result = await fetchAlertRules();

    expect(result.rules).toHaveLength(1);
  });
});

describe('fetchAlertRule', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('should request rule by id path segment', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: MOCK_RULE,
      },
    });

    const result = await fetchAlertRule(MOCK_RULE.id);

    expect(apiClient.get).toHaveBeenCalledWith(`/api/alert-rules/${MOCK_RULE.id}`);
    expect(result.id).toBe(MOCK_RULE.id);
  });
});

describe('createAlertRule', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it('should post create payload to alert-rules endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        data: MOCK_RULE,
      },
    });

    const input = {
      name: 'High P95',
      condition: 'latency_p95' as const,
      threshold: 500,
    };

    await createAlertRule(input);

    expect(apiClient.post).toHaveBeenCalledWith('/api/alert-rules', input);
  });
});

describe('updateAlertRule', () => {
  beforeEach(() => {
    vi.mocked(apiClient.put).mockReset();
  });

  it('should put update payload to alert-rules id endpoint', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      data: {
        data: {
          ...MOCK_RULE,
          status: 'inactive' as const,
        },
      },
    });

    await updateAlertRule(MOCK_RULE.id, {
      status: 'inactive',
    });

    expect(apiClient.put).toHaveBeenCalledWith(`/api/alert-rules/${MOCK_RULE.id}`, {
      status: 'inactive',
    });
  });
});

describe('deleteAlertRule', () => {
  beforeEach(() => {
    vi.mocked(apiClient.delete).mockReset();
  });

  it('should delete alert rule by id without expecting response body', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({
      status: 204,
      data: undefined,
    });

    await deleteAlertRule(MOCK_RULE.id);

    expect(apiClient.delete).toHaveBeenCalledWith(`/api/alert-rules/${MOCK_RULE.id}`);
  });
});

describe('fetchAlertEvents', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('should send status and limit query params matching backend contract', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          workspaceId: MOCK_RULE.workspaceId,
          events: [],
        },
      },
    });

    await fetchAlertEvents({ limit: 20, status: 'open' });

    expect(apiClient.get).toHaveBeenCalledWith('/api/alert-events', {
      params: {
        limit: 20,
        status: 'open',
      },
    });
  });
});
