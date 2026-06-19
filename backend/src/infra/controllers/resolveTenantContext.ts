/**
 * Resolução de contexto multi-tenant — split ingestão vs dashboard.
 *
 * resolveIngestContext: POST /api/metrics (API key)
 * resolveDashboardContext: rotas de leitura e billing (JWT)
 */

import { UnauthorizedError } from '@shared/errors';
import type { AuthenticatedRequest } from './authenticatedRequest';

/**
 * UUIDs de fallback para ambientes não-produção enquanto o AuthMiddleware
 */
export const DEV_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
export const DEV_API_KEY_ID = '660e8400-e29b-41d4-a716-446655440001';
export const DEV_USER_ID = '440e8400-e29b-41d4-a716-446655440000';

/** Contexto para POST /api/metrics — exige workspaceId + apiKeyId. */
export function resolveIngestContext(req: AuthenticatedRequest): {
  workspaceId: string;
  apiKeyId: string;
} {
  if (req.workspaceId && req.apiKeyId) {
    return { workspaceId: req.workspaceId, apiKeyId: req.apiKeyId };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new UnauthorizedError('API key authentication required');
  }

  return {
    workspaceId: req.workspaceId ?? DEV_WORKSPACE_ID,
    apiKeyId: req.apiKeyId ?? DEV_API_KEY_ID,
  };
}

/** Contexto para rotas dashboard — exige workspaceId + userId. */
export function resolveDashboardContext(req: AuthenticatedRequest): {
  workspaceId: string;
  userId: string;
} {
  if (req.workspaceId && req.userId) {
    return { workspaceId: req.workspaceId, userId: req.userId };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new UnauthorizedError('JWT authentication required');
  }

  return {
    workspaceId: req.workspaceId ?? DEV_WORKSPACE_ID,
    userId: req.userId ?? DEV_USER_ID,
  };
}

/** @deprecated Usar resolveIngestContext ou resolveDashboardContext. */
export function resolveTenantContext(req: AuthenticatedRequest) {
  return resolveIngestContext(req);
}
