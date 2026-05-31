// src/shared/errors/UnauthorizedError.ts
//
// Erro lançado quando o request não tem autenticação válida.
// HTTP 401 Unauthorized — token ausente, expirado ou inválido.
//
// Para utilizador autenticado sem permissão, usar ForbiddenError (403).

import { AppError } from "./AppError";
import { ErrorCodes } from "./ErrorCodes";

export class UnauthorizedError extends AppError {
  /**
   * Cria um erro 401 — o cliente deve autenticar-se antes de aceder ao recurso.
   *
   * @param message - Mensagem para o cliente. Default: "Authentication required".
   *
   * @example
   * throw new UnauthorizedError();
   * throw new UnauthorizedError("Invalid or expired token");
   */
  constructor(message: string = "Authentication required") {
    super(message, ErrorCodes.UNAUTHORIZED, 401);
  }
}
