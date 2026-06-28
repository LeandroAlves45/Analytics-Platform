/**
 * Rate limit para endpoints públicos de autenticação.
 *
 * Sliding window de 1 minuto em Redis — chave por IP + tipo de endpoint.
 * Só confia em X-Forwarded-For quando Express `trust proxy` está activo.
 */

import { Request, Response, NextFunction } from 'express';
import type { Redis } from 'ioredis';
import { AppError } from '@shared/errors';

type AuthRateLimitKind = 'login' | 'register' | 'refresh';

const LIMITS: Record<AuthRateLimitKind, number> = {
  login: 10,
  register: 5,
  refresh: 20,
};

function getClientIp(req: Request): string {
  const trustProxy = Boolean(req.app.get('trust proxy'));
  if (trustProxy && typeof req.ip === 'string' && req.ip.length > 0) {
    return req.ip;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

export function createAuthRateLimitMiddleware(redis: Redis, kind: AuthRateLimitKind) {
  const limit = LIMITS[kind];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = getClientIp(req);
    const minuteBucket = Math.floor(Date.now() / 60_000);
    const key = `auth-rate-limit:${ip}:${kind}:${minuteBucket}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }

    if (count > limit) {
      res.setHeader('Retry-After', '60');
      next(new AppError('Too many requests', 'TOO_MANY_REQUESTS', 429));
      return;
    }

    next();
  };
}
