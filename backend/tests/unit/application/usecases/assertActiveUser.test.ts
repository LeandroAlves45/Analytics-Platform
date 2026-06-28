/**
 * Testes unitários da função `assertActiveUser`.
 *
 * Verifica que utilizadores com status `active` passam sem erro e que contas
 * suspensas lançam `UnauthorizedError` com mensagem adequada.
 * Usa `User.reconstitute` para simular entidades já persistidas — sem I/O.
 */

import { User } from '@domain/entities/User';
import { assertActiveUser } from '@application/usecases/auth/assertActiveUser';
import { UnauthorizedError } from '@shared/errors';

/** Hash bcrypt válido (60 chars) usado em testes de reconstitution. */
const VALID_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeDAXnJ/5F8Uh3rQi';

describe('assertActiveUser', () => {
  it('should not throw or active user', () => {
    const user = User.reconstitute({
      id: 'user-1',
      email: 'a@b.com',
      name: 'Test User',
      passwordHash: VALID_HASH,
      emailVerified: true,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => assertActiveUser(user)).not.toThrow();
  });

  it('should throw UnauthorizedError for suspended user', () => {
    const user = User.reconstitute({
      id: 'user-1',
      email: 'a@b.com',
      name: 'Test User',
      passwordHash: VALID_HASH,
      emailVerified: true,
      status: 'suspended',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => assertActiveUser(user)).toThrow(UnauthorizedError);
    expect(() => assertActiveUser(user)).toThrow('Account is not active');
  });

  it('should throw UnauthorizedError for deleted user', () => {
    const user = User.reconstitute({
      id: 'user-1',
      email: 'a@b.com',
      name: 'Test User',
      passwordHash: VALID_HASH,
      emailVerified: true,
      status: 'deleted',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => assertActiveUser(user)).toThrow(UnauthorizedError);
    expect(() => assertActiveUser(user)).toThrow('Account is not active');
  });
});
