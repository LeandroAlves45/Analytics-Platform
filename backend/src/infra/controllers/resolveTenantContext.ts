/**
 * Resolução de contexto multi-tenant — split ingestão vs dashboard.
 *
 * `resolveIngestContext`: POST /api/metrics (API key) — exige workspaceId + apiKeyId.
 * `resolveDashboardContext`: rotas JWT — exige workspaceId + userId.
 *
 * Em produção e desenvolvimento, contexto em falta lança UnauthorizedError.
 * Fallbacks com UUIDs fixos existem **apenas** em `NODE_ENV=test` — ver comentários inline.
 */

import { UnauthorizedError } from '@shared/errors';
import type { AuthenticatedRequest } from './authenticatedRequest';

/**
 * UUIDs de fallback usados exclusivamente quando `NODE_ENV === 'test'`.
 * Permitem testes unitários de controllers sem montar middleware JWT/API key completo.
 */
export const DEV_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
export const DEV_API_KEY_ID = '660e8400-e29b-41d4-a716-446655440001';
export const DEV_USER_ID = '440e8400-e29b-41d4-a716-446655440000';

/**
 * Contexto para POST /api/metrics — ingestão via API key.
 *
 * @throws {UnauthorizedError} Sem workspaceId + apiKeyId fora de `NODE_ENV=test`.
 */
export function resolveIngestContext(req: AuthenticatedRequest): {
  workspaceId: string;
  apiKeyId: string;
} {
  if (req.workspaceId && req.apiKeyId) {
    return { workspaceId: req.workspaceId, apiKeyId: req.apiKeyId };
  }

  // Jest define NODE_ENV=test automaticamente. Fallback evita repetir middleware
  // em testes unitários de controllers que invocam resolveIngestContext directamente.
  // Em development/production este ramo nunca corre — auth real é obrigatória.
  if (process.env.NODE_ENV === 'test') {
    return {
      workspaceId: req.workspaceId ?? DEV_WORKSPACE_ID,
      apiKeyId: req.apiKeyId ?? DEV_API_KEY_ID,
    };
  }

  throw new UnauthorizedError('API key authentication required');
}

/**
 * Contexto para rotas dashboard/billing — sessão JWT.
 *
 * @throws {UnauthorizedError} Sem workspaceId + userId fora de `NODE_ENV=test`.
 */
export function resolveDashboardContext(req: AuthenticatedRequest): {
  workspaceId: string;
  userId: string;
} {
  if (req.workspaceId && req.userId) {
    return { workspaceId: req.workspaceId, userId: req.userId };
  }

  if (process.env.NODE_ENV === 'test') {
    return {
      workspaceId: req.workspaceId ?? DEV_WORKSPACE_ID,
      userId: req.userId ?? DEV_USER_ID,
    };
  }

  throw new UnauthorizedError('JWT authentication required');
}

/** @deprecated Usar resolveIngestContext ou resolveDashboardContext. */
export function resolveTenantContext(req: AuthenticatedRequest) {
  return resolveIngestContext(req);
}
