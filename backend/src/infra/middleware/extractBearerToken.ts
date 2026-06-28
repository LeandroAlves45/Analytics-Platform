/**
 * Extrai o token do header `Authorization: Bearer <token>`.
 *
 * Usado por JwtAuthMiddleware e ApiKeyAuthMiddleware — ambos partilham o mesmo
 * formato de header; a distinção JWT vs API key é feita pelo prefixo do token.
 *
 * @param req - Request Express com headers.
 * @returns Token raw (sem prefixo `Bearer `).
 * @throws {UnauthorizedError} Header ausente, sem prefixo Bearer, ou token vazio.
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
