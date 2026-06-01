// src/infra/presenters/ErrorPresenter.ts
//
// Camada de apresentação: converte erros (classes) em respostas HTTP JSON.
// Separa a lógica de serialização do middleware Express.

import { AppError, ErrorCodes } from '../../shared/errors';

/** Formato padrão do body de erro enviado ao cliente. */
export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    [key: string]: unknown;
  };
}

/** Resultado pronto para res.status(...).json(...) no middleware. */
export interface PresentedError {
  statusCode: number;
  body: ErrorResponseBody;
}

export class ErrorPresenter {
  /**
   * Formata um AppError operacional para resposta HTTP.
   * Usa toJSON() da classe — garante formato consistente { error: { code, message } }.
   *
   * @param error - Erro operacional lançado num use case, controller ou repository.
   */
  static present(error: AppError): PresentedError {
    return {
      statusCode: error.statusCode,
      body: error.toJSON(),
    };
  }

  /**
   * Formata erros inesperados (não AppError) como 500 Internal Server Error.
   * Em produção oculta a mensagem real; em dev expõe para debugging.
   *
   * @param error - Erro genérico capturado pelo middleware (bug, falha de DB, etc.).
   * @param isProduction - true quando NODE_ENV === "production".
   */
  static presentUnknown(error: Error, isProduction: boolean): PresentedError {
    return {
      statusCode: 500,
      body: {
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: isProduction
            ? 'An unexpected error occurred. Please try again later.'
            : error.message,
        },
      },
    };
  }
}
