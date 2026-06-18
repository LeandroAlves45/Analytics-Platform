/**
 * Value object Email — encapsula validação e normalização de endereços.
 *
 * Imutável: uma vez construído, o valor não muda.
 * Normalização: trim + lowercase para evitar duplicados case-sensitive.
 */

import { ValidationError } from '@shared/errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  readonly value: string;

  constructor(raw: string) {
    const normalized = raw.trim().toLowerCase();

    if (!normalized) {
      throw new ValidationError('Invalid email', [
        { field: 'email', message: 'Email is required' },
      ]);
    }

    if (!EMAIL_REGEX.test(normalized)) {
      throw new ValidationError('Invalid email', [
        { field: 'email', message: 'Invalid email format' },
      ]);
    }

    this.value = normalized;
  }

  toString(): string {
    return this.value;
  }
}
