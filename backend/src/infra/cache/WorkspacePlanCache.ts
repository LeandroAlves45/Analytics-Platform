/**
 * Cache workspaceId → plan para rate limiting sem DB hit por request.
 */

import type { Redis } from 'ioredis';

const PREFIX = 'workspace-plan:';
const TTL_SECONDS = 300; // 5 minutes

export class WorkspacePlanCache {
  constructor(private readonly redis: Redis) {}

  async getPlan(workspaceId: string): Promise<string | null> {
    return this.redis.get(`${PREFIX}${workspaceId}`);
  }

  async setPlan(workspaceId: string, plan: string): Promise<void> {
    await this.redis.setex(`${PREFIX}${workspaceId}`, TTL_SECONDS, plan);
  }

  async invalidate(workspaceId: string): Promise<void> {
    await this.redis.del(`${PREFIX}${workspaceId}`);
  }
}
