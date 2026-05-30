// src/shared/errors/index.ts
//
// Barrel export de todos os erros da aplicação.
//
// Permite importar qualquer erro de um único ponto:
//   import { ValidationError, NotFoundError, AppError } from '@shared/errors'

export { AppError } from "./AppError";
export { ValidationError, type ValidationDetails } from "./ValidationError";
export { NotFoundError } from "./NotFoundError";
export { UnauthorizedError } from "./UnauthorizedError";
