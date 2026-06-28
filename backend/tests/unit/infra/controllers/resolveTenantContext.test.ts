/**
 * Testes unitários de resolveTenantContext.
 *
 * Cobrem: resolveIngestContext e resolveDashboardContext — garantem que o
 * fallback UUID só actua em NODE_ENV=test e que produção/desenvolvimento
 * lançam UnauthorizedError quando o contexto auth está ausente.
 * Crítico: estas funções são a guarda de autenticação principal de todas as rotas.
 */

import {
  resolveIngestContext,
  resolveDashboardContext,
  resolveTenantContext,
  DEV_WORKSPACE_ID,
  DEV_API_KEY_ID,
  DEV_USER_ID,
} from '@infra/controllers/resolveTenantContext';
import { UnauthorizedError } from '@shared/errors';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';

const originalNodeEnv = process.env.NODE_ENV;

function req(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return overrides as AuthenticatedRequest;
}

describe('resolveIngestContext', () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should return workspaceId and apiKeyId from request when both are present', () => {
    const result = resolveIngestContext(req({ workspaceId: 'ws-uuid', apiKeyId: 'key-uuid' }));
    expect(result).toEqual({ workspaceId: 'ws-uuid', apiKeyId: 'key-uuid' });
  });

  it('should use fallback UUIDs in test environment when context is missing', () => {
    process.env.NODE_ENV = 'test';
    const result = resolveIngestContext(req({}));
    expect(result.workspaceId).toBe(DEV_WORKSPACE_ID);
    expect(result.apiKeyId).toBe(DEV_API_KEY_ID);
  });

  it('should throw UnauthorizedError in production when context is missing', () => {
    process.env.NODE_ENV = 'production';
    expect(() => resolveIngestContext(req({}))).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError in development when context is missing', () => {
    process.env.NODE_ENV = 'development';
    expect(() => resolveIngestContext(req({}))).toThrow(UnauthorizedError);
  });

  it('should not use fallback when only workspaceId is missing (apiKeyId present)', () => {
    process.env.NODE_ENV = 'production';
    expect(() => resolveIngestContext(req({ apiKeyId: 'key-uuid' }))).toThrow(UnauthorizedError);
  });
});

describe('resolveDashboardContext', () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should return workspaceId and userId from request when both are present', () => {
    const result = resolveDashboardContext(req({ workspaceId: 'ws-uuid', userId: 'user-uuid' }));
    expect(result).toEqual({ workspaceId: 'ws-uuid', userId: 'user-uuid' });
  });

  it('should use fallback UUIDs in test environment when context is missing', () => {
    process.env.NODE_ENV = 'test';
    const result = resolveDashboardContext(req({}));
    expect(result.workspaceId).toBe(DEV_WORKSPACE_ID);
    expect(result.userId).toBe(DEV_USER_ID);
  });

  it('should throw UnauthorizedError in production when context is missing', () => {
    process.env.NODE_ENV = 'production';
    expect(() => resolveDashboardContext(req({}))).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError in development when context is missing', () => {
    process.env.NODE_ENV = 'development';
    expect(() => resolveDashboardContext(req({}))).toThrow(UnauthorizedError);
  });
});

describe('resolveTenantContext (deprecated)', () => {
  it('should delegate to resolveIngestContext and return the same result', () => {
    const result = resolveTenantContext(req({ workspaceId: 'ws-uuid', apiKeyId: 'key-uuid' }));
    expect(result).toEqual({ workspaceId: 'ws-uuid', apiKeyId: 'key-uuid' });
  });
});
