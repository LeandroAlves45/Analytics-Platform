// src/shared/errors/ValidationError.ts
//
// Erro lançado quando dados de input são inválidos.
// HTTP 422 Unprocessable Entity (ou 400 Bad Request).
//
// Quando usar:
//   - Validação do schema Zod falha num controller
//   - Uma Entity do domínio recebe valores inválidos
//     ex: Metric com latencyMs negativo
//     ex: AlertRule com threshold inválido

import { AppError } from "./AppError";

// Estrutura opcional para detalhar qual campo falhou e porquê.
export interface ValidationDetails {
  // Campo que causou o erro: "email", "latencyMs", "statusCode"
  field?: string;

  // Valor que foi recebido (para debugging)
  value?: unknown;

  // Mensagem específica para o campo
  message?: string;
}

export class ValidationError extends AppError {
  // Detalhes opcionais sobre qual campo falhou
  public readonly details: ValidationDetails[];

  constructor(message: string, details: ValidationDetails[] = []) {
    // 422 Unprocessable Entity: o servidor entendeu o request
    // mas não consegue processar os dados enviados.
    // Alternativa comum: 400 Bad Request.
    // Usamos 422 para distinguir "formato errado" (400) de "dados inválidos" (422).
    super(message, 422);

    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // Override para incluir os detalhes de validação de resposta
  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      // Só inclui details se existirem, para não poluir respostas simples.
      ...(this.details.length > 0 && { details: this.details }),
    };
  }
}
