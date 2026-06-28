/**
 * Testes unitários do value object Email.
 *
 * Cobrem: normalização (trim + lowercase), validação fail-fast (vazio, formato inválido)
 * e serialização via toString().
 */

import { Email } from '@domain/value-objects/Email';
import { ValidationError } from '@shared/errors';

describe('Email', () => {
  it('should normalize email to lowercase and trim whitespace', () => {
    const email = new Email('   Test@Example.COM  ');
    expect(email.value).toBe('test@example.com');
  });

  it('should throw ValidationError when email is empty after trim', () => {
    expect(() => new Email('   ')).toThrow(ValidationError);
  });

  it('should throw ValidationError when email format is invalid', () => {
    expect(() => new Email('not-an-email')).toThrow(ValidationError);
  });

  it('should return normalized value from toString', () => {
    const email = new Email('user@domain.com');
    expect(email.toString()).toBe('user@domain.com');
  });
});
