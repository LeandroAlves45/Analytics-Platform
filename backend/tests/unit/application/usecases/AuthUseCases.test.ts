/**
 * Testes unitários dos use cases de autenticação.
 *
 * Cobrem: RegisterUserUseCase, LoginUserUseCase e RefreshTokenUseCase.
 * Todas as dependências externas (repositórios, JWT, Redis refresh store, bcrypt)
 * são mockadas — sem base de dados, sem Redis, sem rede.
 *
 * Foco: orquestração de registo/login/refresh, emissão de tokens, rotação de
 * refresh tokens, detecção de reutilização (token reuse) e erros de domínio.
 */

import bcrypt from 'bcryptjs';
import { RegisterUserUseCase } from '@application/usecases/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '@application/usecases/auth/LoginUserUseCase';
import { RefreshTokenUseCase } from '@application/usecases/auth/RefreshTokenUseCase';
import type { UserRepository, WorkspaceRepository } from '@application/contracts/repositories';
import type { RefreshTokenStore } from '@application/contracts/gateways';
import { JwtService } from '@infra/services/JwtService';
import { ConflictError, UnauthorizedError, NotFoundError } from '@shared/errors';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

/** TTL de refresh token padrão para testes (7 dias em segundos). */
const REFRESH_TTL = 604800;

/** UUID fixo usado como id devolvido pelo mock de `UserRepository.save`. */
const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';

/** Valor de jwtExpiresIn que os use cases injectam na resposta (ADJUST_01). */
const JWT_EXPIRES_IN = '15m';

/**
 * Cria um mock de `UserRepository` com comportamento por omissão (utilizador não encontrado).
 *
 * @param overrides - Métodos a substituir no mock (ex.: `findByEmail` com utilizador existente).
 */
function makeUserRepository(
  overrides?: Partial<jest.Mocked<UserRepository>>
): jest.Mocked<UserRepository> {
  return {
    save: jest.fn().mockResolvedValue({
      id: TEST_USER_ID,
      email: 'a@b.com',
      name: 'Test User',
      passwordHash: '$2a$12$mocked',
    }),
    findByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as jest.Mocked<UserRepository>;
}
/**
 * Cria um mock de `RefreshTokenStore` em memória para unit tests.
 * Inclui métodos de detecção de reutilização de refresh token.
 *
 * @param overrides - Métodos a substituir no mock (ex.: `get` com payload armazenado).
 */
function makeRefreshTokenStore(
  overrides?: Partial<RefreshTokenStore>
): jest.Mocked<RefreshTokenStore> {
  return {
    store: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    revoke: jest.fn().mockResolvedValue(undefined),
    wasRecentlyRevoked: jest.fn().mockResolvedValue(false),
    getRevokedUserId: jest.fn().mockResolvedValue(null),
    revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<RefreshTokenStore>;
}

describe('RegisterUserUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw ConflictError when email is already registered', async () => {
    const userRepo = makeUserRepository({
      findByEmail: jest.fn().mockResolvedValue({ id: 'existing-user' }),
    });
    const useCase = new RegisterUserUseCase(
      userRepo,
      {} as WorkspaceRepository,
      {} as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(
      useCase.execute({
        email: 'a@b.com',
        password: 'password123',
        name: 'Test User',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should create user and workspace and return tokens on success', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$mocked');

    const workspaceRepo = {
      save: jest.fn().mockResolvedValue({
        id: 'ws-1',
        name: 'Test Workspace',
        slug: 'test-workspace',
        plan: 'free',
      }),
      addMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceRepository;

    const jwtService = {
      sign: jest.fn().mockReturnValue('access-token'),
    } as unknown as JwtService;

    const refreshTokenStore = makeRefreshTokenStore({
      store: jest.fn().mockResolvedValue(undefined),
    });

    const useCase = new RegisterUserUseCase(
      makeUserRepository(),
      workspaceRepo,
      jwtService,
      refreshTokenStore,
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    const result = await useCase.execute({
      email: 'new@example.com',
      password: 'password123',
      name: 'Test',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toMatch(/^rt_/);
    expect(result.expiresIn).toBe(JWT_EXPIRES_IN);
    expect(result.workspace.plan).toBe('free');
    expect(refreshTokenStore.store).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userId: TEST_USER_ID }),
      REFRESH_TTL
    );
  });

  it('should use workspaceName from input when provided', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$mocked');

    const workspaceRepo = {
      save: jest.fn().mockResolvedValue({
        id: 'ws-custom',
        name: 'My Company',
        slug: 'my-company',
        plan: 'free',
      }),
      addMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceRepository;

    const useCase = new RegisterUserUseCase(
      makeUserRepository(),
      workspaceRepo,
      { sign: jest.fn().mockReturnValue('tok') } as unknown as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    const result = await useCase.execute({
      email: 'a@b.com',
      password: 'password123',
      name: 'Test',
      workspaceName: 'My Company',
    });

    expect(result.workspace.name).toBe('My Company');
  });

  it('should derive default workspace name from input.name when workspaceName is not provided', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$mocked');

    const workspaceRepo = {
      save: jest.fn().mockResolvedValue({
        id: 'ws-1',
        name: "Test's Workspace",
        slug: 'tests-workspace',
        plan: 'free',
      }),
      addMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceRepository;

    const useCase = new RegisterUserUseCase(
      makeUserRepository(),
      workspaceRepo,
      { sign: jest.fn().mockReturnValue('tok') } as unknown as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await useCase.execute({ email: 'a@b.com', password: 'password123', name: 'Test' });

    const savedWorkspaceName = (workspaceRepo as jest.Mocked<WorkspaceRepository>).save.mock
      .calls[0][0].name;
    expect(savedWorkspaceName).toBe("Test's Workspace");
  });

  it('should return empty name in response when user name is null', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$mocked');

    const userRepo = makeUserRepository({
      save: jest.fn().mockResolvedValue({
        id: TEST_USER_ID,
        email: 'a@b.com',
        name: null,
        passwordHash: '$2a$12$mocked',
      }),
    });

    const useCase = new RegisterUserUseCase(
      userRepo,
      {
        save: jest.fn().mockResolvedValue({ id: 'ws-1', name: 'WS', slug: 'ws', plan: 'free' }),
        addMember: jest.fn().mockResolvedValue(undefined),
      } as unknown as WorkspaceRepository,
      { sign: jest.fn().mockReturnValue('tok') } as unknown as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    const result = await useCase.execute({
      email: 'a@b.com',
      password: 'password123',
      name: null as unknown as string,
    });

    expect(result.user.name).toBe('');
  });

  it('should add user as owner of the workspace after creation', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$mocked');

    const workspaceRepo = {
      save: jest.fn().mockResolvedValue({ id: 'ws-99', name: 'WS', slug: 'ws', plan: 'free' }),
      addMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceRepository;

    const useCase = new RegisterUserUseCase(
      makeUserRepository(),
      workspaceRepo,
      { sign: jest.fn().mockReturnValue('tok') } as unknown as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await useCase.execute({ email: 'a@b.com', password: 'password123', name: 'Test' });

    expect((workspaceRepo as jest.Mocked<WorkspaceRepository>).addMember).toHaveBeenCalledWith(
      'ws-99',
      TEST_USER_ID,
      'owner'
    );
  });
});

// LoginUserUseCase

/** Utilizador activo simulado com hash pré-definido para testes de login. */
const mockUserForLogin = {
  id: 'user-1',
  email: { value: 'a@b.com' },
  passwordHash: '$2a$12$hashedpassword',
  name: 'Test User',
  status: 'active',
  getInitials: () => 'TU',
};

/** Variante de `mockUserForLogin` com conta suspensa — usada para testar `assertActiveUser`. */
const mockSuspendedUser = {
  ...mockUserForLogin,
  status: 'suspended',
};

describe('LoginUserUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw UnauthorizedError when user is not found', async () => {
    const useCase = new LoginUserUseCase(
      makeUserRepository(),
      {} as WorkspaceRepository,
      {} as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(
      useCase.execute({ email: 'unknown@example.com', password: 'password123' })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError for wrong password', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const userRepo = makeUserRepository({
      findByEmail: jest.fn().mockResolvedValue(mockUserForLogin),
    });
    const useCase = new LoginUserUseCase(
      userRepo,
      {} as WorkspaceRepository,
      {} as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ email: 'a@b.com', password: 'wrongpass' })).rejects.toThrow(
      UnauthorizedError
    );
  });

  it('should throw NotFoundError when workspace does not exist', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const userRepo = makeUserRepository({
      findByEmail: jest.fn().mockResolvedValue(mockUserForLogin),
    });
    const workspaceRepo = {
      findByUserId: jest.fn().mockResolvedValue(null),
    } as unknown as WorkspaceRepository;
    const useCase = new LoginUserUseCase(
      userRepo,
      workspaceRepo,
      {} as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ email: 'a@b.com', password: 'password123' })).rejects.toThrow(
      NotFoundError
    );
  });

  it('should throw UnauthorizedError when user status is not active', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const useCase = new LoginUserUseCase(
      makeUserRepository({ findByEmail: jest.fn().mockResolvedValue(mockSuspendedUser) }),
      {} as WorkspaceRepository,
      {} as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ email: 'a@b.com', password: 'password123' })).rejects.toThrow(
      UnauthorizedError
    );
  });

  it('should return tokens on valid credentials', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const workspaceRepo = {
      findByUserId: jest.fn().mockResolvedValue({
        id: 'ws-1',
        name: 'WS',
        slug: 'ws',
        plan: 'free',
      }),
    } as unknown as WorkspaceRepository;

    const jwtService = {
      sign: jest.fn().mockReturnValue('access-token-jwt'),
    } as unknown as JwtService;

    const refreshTokenStore = makeRefreshTokenStore({
      store: jest.fn().mockResolvedValue(undefined),
    });

    const useCase = new LoginUserUseCase(
      makeUserRepository({ findByEmail: jest.fn().mockResolvedValue(mockUserForLogin) }),
      workspaceRepo,
      jwtService,
      refreshTokenStore,
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    const result = await useCase.execute({ email: 'a@b.com', password: 'password123' });

    expect(result.accessToken).toBe('access-token-jwt');
    expect(result.refreshToken).toMatch(/^rt_/);
    expect(result.expiresIn).toBe(JWT_EXPIRES_IN);
    expect(result.workspace.plan).toBe('free');
    expect(refreshTokenStore.store).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userId: 'user-1', workspaceId: 'ws-1' }),
      REFRESH_TTL
    );
  });

  it('should throw UnauthorizedError when user is deleted', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const deletedUser = { ...mockUserForLogin, status: 'deleted' };
    const useCase = new LoginUserUseCase(
      makeUserRepository({ findByEmail: jest.fn().mockResolvedValue(deletedUser) }),
      {} as WorkspaceRepository,
      {} as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ email: 'a@b.com', password: 'password123' })).rejects.toThrow(
      UnauthorizedError
    );
  });

  it('should return empty name in response when user name is null', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const userWithNullName = { ...mockUserForLogin, name: null };

    const workspaceRepo = {
      findByUserId: jest.fn().mockResolvedValue({
        id: 'ws-1',
        name: 'WS',
        slug: 'ws',
        plan: 'free',
      }),
    } as unknown as WorkspaceRepository;

    const useCase = new LoginUserUseCase(
      makeUserRepository({ findByEmail: jest.fn().mockResolvedValue(userWithNullName) }),
      workspaceRepo,
      { sign: jest.fn().mockReturnValue('access-token-jwt') } as unknown as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    const result = await useCase.execute({ email: 'a@b.com', password: 'password123' });

    expect(result.user.name).toBe('');
  });

  it('should throw UnauthorizedError when user status is deleted', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const deletedUser = { ...mockUserForLogin, status: 'deleted' };
    const useCase = new LoginUserUseCase(
      makeUserRepository({ findByEmail: jest.fn().mockResolvedValue(deletedUser) }),
      {} as WorkspaceRepository,
      {} as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ email: 'a@b.com', password: 'password123' })).rejects.toThrow(
      'Invalid credentials'
    );
  });
});

// RefreshTokenUseCase

describe('RefreshTokenUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw UnauthorizedError when token format is invalid', async () => {
    const useCase = new RefreshTokenUseCase(
      {} as UserRepository,
      {} as JwtService,
      makeRefreshTokenStore(),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ refreshToken: 'invalid-token' })).rejects.toThrow(
      UnauthorizedError
    );
  });

  it('should throw UnauthorizedError when token is expired or revoked', async () => {
    const useCase = new RefreshTokenUseCase(
      {} as UserRepository,
      {} as JwtService,
      makeRefreshTokenStore({ get: jest.fn().mockResolvedValue(null) }),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(
      useCase.execute({
        refreshToken: 'rt_00000000-0000-0000-0000-000000000000',
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should rotate token: store new token and revoke old one', async () => {
    const storedPayload = { userId: 'user-1', workspaceId: 'ws-1' };

    const userRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: { value: 'a@b.com' },
        name: 'Test',
        status: 'active',
        getInitials: () => 'T',
      }),
    } as unknown as UserRepository;

    const jwtService = {
      sign: jest.fn().mockReturnValue('new-access-token'),
    } as unknown as JwtService;

    const tokenId = '11111111-1111-1111-1111-111111111111';
    const storeCallOrder: string[] = [];
    const refreshTokenStore = makeRefreshTokenStore({
      get: jest.fn().mockResolvedValue(storedPayload),
      revoke: jest.fn().mockImplementation(() => {
        storeCallOrder.push('revoke');
        return Promise.resolve();
      }),
      store: jest.fn().mockImplementation(() => {
        storeCallOrder.push('store');
        return Promise.resolve();
      }),
    });

    const useCase = new RefreshTokenUseCase(
      userRepo,
      jwtService,
      refreshTokenStore,
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );
    const result = await useCase.execute({ refreshToken: `rt_${tokenId}` });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toMatch(/^rt_/);
    expect(result.expiresIn).toBe(JWT_EXPIRES_IN);
    expect(storeCallOrder).toEqual(['store', 'revoke']);
    expect(refreshTokenStore.revoke).toHaveBeenCalledWith(tokenId);
    expect(refreshTokenStore.store).toHaveBeenCalledWith(
      expect.any(String),
      storedPayload,
      REFRESH_TTL
    );
  });

  it('should revoke all user sessions when reused token was recently revoked', async () => {
    const tokenId = '22222222-2222-2222-2222-222222222222';
    const refreshTokenStore = makeRefreshTokenStore({
      get: jest.fn().mockResolvedValue(null),
      wasRecentlyRevoked: jest.fn().mockResolvedValue(true),
      getRevokedUserId: jest.fn().mockResolvedValue('user-1'),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    });

    const useCase = new RefreshTokenUseCase(
      {} as UserRepository,
      {} as JwtService,
      refreshTokenStore,
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ refreshToken: `rt_${tokenId}` })).rejects.toThrow(
      'Session invalidated due to token reuse'
    );

    expect(refreshTokenStore.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('should not call revokeAllForUser when reused token has no associated userId', async () => {
    const tokenId = '33333333-3333-3333-3333-333333333333';
    const refreshTokenStore = makeRefreshTokenStore({
      get: jest.fn().mockResolvedValue(null),
      wasRecentlyRevoked: jest.fn().mockResolvedValue(true),
      getRevokedUserId: jest.fn().mockResolvedValue(null),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    });

    const useCase = new RefreshTokenUseCase(
      {} as UserRepository,
      {} as JwtService,
      refreshTokenStore,
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ refreshToken: `rt_${tokenId}` })).rejects.toThrow(
      'Session invalidated due to token reuse'
    );

    expect(refreshTokenStore.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedError when stored token references deleted user', async () => {
    const tokenId = '55555555-5555-5555-5555-555555555555';
    const useCase = new RefreshTokenUseCase(
      { findById: jest.fn().mockResolvedValue(null) } as unknown as UserRepository,
      {} as JwtService,
      makeRefreshTokenStore({
        get: jest.fn().mockResolvedValue({ userId: 'user-deleted', workspaceId: 'ws-1' }),
      }),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ refreshToken: `rt_${tokenId}` })).rejects.toThrow(
      'User not found'
    );
  });

  it('should throw UnauthorizedError when user is suspended at refresh time', async () => {
    const tokenId = '44444444-4444-4444-4444-444444444444';
    const suspendedUser = {
      id: 'user-1',
      email: { value: 'a@b.com' },
      name: 'Test',
      status: 'suspended',
      getInitials: () => 'T',
    };

    const useCase = new RefreshTokenUseCase(
      { findById: jest.fn().mockResolvedValue(suspendedUser) } as unknown as UserRepository,
      {} as JwtService,
      makeRefreshTokenStore({
        get: jest.fn().mockResolvedValue({ userId: 'user-1', workspaceId: 'ws-1' }),
      }),
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ refreshToken: `rt_${tokenId}` })).rejects.toThrow(
      UnauthorizedError
    );
  });

  it('should throw UnauthorizedError when user is suspended at refresh time', async () => {
    const tokenId = '33333333-3333-3333-3333-333333333333';
    const suspendedUser = {
      id: 'user-1',
      email: { value: 'a@b.com' },
      name: 'Suspended',
      status: 'suspended',
      getInitials: () => 'S',
    };

    const userRepo = {
      findById: jest.fn().mockResolvedValue(suspendedUser),
    } as unknown as UserRepository;

    const refreshTokenStore = makeRefreshTokenStore({
      get: jest.fn().mockResolvedValue({ userId: 'user-1', workspaceId: 'ws-1' }),
    });

    const useCase = new RefreshTokenUseCase(
      userRepo,
      {} as JwtService,
      refreshTokenStore,
      REFRESH_TTL,
      JWT_EXPIRES_IN
    );

    await expect(useCase.execute({ refreshToken: `rt_${tokenId}` })).rejects.toThrow(
      'Invalid credentials'
    );
  });
});
