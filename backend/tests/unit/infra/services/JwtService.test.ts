/**
 * Testes unitários do JwtService.
 */

import { JwtService } from '@infra/services/JwtService';
import type { Config } from '@infra/frameworks/config';
import { UnauthorizedError } from '@shared/errors';

/** Configuração mínima para instanciar JwtService nos testes. */
const makeConfig = (overrides?: Partial<Pick<Config, 'JWT_SECRET' | 'JWT_EXPIRES_IN'>>) =>
  ({
    JWT_SECRET: 'test-secret-min-32-characters-long!!',
    JWT_EXPIRES_IN: '15m',
    ...overrides,
  }) as unknown as Config;

describe('JwtService', () => {
  it('should sign a payload and return a JWT string', () => {
    const service = new JwtService(makeConfig());
    const token = service.sign({
      sub: 'user-1',
      workspaceId: 'workspace-1',
      email: 'user-1@example.com',
    });

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('should verify a valid JWT and return the payload', () => {
    const service = new JwtService(makeConfig());
    const token = service.sign({
      sub: 'user-1',
      workspaceId: 'workspace-1',
      email: 'user-1@example.com',
    });

    const payload = service.verify(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.workspaceId).toBe('workspace-1');
    expect(payload.email).toBe('user-1@example.com');
  });

  it('should throw UnauthorizedError when token is malformed', () => {
    const service = new JwtService(makeConfig());
    expect(() => service.verify('not.a.jwt')).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when token is signed with a different secret', () => {
    const signer = new JwtService(
      makeConfig({ JWT_SECRET: 'test-secret-min-32-characters-long!!' })
    );
    const verifier = new JwtService(
      makeConfig({ JWT_SECRET: 'different-secret-32-characters-long!!' })
    );

    const token = signer.sign({
      sub: 'user-1',
      workspaceId: 'workspace-1',
      email: 'user-1@example.com',
    });

    expect(() => verifier.verify(token)).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when token is expired', () => {
    // Cria token com expiração imediata
    const service = new JwtService(makeConfig({ JWT_EXPIRES_IN: '-1s' }));
    const token = service.sign({
      sub: 'user-1',
      workspaceId: 'workspace-1',
      email: 'user-1@example.com',
    });

    expect(() => service.verify(token)).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when token is an empty string', () => {
    const service = new JwtService(makeConfig());
    expect(() => service.verify('')).toThrow(UnauthorizedError);
  });

  it('should include iat and exp payload with exp greater than iat', () => {
    const service = new JwtService(makeConfig());
    const token = service.sign({
      sub: 'user-1',
      workspaceId: 'workspace-1',
      email: 'user-1@example.com',
    });

    const payload = service.verify(token);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp!).toBeGreaterThan(payload.iat!);
  });

  it('should return payload with exactly the expected claims after verification', () => {
    const service = new JwtService(makeConfig());
    const token = service.sign({
      sub: 'user-1',
      workspaceId: 'workspace-1',
      email: 'user-1@example.com',
    });

    const payload = service.verify(token);
    expect(payload).toMatchObject({
      sub: 'user-1',
      workspaceId: 'workspace-1',
      email: 'user-1@example.com',
    });
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });
});
