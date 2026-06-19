/**
 * Valida JWT access token e injecta userId/workspaceId no request.
 *
 * Rejeita tokens com prefixo apk_ — esses pertencem ao ApiKeyAuthMiddleware.
 */

import { Response, NextFunction } from 'express';
import { JwtService } from '@infra/services/JwtService';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { extractBearerToken } from './extractBearerToken';
import { API_KEY_PREFIX } from '@domain/entities/ApiKey';
import { UnauthorizedError } from '@shared/errors';

export function createJwtAuthMiddleware(jwtService: JwtService) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    try {
      const token = extractBearerToken(req);

      if (token.startsWith(API_KEY_PREFIX)) {
        throw new UnauthorizedError('JWT required for this endpoint');
      }

      const payload = jwtService.verify(token);
      req.userId = payload.sub;
      req.workspaceId = payload.workspaceId;

      next();
    } catch (error) {
      next(error);
    }
  };
}
