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
 * Guarda de segurança — lança UnauthorizedError com mensagem genérica para
 * não revelar ao atacante que o utilizador existe mas está inactivo (user enumeration).
 */
export function assertActiveUser(user: User): void {
  if (user.status !== 'active') {
    throw new UnauthorizedError('Invalid credentials');
  }
}
