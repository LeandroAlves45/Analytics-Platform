/**
 * Rate limit por API key — sliding window de 1 minuto em Redis.
 */

import { Response, NextFunction } from 'express';
import type { Redis } from 'ioredis';
import type { WorkspaceRepository } from '@application/contracts/repositories';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { getRateLimitForPlan } from '@shared/constants/plans';
import type { WorkspacePlanCache } from '@infra/cache/WorkspacePlanCache';
import { AppError } from '@shared/errors';

export function createRateLimitMiddleware(
  redis: Redis,
  workspaceRepository: WorkspaceRepository,
  workspacePlanCache: WorkspacePlanCache
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.apiKeyId || !req.workspaceId) {
      next();
      return;
    }

    let plan = await workspacePlanCache.getPlan(req.workspaceId);
    if (!plan) {
      const workspace = await workspaceRepository.findById(req.workspaceId);
      plan = workspace?.plan ?? 'free';
      await workspacePlanCache.setPlan(req.workspaceId, plan);
    }

    const limit = getRateLimitForPlan(plan);

    const minuteBucket = Math.floor(Date.now() / 60_000);
    const key = `rate-limit:${req.apiKeyId}:${minuteBucket}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }

    if (count > limit) {
      res.setHeader('Retry-After', '60');
      next(new AppError('Rate limit exceeded', 'TOO_MANY_REQUESTS', 429));
      return;
    }

    next();
  };
}
