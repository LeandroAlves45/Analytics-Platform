// src/shared/errors/UnauthorizedError.ts
//
// Erro lançado quando um request não tem autenticação válida
// ou não tem permissão para aceder a um recurso.
//
// DISTINÇÃO IMPORTANTE:
//   401 Unauthorized: não está autenticado (token ausente ou inválido)
//   403 Forbidden: está autenticado mas não tem permissão
//
// Esta classe cobre ambos os casos com status codes diferentes.

import { AppError } from "./AppError";

export class UnauthorizedError extends AppError {
  constructor(
    message: string = "Authentication required",
    // Por omissão é 401, mas pode ser 403 para casos de autenticação
    statusCode: 401 | 403 = 401,
  ) {
    super(message, statusCode);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
