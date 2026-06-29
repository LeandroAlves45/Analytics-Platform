/**
 * Request Express estendido com contexto multi-tenant injectado pelos middlewares.
 *
 * Campos preenchidos consoante o tipo de autenticação:
 * - API key (ingestão POST /api/metrics): `workspaceId` + `apiKeyId`
 * - JWT (dashboard, billing, /me): `workspaceId` + `userId`
 *
 * Nunca assumir que todos os campos estão presentes — usar
 * `resolveIngestContext` ou `resolveDashboardContext` nos controllers.
 */
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  /** Workspace activo — injectado por JWT ou API key middleware. */
  workspaceId?: string;
  /** ID da API key usada na ingestão — só presente com ApiKeyAuthMiddleware. */
  apiKeyId?: string;
  /** ID do utilizador — só presente com JwtAuthMiddleware. */
  userId?: string;
  /** Cookies HTTP presentes no request — populados pelo middleware cookie-parser. */
  cookies: Record<string, string>;
}
