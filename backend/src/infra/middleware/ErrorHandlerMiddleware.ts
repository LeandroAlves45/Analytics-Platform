// src/infra/middleware/ErrorHandlerMiddleware.ts
//
// Middleware global de erros do Express (4 argumentos: err, req, res, next).
// Deve ser registado por último em app.ts, após todas as rotas.
//
// Fluxo:
//   1. JSON malformado → 400 BAD_REQUEST
//   2. AppError operacional → statusCode correcto via ErrorPresenter
//   3. Qualquer outro erro → 500 INTERNAL_SERVER_ERROR

import { Request, Response, NextFunction } from "express";
import { AppError, ErrorCodes } from "../../shared/errors";
import { ErrorPresenter } from "../presenters/ErrorPresenter";
import { logger } from "../frameworks/logging";

/**
 * Detecta erros de parsing JSON do express.json().
 * O Express lança SyntaxError com propriedade "body" quando o JSON é inválido.
 */
function isMalformedJsonError(error: Error): boolean {
  return error instanceof SyntaxError && "body" in error;
}

/**
 * Middleware central de tratamento de erros.
 * Converte qualquer excepção lançada nas rotas numa resposta HTTP consistente.
 *
 * @param err - Erro capturado pelo Express (via next(err) ou throw em async handler).
 * @param req - Request com request_id para correlacionar logs.
 * @param res - Response onde se envia o JSON de erro.
 * @param _next - Não utilizado; middleware terminal de erro.
 */
export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isProduction = process.env.NODE_ENV === "production";

  if (isMalformedJsonError(err)) {
    res.status(400).json({
      error: {
        code: ErrorCodes.BAD_REQUEST,
        message: "Invalid JSON in request body",
      },
    });
    return;
  }

  if (err instanceof AppError && err.isOperational) {
    const { statusCode, body } = ErrorPresenter.present(err);

    logger.warn("operational_error", {
      request_id: req.id,
      code: err.code,
      status: statusCode,
      message: err.message,
    });

    res.status(statusCode).json(body);
    return;
  }

  logger.error("unhandled_error", {
    request_id: req.id,
    error: err.message,
    stack: err.stack,
  });

  const { statusCode, body } = ErrorPresenter.presentUnknown(err, isProduction);
  res.status(statusCode).json(body);
}
