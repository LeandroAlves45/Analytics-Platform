/**
 * Autenticação por API key para ingestão de métricas (POST /api/metrics).
 *
 * Contraste com JwtAuthMiddleware:
 * - API key: prefixo `apk_`, resolve workspaceId + apiKeyId, sem userId.
 * - JWT: sem prefixo apk_, resolve userId + workspaceId.
 *
 * Rejeita tokens JWT neste middleware e vice-versa — evita confusão de contexto.
 */

import { Response, NextFunction } from 'express';
import { API_KEY_PREFIX } from '@domain/entities/ApiKey';
import type { ApiKeyRepository } from '@application/contracts/repositories';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { extractBearerToken } from './extractBearerToken';
import { UnauthorizedError } from '@shared/errors';
import type { IApiKeyAuthCache } from '@infra/cache/ApiKeyAuthCache';

/**
 * @param apiKeyRepository - Lookup por plaintext key (bcrypt compare na infra).
 * @returns Middleware que injecta `req.workspaceId` e `req.apiKeyId`.
 */
export function createApiKeyAuthMiddleware(
  apiKeyRepository: ApiKeyRepository,
  apiKeyAuthCache: IApiKeyAuthCache
) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractBearerToken(req);

      if (!token.startsWith(API_KEY_PREFIX)) {
        throw new UnauthorizedError('Invalid API key format');
      }

      const cached = await apiKeyAuthCache.get(token);
      if (cached) {
        req.workspaceId = cached.workspaceId;
        req.apiKeyId = cached.id;
        void apiKeyRepository.updateLastUsed(cached.id);
        next();
        return;
      }

      const match = await apiKeyRepository.findActiveByPlaintextKey(token);
      if (!match) {
        throw new UnauthorizedError('Invalid or revoked API key');
      }

      await apiKeyAuthCache.set(token, { id: match.id, workspaceId: match.workspaceId });

      req.workspaceId = match.workspaceId;
      req.apiKeyId = match.id;

      // Fire-and-forget: não bloqueia response
      void apiKeyRepository.updateLastUsed(match.id);

      next();
    } catch (error) {
      next(error);
    }
  };
}
