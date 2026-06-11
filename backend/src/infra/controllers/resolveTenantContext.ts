/**
 * Resolução de contexto multi-tenant a partir do request HTTP.
 *
 * Partilhado entre controllers de ingestão e leitura até o AuthMiddleware
 * TODO: (Sprint 6) injectar workspaceId/apiKeyId em todos os pedidos autenticados.
 */

import { UnauthorizedError } from '@shared/errors';
import type { AuthenticatedRequest } from './authenticatedRequest';

/**
 * UUIDs de fallback para ambientes não-produção enquanto o AuthMiddleware
 * (Sprint 6) não injecta req.workspaceId / req.apiKeyId.
 *
 * TODO(leandro): remover fallback quando AuthMiddleware estiver activo (#sprint-6)
 */
export const DEV_WORKSPACE_ID = '00000000-0000-4000-8000-000000000000';
export const DEV_API_KEY_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Resolve workspaceId e apiKeyId a partir do request autenticado.
 *
 * - Com ambos presentes: usa os valores injectados pelo AuthMiddleware (ou test double).
 * - Em produção sem contexto: lança UnauthorizedError (401).
 * - Em development/test: fallback para DEV_* UUIDs.
 */
export function resolveTenantContext(req: AuthenticatedRequest): {
  workspaceId: string;
  apiKeyId: string;
} {
  const workspaceId = req.workspaceId;
  const apiKeyId = req.apiKeyId;

  if (workspaceId && apiKeyId) {
    return { workspaceId, apiKeyId };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new UnauthorizedError('API key authentication required');
  }

  return {
    workspaceId: workspaceId ?? DEV_WORKSPACE_ID,
    apiKeyId: apiKeyId ?? DEV_API_KEY_ID,
  };
}
