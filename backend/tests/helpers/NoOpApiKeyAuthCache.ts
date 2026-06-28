/**
 * Cache in-memory de API keys para testes sem Redis.
 * Paridade com NoOpRefreshTokenStore.
 */

import type { IApiKeyAuthCache } from '@infra/cache/ApiKeyAuthCache';

const cache = new Map<string, { id: string; workspaceId: string }>();
const idIndex = new Map<string, string>(); // apiKeyId -> sha256 key suffix

export class NoOpApiKeyAuthCache implements IApiKeyAuthCache {
  async get(plaintextKey: string) {
    return cache.get(plaintextKey) ?? null;
  }

  async set(plaintextKey: string, value: { id: string; workspaceId: string }) {
    cache.set(plaintextKey, value);
    idIndex.set(value.id, plaintextKey);
  }

  async invalidate(plaintextKey: string) {
    const entry = cache.get(plaintextKey);
    cache.delete(plaintextKey);
    if (entry) {
      idIndex.delete(entry.id);
    }
  }

  async invalidateByApiKeyId(apiKeyId: string) {
    const plaintextKey = idIndex.get(apiKeyId);
    if (plaintextKey) {
      await this.invalidate(plaintextKey);
    }
  }

  static clear() {
    cache.clear();
    idIndex.clear();
  }
}
