// src/shared/errors/ForbiddenError.ts
//
// Erro lançado quando o utilizador está autenticado mas não tem permissão.
// HTTP 403 Forbidden.
//
// Quando usar:
//   - Utilizador tenta aceder a workspace de outro tenant
//   - Role insuficiente para a operação (viewer vs admin)

import { AppError } from './AppError';
import { ErrorCodes } from './ErrorCodes';

export class ForbiddenError extends AppError {
  /**
   * Cria um erro 403 — autenticado mas sem autorização para este recurso/ação.
   *
   * @param message - Mensagem para o cliente.
   *
   * @example
   * throw new ForbiddenError();
   * throw new ForbiddenError("Cannot delete resources in this workspace");
   */
  constructor(message: string = 'You do not have permission to access this resource') {
    super(message, ErrorCodes.FORBIDDEN, 403);
  }
}
