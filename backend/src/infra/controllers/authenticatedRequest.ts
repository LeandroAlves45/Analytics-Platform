/**
 * Request Express estendido com contexto de tenant injectado pelo AuthMiddleware.
 *
 * Em testes de integração, simulateAuthMiddleware preenche estes campos.
 * Em produção sem ambos, resolveTenantContext rejeita o pedido com 401.
 */
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  workspaceId?: string;
  apiKeyId?: string;
}
