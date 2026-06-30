/**
 * Testes unitários para a API de API keys.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/api/client';
import { fetchApiKeys, createApiKey, revokeApiKey } from '@/api/apiKeys';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('apiKeys API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch api keys for a workspace', async () => {
    const keys = [
      {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Production',
        keyPreview: 'abc123',
      },
    ];

    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: { apiKeys: keys } },
    });

    const result = await fetchApiKeys('ws-id');

    expect(apiClient.get).toHaveBeenCalledWith('/api/workspaces/ws-id/api-keys');
    expect(result).toEqual(keys);
  });

  it('should create a new api key and return plaintext key', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        data: {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          plaintextKey: 'apk_secret',
          keyPreview: 'secret',
        },
      },
    });

    const result = await createApiKey('ws-id', 'My Key');

    expect(apiClient.post).toHaveBeenCalledWith('/api/workspaces/ws-id/api-keys', {
      name: 'My Key',
    });
    expect(result.plaintextKey).toBe('apk_secret');
  });

  it('should call DELETE when revoking an api key', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

    await revokeApiKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890');

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/api/api-keys/a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    );
  });
});
