/**
 * Testes unitários do middleware de autenticação por API key.
 *
 * Cobrem: cache miss (lookup no repositório + populate cache), cache hit
 * (sem chamada ao repositório), chave inválida e header Authorization em falta.
 * Repositório e `ApiKeyAuthCache` são mockados — sem base de dados nem Redis.
 */

import { createApiKeyAuthMiddleware } from '@infra/middleware/ApiKeyAuthMiddleware';
import type { ApiKeyRepository } from '@application/contracts/repositories';
import type { ApiKeyAuthCache } from '@infra/cache/ApiKeyAuthCache';

/**
 * Cria um mock de `ApiKeyRepository` com chave não encontrada por omissão.
 *
 * @param overrides - Métodos a substituir no mock.
 */
function makeApiKeyRepository(
  overrides?: Partial<ApiKeyRepository>
): jest.Mocked<ApiKeyRepository> {
  return {
    findActiveByPlaintextKey: jest.fn().mockResolvedValue(null),
    updateLastUsed: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as jest.Mocked<ApiKeyRepository>;
}

/**
 * Cria um mock de `ApiKeyAuthCache` com entrada opcional pré-populada.
 *
 * @param cached - Par `{ id, workspaceId }` devolvido por `get`, ou `null` para cache miss.
 */
function makeApiKeyAuthCache(
  cached: { id: string; workspaceId: string } | null = null
): jest.Mocked<ApiKeyAuthCache> {
  return {
    get: jest.fn().mockResolvedValue(cached),
    set: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
    invalidateByApiKeyId: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ApiKeyAuthCache>;
}

describe('ApiKeyAuthMiddleware', () => {
  it('should inject workspaceId and apiKeyId for valid API key (cache miss)', async () => {
    const repo = makeApiKeyRepository({
      findActiveByPlaintextKey: jest.fn().mockResolvedValue({
        id: 'api-key-1',
        workspaceId: 'ws-1',
        keyHash: 'hash',
      }),
    });
    const cache = makeApiKeyAuthCache(null);

    const middleware = createApiKeyAuthMiddleware(repo, cache);
    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer apk_testkey123456' },
    };

    const next = jest.fn();

    await middleware(req as never, {} as never, next);

    expect(req).toMatchObject({ workspaceId: 'ws-1', apiKeyId: 'api-key-1' });
    expect(cache.set).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('should use cache hit without calling repository', async () => {
    const repo = makeApiKeyRepository();
    const cache = makeApiKeyAuthCache({ id: 'api-key-cached', workspaceId: 'ws-cached' });

    const middleware = createApiKeyAuthMiddleware(repo, cache);
    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer apk_cachedkey123456' },
    };

    await middleware(req as never, {} as never, jest.fn());

    expect(req).toMatchObject({ workspaceId: 'ws-cached', apiKeyId: 'api-key-cached' });
    expect(repo.findActiveByPlaintextKey).not.toHaveBeenCalled();
  });

  it('should call next with UnauthorizedError when key not found', async () => {
    const middleware = createApiKeyAuthMiddleware(makeApiKeyRepository(), makeApiKeyAuthCache());
    const req = { headers: { authorization: 'Bearer apk_notfoundkey123456' } };
    const next = jest.fn();

    await middleware(req as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should call next with UnauthorizedError when Authorization header is missing', async () => {
    const middleware = createApiKeyAuthMiddleware(makeApiKeyRepository(), makeApiKeyAuthCache());
    const req = { headers: {} };
    const next = jest.fn();

    await middleware(req as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
