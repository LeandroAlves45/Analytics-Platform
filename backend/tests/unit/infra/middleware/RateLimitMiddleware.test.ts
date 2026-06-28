/**
 * Testes unitários do RateLimitMiddleware.
 *
 * Cobrem: bypass quando sem contexto auth, rate limit excedido (429 + Retry-After),
 * cache miss com fallback ao repositório, diferenciação de limites por plano.
 * Redis e WorkspacePlanCache são mockados — sem I/O real.
 */

import { createRateLimitMiddleware } from '@infra/middleware/RateLimitMiddleware';
import type { WorkspaceRepository } from '@application/contracts/repositories';
import type { WorkspacePlanCache } from '@infra/cache/WorkspacePlanCache';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import type { Response, NextFunction } from 'express';
import { AppError } from '@shared/errors';

function makeRedis(overrides: { incr?: jest.Mock; expire?: jest.Mock } = {}) {
  return {
    incr: overrides.incr ?? jest.fn().mockResolvedValue(1),
    expire: overrides.expire ?? jest.fn().mockResolvedValue(1),
  };
}

function makeWorkspaceRepo(plan = 'free'): jest.Mocked<Pick<WorkspaceRepository, 'findById'>> {
  return {
    findById: jest.fn().mockResolvedValue({ id: 'ws-1', plan }),
  } as jest.Mocked<Pick<WorkspaceRepository, 'findById'>>;
}

function makePlanCache(cachedPlan: string | null = null): jest.Mocked<WorkspacePlanCache> {
  return {
    getPlan: jest.fn().mockResolvedValue(cachedPlan),
    setPlan: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<WorkspacePlanCache>;
}

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { apiKeyId: 'key-1', workspaceId: 'ws-1', ...overrides } as AuthenticatedRequest;
}

function makeRes(): { res: jest.Mocked<Response>; setHeader: jest.Mock } {
  const setHeader = jest.fn();
  return { res: { setHeader } as unknown as jest.Mocked<Response>, setHeader };
}

describe('RateLimitMiddleware', () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    next = jest.fn();
  });

  it('should call next() without rate limiting when apiKeyId is missing', async () => {
    const middleware = createRateLimitMiddleware(
      makeRedis() as never,
      makeWorkspaceRepo() as unknown as WorkspaceRepository,
      makePlanCache()
    );
    const { res } = makeRes();

    await middleware(makeReq({ apiKeyId: undefined }), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should call next() without rate limiting when workspaceId is missing', async () => {
    const middleware = createRateLimitMiddleware(
      makeRedis() as never,
      makeWorkspaceRepo() as unknown as WorkspaceRepository,
      makePlanCache()
    );
    const { res } = makeRes();

    await middleware(makeReq({ workspaceId: undefined }), res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should allow request when under rate limit', async () => {
    const middleware = createRateLimitMiddleware(
      makeRedis({ incr: jest.fn().mockResolvedValue(50) }) as never,
      makeWorkspaceRepo() as unknown as WorkspaceRepository,
      makePlanCache('free')
    );
    const { res } = makeRes();

    await middleware(makeReq(), res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with AppError 429 and set Retry-After header when limit exceeded', async () => {
    const middleware = createRateLimitMiddleware(
      makeRedis({ incr: jest.fn().mockResolvedValue(101) }) as never,
      makeWorkspaceRepo() as unknown as WorkspaceRepository,
      makePlanCache('free')
    );
    const { res, setHeader } = makeRes();

    await middleware(makeReq(), res, next);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(429);
  });

  it('should fall back to repository and cache the plan on cache miss', async () => {
    const repo = makeWorkspaceRepo('pro');
    const cache = makePlanCache(null);
    const middleware = createRateLimitMiddleware(
      makeRedis() as never,
      repo as unknown as WorkspaceRepository,
      cache
    );
    const { res } = makeRes();

    await middleware(makeReq(), res, next);

    expect(repo.findById).toHaveBeenCalledWith('ws-1');
    expect(cache.setPlan).toHaveBeenCalledWith('ws-1', 'pro');
  });

  it('should not query repository when plan is already cached', async () => {
    const repo = makeWorkspaceRepo('pro');
    const cache = makePlanCache('pro');
    const middleware = createRateLimitMiddleware(
      makeRedis() as never,
      repo as unknown as WorkspaceRepository,
      cache
    );
    const { res } = makeRes();

    await middleware(makeReq(), res, next);

    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('should apply higher limit for pro plan (1000 req/min)', async () => {
    const middleware = createRateLimitMiddleware(
      makeRedis({ incr: jest.fn().mockResolvedValue(500) }) as never,
      makeWorkspaceRepo('pro') as unknown as WorkspaceRepository,
      makePlanCache('pro')
    );
    const { res } = makeRes();

    await middleware(makeReq(), res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
