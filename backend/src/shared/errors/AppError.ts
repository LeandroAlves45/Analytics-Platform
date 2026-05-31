// src/shared/errors/AppError.ts
//
// Classe base para todos os erros da aplicação.
// Todas as subclasses herdam statusCode, code, isOperational e toJSON().

import { type ErrorCode, type HTTPStatuscode } from "./ErrorCodes";

/** Opções opcionais ao instanciar um AppError. */
export interface AppErrorOptions {
  /** false = erro de programação; o middleware trata como 500 e loga como fatal. */
  isOperational?: boolean;
  /** Erro original que causou este (encadeamento para debugging). */
  cause?: unknown;
}

/** Conteúdo interno do objeto error na resposta JSON. */
export interface ErrorPayload {
  code: string;
  message: string;
  [key: string]: unknown;
}

/** Formato tipado da resposta de erro na API: { error: { code, message, ... } } */
export interface ApiErrorResponseBody {
  error: ErrorPayload;
}

export class AppError extends Error {
  /** Código HTTP devolvido ao cliente. */
  public readonly statusCode: number;

  /** Código legível por máquina (ex: "NOT_FOUND", "VALIDATION_ERROR"). */
  public readonly code: ErrorCode;

  /**
   * true = erro esperado e tratado (ex: validação, 404).
   * false = bug ou falha inesperada — o middleware responde 500 e loga stack trace.
   */
  public readonly isOperational: boolean;

  /**
   * Cria um erro operacional da aplicação.
   *
   * @param message - Mensagem legível para o cliente ou logs.
   * @param code - Código estável da API (ver ErrorCodes).
   * @param statusCode - Status HTTP correspondente.
   * @param options - isOperational e cause opcionais.
   */
  constructor(
    message: string,
    code: ErrorCode,
    statusCode: HTTPStatuscode,
    options: AppErrorOptions = {},
  ) {
    // super(message, { cause }) exige lib ES2022 no tsconfig.
    // Com lib ES2020, atribuímos cause manualmente após super().
    super(message);

    if (options.cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = options.cause;
    }

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = options.isOperational ?? true;

    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Monta o corpo JSON da resposta com campos extra opcionais.
   * Usado pelas subclasses para incluir resource, details, etc.
   *
   * @param extra - Campos adicionais dentro de error (ex: { resource, identifier }).
   */
  protected buildErrorPayload(
    extra: Record<string, unknown> = {},
  ): ApiErrorResponseBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...extra,
      },
    };
  }

  /**
   * Serializa o erro para o formato JSON enviado na resposta HTTP.
   * O ErrorPresenter chama este método para construir o body.
   */
  toJSON(): ApiErrorResponseBody {
    return this.buildErrorPayload();
  }
}
