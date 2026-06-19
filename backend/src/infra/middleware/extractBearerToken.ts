/**
 * Extrai token do header Authorization: Bearer <token>.
 */
import type { Request } from 'express';
import { UnauthorizedError } from '@shared/errors';

export function extractBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Authorization header');
  }
  const token = header.slice(7).trim();
  if (!token) {
    throw new UnauthorizedError('Empty bearer token');
  }
  return token;
}
