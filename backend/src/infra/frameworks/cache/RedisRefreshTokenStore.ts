/**
 * Armazena refresh tokens opacos em Redis com TTL.
 */

import type { Redis } from 'ioredis';
import type { RefreshTokenStore } from '@application/contracts/gateways';

const PREFIX = 'refresh:';

export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly redis: Redis) {}

  async store(
    tokenId: string,
    payload: { userId: string; workspaceId: string },
    ttlSeconds: number
  ): Promise<void> {
    await this.redis.setex(`${PREFIX}${tokenId}`, ttlSeconds, JSON.stringify(payload));
  }

  async get(tokenId: string): Promise<{ userId: string; workspaceId: string } | null> {
    const raw = await this.redis.get(`${PREFIX}${tokenId}`);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as { userId: string; workspaceId: string };
  }

  async revoke(tokenId: string): Promise<void> {
    await this.redis.del(`${PREFIX}${tokenId}`);
  }
}
