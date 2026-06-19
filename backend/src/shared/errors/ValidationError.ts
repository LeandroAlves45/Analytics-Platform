/**
 * Erro lançado quando dados de input são inválidos.
 * HTTP 422 Unprocessable Entity.
 *
 * Quando usar:
 *   - Validação do schema Zod falha num controller
 *   - Use case recebe dados semanticamente inválidos
 *   - Regras de negócio violadas no input (ex: latencyMs negativo)
 */

import { AppError } from './AppError';
import { ErrorCodes } from './ErrorCodes';

/** Detalhe interno de validação — inclui value para logs, nunca exposto na API. */
export interface ValidationDetails {
  /** Campo que falhou: "email", "latencyMs", "statusCode". */
  field?: string;
  /** Valor recebido — apenas para debugging interno. */
  value?: unknown;
  /** Mensagem específica para o campo. */
  message?: string;
}

/** Detalhe seguro para expor na resposta HTTP (sem value). */
export interface PublicValidationDetails {
  field?: string;
  message?: string;
}

export class ValidationError extends AppError {
  /** Lista completa de falhas de validação (com value para logs internos). */
  public readonly details: ValidationDetails[];

  /**
   * Cria um erro 422 com detalhes opcionais por campo.
   *
   * @param message - Resumo legível do problema (ex: "Invalid input data").
   * @param details - Lista de campos que falharam; value fica só em memória/logs.
   *
   * @example
   * throw new ValidationError("Invalid metric data", [
   *   { field: "latencyMs", value: -1, message: "Must be positive" },
   * ]);
   */
  constructor(message: string, details: ValidationDetails[] = []) {
    super(message, ErrorCodes.VALIDATION_ERROR, 422);
    this.details = details;
  }

  /**
   * Filtra os detalhes removendo `value` antes de enviar ao cliente.
   * Evita expor passwords, tokens ou outros dados sensíveis na resposta.
   */
  toPublicDetails(): PublicValidationDetails[] {
    return this.details.map(({ field, message }) => ({ field, message }));
  }

  /**
   * Serializa o erro incluindo details públicos (sem value) dentro de error.
   * Se não houver details, devolve apenas code e message.
   */
  toJSON(): ReturnType<AppError['toJSON']> {
    const publicDetails = this.toPublicDetails();

    return this.buildErrorPayload(publicDetails.length > 0 ? { details: publicDetails } : {});
  }
}
