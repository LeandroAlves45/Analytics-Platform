/**
 * Guard de autenticação — bloqueia contas não ativas.
 *
 * Usado em login e refresh para impedir que utilizadores `suspended` ou `deleted`
 * obtenham ou renovem tokens. Mensagem genérica evita revelar o estado exacto
 * da conta (information disclosure).
 */

import { User } from '@domain/entities/User';
import { UnauthorizedError } from '@shared/errors';

/**
 * @param user - Entidade carregada da BD após validação de credenciais ou refresh token.
 * @throws {UnauthorizedError} Se `user.status !== 'active'`.
 */
export function assertActiveUser(user: User): void {
  if (user.status !== 'active') {
    throw new UnauthorizedError('Account is not active');
  }
}
