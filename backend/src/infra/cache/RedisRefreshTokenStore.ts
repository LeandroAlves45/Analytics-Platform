/**
 * Armazena refresh tokens opacos em Redis com TTL, rotação e detecção de reuse.
 *
 * Chaves Redis:
 * - `refresh:<uuid>` — payload activo `{ userId, workspaceId }`
 * - `refresh-revoked:<uuid>` — `{ userId }` TTL 5 min (detecção de reuse)
 * - `user-refresh-tokens:<userId>` — SET de tokenIds activos
 */

import type { Redis } from 'ioredis';
import type { RefreshTokenStore } from '@application/contracts/gateways';

const PREFIX = 'refresh:';
const REVOKED_PREFIX = 'refresh-revoked:';
const USER_INDEX_PREFIX = 'user-refresh-tokens:';
const REUSE_WINDOW_SECONDS = 300;

export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly redis: Redis) {}

  async store(
    tokenId: string,
    payload: { userId: string; workspaceId: string },
    ttlSeconds: number
  ): Promise<void> {
    const key = `${PREFIX}${tokenId}`;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(payload));
    await this.redis.sadd(`${USER_INDEX_PREFIX}${payload.userId}`, tokenId);
  }

  async get(tokenId: string): Promise<{ userId: string; workspaceId: string } | null> {
    const raw = await this.redis.get(`${PREFIX}${tokenId}`);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as { userId: string; workspaceId: string };
  }

  async revoke(tokenId: string): Promise<void> {
    const key = `${PREFIX}${tokenId}`;
    const raw = await this.redis.get(key);
    if (raw) {
      const payload = JSON.parse(raw) as { userId: string; workspaceId: string };
      await this.redis.srem(`${USER_INDEX_PREFIX}${payload.userId}`, tokenId);
      await this.redis.setex(
        `${REVOKED_PREFIX}${tokenId}`,
        REUSE_WINDOW_SECONDS,
        JSON.stringify({ userId: payload.userId })
      );
    }

    await this.redis.del(key);
  }

  async wasRecentlyRevoked(tokenId: string): Promise<boolean> {
    return (await this.redis.exists(`${REVOKED_PREFIX}${tokenId}`)) === 1;
  }

  async getRevokedUserId(tokenId: string): Promise<string | null> {
    const raw = await this.redis.get(`${REVOKED_PREFIX}${tokenId}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { userId: string };
    return parsed.userId ?? null;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const indexKey = `${USER_INDEX_PREFIX}${userId}`;
    const tokenIds = await this.redis.smembers(indexKey);

    if (tokenIds.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();
    for (const tokenId of tokenIds) {
      pipeline.del(`${PREFIX}${tokenId}`);
    }
    pipeline.del(indexKey);
    await pipeline.exec();
  }
}
