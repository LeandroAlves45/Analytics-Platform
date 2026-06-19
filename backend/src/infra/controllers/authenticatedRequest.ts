/**
 * Request Express estendido com contexto de tenant injectado pelos middlewares.
 *
 * Campos preenchidos consoante o tipo de autenticação:
 * - API key (ingestão): workspaceId + apiKeyId
 * - JWT (dashboard/billing): workspaceId + userId
 *
 * Em testes, simulateAuthMiddleware preenche workspaceId/apiKeyId.
 * Em produção sem contexto válido, resolveIngestContext/resolveDashboardContext rejeitam com 401.
 */
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  workspaceId?: string;
  apiKeyId?: string;
  userId?: string;
}
