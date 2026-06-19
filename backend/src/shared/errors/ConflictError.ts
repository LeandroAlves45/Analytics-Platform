/**
 * Erro lançado quando um recurso já existe na base de dados.
 * HTTP 409 Conflict.
 *
 * Quando usar:
 *   - Email duplicado no registo de utilizador
 *   - Slug de workspace já em uso
 *   - Nome de API key duplicado no mesmo workspace
 *   - AlertRule com nome duplicado
 *
 * @example
 * throw new ConflictError('Email already registered');
 * throw new ConflictError('Workspace slug already taken');
 */

import { AppError } from './AppError';
import { ErrorCodes } from './ErrorCodes';

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ErrorCodes.CONFLICT, 409);
  }
}
