/**
 * Erro lançado quando um recurso não existe na base de dados.
 * HTTP 404 Not Found.
 *
 * Quando usar:
 *   - Repository não encontra um registo pelo ID
 *   - Use case pede um workspace que não existe
 *   - Endpoint de API com identificador inválido
 */

import { AppError } from './AppError';
import { ErrorCodes } from './ErrorCodes';

/** Opções para personalizar a mensagem de NotFoundError. */
export interface NotFoundErrorOptions {
  /** Label do identificador na mensagem: "id", "slug", "email", etc. Default: "id". */
  identifierLabel?: string;
}

export class NotFoundError extends AppError {
  /** Nome do tipo de recurso (ex: "Workspace", "User"). */
  public readonly resource: string;

  /** Valor do identificador que foi procurado e não encontrado. */
  public readonly identifier: string;

  /**
   * Cria um erro 404 com mensagem automática.
   *
   * @param resource - Tipo de entidade (ex: "Metric", "AlertRule").
   * @param identifier - Valor procurado (UUID, slug, email, etc.).
   * @param options - Permite customizar o label do identificador na mensagem.
   *
   * @example
   * throw new NotFoundError("Workspace", "ws-123");
   * throw new NotFoundError("User", "john@example.com", { identifierLabel: "email" });
   */
  constructor(resource: string, identifier: string, options: NotFoundErrorOptions = {}) {
    const identifierLabel = options.identifierLabel ?? 'id';

    super(
      `${resource} with ${identifierLabel} '${identifier}' not found`,
      ErrorCodes.NOT_FOUND,
      404
    );

    this.resource = resource;
    this.identifier = identifier;
  }

  /**
   * Inclui resource e identifier dentro de error na resposta JSON.
   * Permite ao cliente saber exactamente o que não foi encontrado.
   */
  toJSON(): ReturnType<AppError['toJSON']> {
    return this.buildErrorPayload({
      resource: this.resource,
      identifier: this.identifier,
    });
  }
}
