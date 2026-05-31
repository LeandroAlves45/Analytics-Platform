// src/shared/errors/ErrorCodes.ts
//
// Códigos de erro legíveis por máquina (machine-readable).
// Usados nas respostas JSON da API dentro de error.code.
// Permitem ao frontend/cliente tratar erros sem depender da mensagem textual.

/** Mapa de todos os códigos de erro suportados pela aplicação. */
export const ErrorCodes = {
  /** Erro interno inesperado (HTTP 500). */
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  /** Request malformado ou JSON inválido (HTTP 400). */
  BAD_REQUEST: "BAD_REQUEST",
  /** Rota HTTP não existe (HTTP 404). */
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  /** Utilizador não autenticado (HTTP 401). */
  UNAUTHORIZED: "UNAUTHORIZED",
  /** Autenticado mas sem permissão (HTTP 403). */
  FORBIDDEN: "FORBIDDEN",
  /** Recurso de domínio não encontrado (HTTP 404). */
  NOT_FOUND: "NOT_FOUND",
  /** Conflito de estado, ex: registo duplicado (HTTP 409). */
  CONFLICT: "CONFLICT",
  /** Dados de input inválidos (HTTP 422). */
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

/** Union type de todos os códigos válidos — garante type-safety ao criar AppError. */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** Status HTTP permitidos nos erros operacionais da aplicação. */
export type HTTPStatuscode =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 429
  | 500
  | 503;
