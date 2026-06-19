/**
 * Barrel export de todos os erros da aplicação.
 * Permite importar qualquer erro de um único ponto:
 *   import { ValidationError, NotFoundError, AppError } from '@shared/errors'
 */

export {
  AppError,
  type AppErrorOptions,
  type ErrorPayload,
  type ApiErrorResponseBody,
} from './AppError';
export {
  ValidationError,
  type ValidationDetails,
  type PublicValidationDetails,
} from './ValidationError';
export { NotFoundError, type NotFoundErrorOptions } from './NotFoundError';
export { UnauthorizedError } from './UnauthorizedError';
export { ForbiddenError } from './ForbiddenError';
export { ErrorCodes, type ErrorCode, type HTTPStatuscode } from './ErrorCodes';
export { ConflictError } from './ConflictError';
