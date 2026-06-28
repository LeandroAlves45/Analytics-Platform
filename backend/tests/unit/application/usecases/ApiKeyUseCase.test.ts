/**
 * Testes unitários dos use cases de API keys.
 *
 * Cobrem: CreateApiKeyUseCase (geração e armazenamento só do hash),
 * ListApiKeysUseCase (listagem por workspace) e RevokeApiKeyUseCase
 * (revogação com invalidação de cache e autorização por membro).
 * Repositórios e cache são mockados — sem base de dados nem Redis.
 */

import { CreateApiKeyUseCase } from '@application/usecases/workspaces/CreateApiKeyUseCase';
import { ListApiKeysUseCase } from '@application/usecases/workspaces/ListApiKeysUseCase';
import { RevokeApiKeyUseCase } from '@application/usecases/workspaces/RevokeApiKeyUseCase';
import type { ApiKeyRepository, WorkspaceRepository } from '@application/contracts/repositories';
import type { ApiKeyAuthCache } from '@infra/cache/ApiKeyAuthCache';
import { ForbiddenError, NotFoundError } from '@shared/errors';

/** UUID de workspace válido usado nos inputs de teste. */
const TEST_WORKSPACE_UUID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Cria um mock de `ApiKeyRepository` com comportamento por omissão (sem chaves).
 *
 * @param overrides - Métodos a substituir no mock.
 */
function makeApiKeyRepository(
  overrides?: Partial<ApiKeyRepository>
): jest.Mocked<ApiKeyRepository> {
  return {
    save: jest.fn().mockResolvedValue({
      id: 'api-key-1',
      workspaceId: 'ws-1',
      name: 'Test API Key',
      keyPreview: 'abcd1234',
      status: 'active',
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
    }),
    findByWorkspace: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findActiveByPlaintextKey: jest.fn().mockResolvedValue(null),
    updateLastUsed: jest.fn().mockResolvedValue(undefined),
    revoke: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<ApiKeyRepository>;
}

/**
 * Mock de `WorkspaceRepository` com controlo de membership.
 *
 * @param isMember - Se o utilizador pertence ao workspace (default: true).
 */
function makeWorkspaceRepository(isMember = true): jest.Mocked<WorkspaceRepository> {
  return {
    isMember: jest.fn().mockResolvedValue(isMember),
  } as unknown as jest.Mocked<WorkspaceRepository>;
}

/** Mock de `ApiKeyAuthCache` com cache vazio por omissão. */
function makeApiKeyAuthCache(): jest.Mocked<ApiKeyAuthCache> {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
    invalidateByApiKeyId: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ApiKeyAuthCache>;
}

// CreateApiKeyUseCase
describe('CreateApiKeyUseCase', () => {
  it('should create api key and return plaintext key once', async () => {
    const repo = makeApiKeyRepository();
    const useCase = new CreateApiKeyUseCase(repo, makeWorkspaceRepository());

    const result = await useCase.execute({
      workspaceId: TEST_WORKSPACE_UUID,
      userId: 'user-1',
      name: 'Prod SDK',
    });

    expect(result.plaintextKey).toMatch(/^apk_/);
    expect(result.keyPreview).toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('should never store plaintext key - only hash is stored', async () => {
    const repo = makeApiKeyRepository();
    const useCase = new CreateApiKeyUseCase(repo, makeWorkspaceRepository());

    await useCase.execute({
      workspaceId: TEST_WORKSPACE_UUID,
      userId: 'user-1',
      name: 'Dev Key',
    });

    const savedArgs = (repo.save as jest.Mock).mock.calls[0][0];
    expect(savedArgs.keyHash).toBeDefined();
    expect(savedArgs.keyHash).not.toMatch(/^apk_/);
  });

  it('should throw ForbiddenError when user is not a member of workspace', async () => {
    const useCase = new CreateApiKeyUseCase(makeApiKeyRepository(), makeWorkspaceRepository(false));

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_UUID,
        userId: 'user-1',
        name: 'Prod SDK',
      })
    ).rejects.toThrow(ForbiddenError);
  });
});

// ListApiKeysUseCase
describe('ListApiKeysUseCase', () => {
  it('should return api keys for workspace', async () => {
    const keys = [
      { id: 'api-key-1', workspaceId: 'ws-1', name: 'Key 1', status: 'active' },
      { id: 'api-key-2', workspaceId: 'ws-1', name: 'Key 2', status: 'active' },
    ];
    const repo = makeApiKeyRepository({ findByWorkspace: jest.fn().mockResolvedValue(keys) });
    const useCase = new ListApiKeysUseCase(repo, makeWorkspaceRepository());

    const result = await useCase.execute({ workspaceId: 'ws-1', userId: 'user-1' });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Key 1');
  });

  it('should return empty array when no keys exist', async () => {
    const useCase = new ListApiKeysUseCase(makeApiKeyRepository(), makeWorkspaceRepository());

    const result = await useCase.execute({ workspaceId: 'ws-1', userId: 'user-1' });
    expect(result).toEqual([]);
  });

  it('should throw ForbiddenError when user is not a member of workspace', async () => {
    const useCase = new ListApiKeysUseCase(makeApiKeyRepository(), makeWorkspaceRepository(false));

    await expect(useCase.execute({ workspaceId: 'ws-1', userId: 'user-1' })).rejects.toThrow(
      ForbiddenError
    );
  });
});

// RevokeApiKeyUseCase
describe('RevokeApiKeyUseCase', () => {
  it('should revoke api key and invalidate cache', async () => {
    const repo = makeApiKeyRepository({
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'api-key-1', workspaceId: 'ws-1', status: 'active' }),
    });
    const cache = makeApiKeyAuthCache();
    const useCase = new RevokeApiKeyUseCase(repo, makeWorkspaceRepository(), cache);

    await useCase.execute({ apiKeyId: 'api-key-1', workspaceId: 'ws-1', userId: 'user-1' });

    expect(repo.revoke).toHaveBeenCalledWith('api-key-1', 'ws-1');
    expect(cache.invalidateByApiKeyId).toHaveBeenCalledWith('api-key-1');
  });

  it('should throw NotFoundError when api key does not exist', async () => {
    const repo = makeApiKeyRepository({ findById: jest.fn().mockResolvedValue(null) });
    const useCase = new RevokeApiKeyUseCase(repo, makeWorkspaceRepository(), makeApiKeyAuthCache());

    await expect(
      useCase.execute({ apiKeyId: 'api-key-1', workspaceId: 'ws-1', userId: 'user-1' })
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ForbiddenError when user is not a member of workspace', async () => {
    const useCase = new RevokeApiKeyUseCase(
      makeApiKeyRepository(),
      makeWorkspaceRepository(false),
      makeApiKeyAuthCache()
    );

    await expect(
      useCase.execute({ apiKeyId: 'api-key-1', workspaceId: 'ws-1', userId: 'user-1' })
    ).rejects.toThrow(ForbiddenError);
  });
});
