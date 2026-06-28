/**
 * Testes unitários da entidade User.
 *
 * Cobrem: criação com input válido, validações fail-fast (email, passwordHash, name),
 * normalização de email via value object, geração de iniciais (`getInitials`),
 * reconstitution a partir de dados de persistência e unicidade de ids.
 * Não há stubs de infraestrutura — a entidade não tem I/O.
 */

import { User } from '@domain/entities/User';
import { ValidationError } from '@shared/errors';

describe('User', () => {
  /** Hash bcrypt válido (60 chars) — requisito mínimo da entidade User. */
  const VALID_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeDAXnJ/5F8Uh3rQi';

  const validInput = {
    email: 'test@example.com',
    passwordHash: VALID_HASH,
    name: 'Test User',
  };

  // Criação

  it('should create user with valid input', () => {
    const user = new User(validInput);
    expect(user.email.value).toBe('test@example.com');
    expect(user.name).toBe('Test User');
  });

  it('should generate a UUID id on creation', () => {
    const user = new User(validInput);
    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('should store passwordHash unchanged', () => {
    const user = new User(validInput);
    expect(user.passwordHash).toBe(VALID_HASH);
  });

  // Validação

  it('should throw ValidationError when passwordHash is too short', () => {
    expect(() => new User({ ...validInput, passwordHash: 'short' })).toThrow(ValidationError);
  });

  it('should throw ValidationError when email is malformed', () => {
    expect(() => new User({ ...validInput, email: 'malformed' })).toThrow(ValidationError);
  });

  it('should throw ValidationError when name is empty string', () => {
    expect(() => new User({ ...validInput, name: ' ' as unknown as string })).toThrow(
      ValidationError
    );
  });

  it('should throw ValidationError when status is invalid', () => {
    expect(() => new User({ ...validInput, status: 'invalid-status' })).toThrow(ValidationError);
  });

  it('should accept null name without throwing ValidationError', () => {
    expect(() => new User({ ...validInput, name: null as unknown as string })).not.toThrow();
  });

  // Email value object

  it('should normalize email to lowercase and trim', () => {
    const user = new User({ ...validInput, email: '   Test@Example.COM  ' });
    expect(user.email.value).toBe('test@example.com');
  });

  it('should expose email through Email value object', () => {
    const user = new User(validInput);
    expect(user.email).toBeDefined();
    expect(typeof user.email.value).toBe('string');
  });

  // GetInitials

  it('should return initials from first and last name', () => {
    const user = new User(validInput);
    expect(user.getInitials()).toBe('TU');
  });

  it('should return single initial for single name', () => {
    const user = new User({ ...validInput, name: 'John' });
    expect(user.getInitials()).toBe('J');
  });

  it('should return initials in uppercase', () => {
    const user = new User({ ...validInput, name: 'john doe' });
    expect(user.getInitials()).toBe('JD');
  });

  it('should return fallback initials when name is null', () => {
    const user = new User({ ...validInput, name: null as unknown as string });
    expect(typeof user.getInitials()).toBe('string');
    expect(user.getInitials().length).toBeGreaterThan(0);
  });

  it('should use only first two names for initials', () => {
    const user = new User({ ...validInput, name: 'John Doe Jr' });
    expect(user.getInitials()).toBe('JJ');
  });

  // Reconstitute

  it('should reconstitute user from persistence data', () => {
    const user = User.reconstitute({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'restored@example.com',
      name: 'Restored User',
      passwordHash: VALID_HASH,
      emailVerified: true,
      status: 'active',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    expect(user.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(user.email.value).toBe('restored@example.com');
  });

  it('should preserve id when reconstituting', () => {
    const fixedId = '00000000-0000-4000-8000-000000000001';
    const user = User.reconstitute({
      id: fixedId,
      email: 'a@b.com',
      name: 'Test',
      passwordHash: VALID_HASH,
      emailVerified: false,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(user.id).toBe(fixedId);
  });

  it('should two different users instances have different ids', () => {
    const user1 = new User(validInput);
    const user2 = new User(validInput);
    expect(user1.id).not.toBe(user2.id);
  });
});
