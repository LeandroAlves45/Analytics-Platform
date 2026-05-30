// src/shared/errors/NotFoundError.ts
//
// Erro lançado quando um recurso não existe na base de dados.
// HTTP 404 Not Found.
//
// Quando usar:
//   - Repository não encontra um registo pelo ID
//   - Use case pede um workspace que não existe
//   - Endpoint de API com ID inválido

import { AppError } from "./AppError";

export class NotFoundError extends AppError {
  // Nome do recurso que não foi encontrado
  public readonly resource: string;

  // ID ou identificador que foi procurado
  public readonly identifier: string;

  constructor(resource: string, identifier: string) {
    // Constrói uma mensagem descritiva automaticamente
    super(`${resource} with id '${identifier}' not found`, 404);

    this.resource = resource;
    this.identifier = identifier;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // Override para incluir os detalhes de não encontrado de resposta
  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      resource: this.resource,
      identifier: this.identifier,
    };
  }
}
