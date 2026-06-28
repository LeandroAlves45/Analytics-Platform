/**
 * Cache de autenticação API key — evita bcrypt repetido no hot path de ingestão.
 *
 * Chaves Redis:
 * - `apikey-auth:<sha256>` — `{ id, workspaceId }` TTL 5 min
 * - `apikey-auth-id:<apiKeyId>` — sha256 do plaintext (índice reverso para revoke)
 */

import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';

const PREFIX = 'apikey-auth:';
const ID_INDEX_PREFIX = 'apikey-auth-id:';
const TTL_SECONDS = 300;

function hashKey(plaintextKey: string): string {
  return createHash('sha256').update(plaintextKey).digest('hex');
}

function cacheKey(plaintextKey: string): string {
  return `${PREFIX}${hashKey(plaintextKey)}`;
}

export interface IApiKeyAuthCache {
  get(plaintextKey: string): Promise<{ id: string; workspaceId: string } | null>;
  set(plaintextKey: string, value: { id: string; workspaceId: string }): Promise<void>;
  invalidate(plaintextKey: string): Promise<void>;
  invalidateByApiKeyId(apiKeyId: string): Promise<void>;
}

export class ApiKeyAuthCache implements IApiKeyAuthCache {
  constructor(private readonly redis: Redis) {}

  async get(plaintextKey: string): Promise<{ id: string; workspaceId: string } | null> {
    const raw = await this.redis.get(cacheKey(plaintextKey));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as { id: string; workspaceId: string };
  }

  async set(plaintextKey: string, value: { id: string; workspaceId: string }): Promise<void> {
    const keyHash = hashKey(plaintextKey);
    await this.redis.setex(cacheKey(plaintextKey), TTL_SECONDS, JSON.stringify(value));
    await this.redis.setex(`${ID_INDEX_PREFIX}${value.id}`, TTL_SECONDS, keyHash);
  }

  async invalidate(plaintextKey: string): Promise<void> {
    const cached = await this.get(plaintextKey);
    await this.redis.del(cacheKey(plaintextKey));
    if (cached) {
      await this.redis.del(`${ID_INDEX_PREFIX}${cached.id}`);
    }
  }

  async invalidateByApiKeyId(apiKeyId: string): Promise<void> {
    const indexKey = `${ID_INDEX_PREFIX}${apiKeyId}`;
    const keyHash = await this.redis.get(indexKey);
    if (!keyHash) {
      return;
    }

    await this.redis.del(`${PREFIX}${keyHash}`, indexKey);
  }
}
