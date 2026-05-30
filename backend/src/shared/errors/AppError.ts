// src/shared/errors/AppError.ts
//
// Classe base para todos os erros da aplicação.

export class AppError extends Error {
  // Código HTTP que deve ser retornado ao cliente.
  public readonly statusCode: number;

  // Flag que identifica este erro como "operacional":
  // um erro esperado e tratado da aplicação.
  // Erros não operacionais (ex: bug de programação, falha de memória)
  // devem ser tratados de forma diferente (alertar, reiniciar processo).
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    isOperational: boolean = true,
  ) {
    // Chama o construtor da classe no stack trace
    super(message);

    // Define o nome da classe no stack trace
    this.name = this.constructor.name;

    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Necessário em TypeScript quando se herda de classes built-in como Error.
    Object.setPrototypeOf(this, new.target.prototype);

    // Captura o stack trace excluindo o constructor desta classe.
    // Isto faz com que o stack trace comece no código que lançou o erro,
    // não no constructor do AppError.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Serializa o erro para JSON.
  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}
