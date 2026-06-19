/**
 * Valida API key (prefixo apk_) e injecta workspaceId/apiKeyId.
 */

import { Response, NextFunction } from 'express';
import { API_KEY_PREFIX } from '@domain/entities/ApiKey';
import type { ApiKeyRepository } from '@application/contracts/repositories';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { extractBearerToken } from './extractBearerToken';
import { UnauthorizedError } from '@shared/errors';

export function createApiKeyAuthMiddleware(apiKeyRepository: ApiKeyRepository) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractBearerToken(req);

      if (!token.startsWith(API_KEY_PREFIX)) {
        throw new UnauthorizedError('Invalid API key format');
      }

      const match = await apiKeyRepository.findActiveByPlaintextKey(token);
      if (!match) {
        throw new UnauthorizedError('Invalid or revoked API key');
      }

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
