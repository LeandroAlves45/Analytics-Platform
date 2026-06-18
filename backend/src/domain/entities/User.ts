/**
 * Entidade de domínio User — representa quem faz login no dashboard.
 *
 * passwordHash nunca é exposto fora da camada de persistência;
 * o domain só valida que existe, não como foi gerado (bcrypt é infra).
 */

import { randomUUID } from 'node:crypto';
import { ValidationError } from '@shared/errors';
import { Email } from '@domain/value-objects/Email';

export const USER_STATUSES = ['active', 'suspended', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name?: string | null;
  status?: string;
}

export interface ReconstituteUserInput extends CreateUserInput {
  id: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly email: Email;
  readonly passwordHash: string;
  readonly name: string | null;
  readonly emailVerified: boolean;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(input: CreateUserInput, persisted?: ReconstituteUserInput) {
    User.validate(input);

    this.id = persisted?.id ?? randomUUID();
    this.email = new Email(input.email);
    this.passwordHash = input.passwordHash;
    this.name = input.name?.trim() ?? null;
    this.emailVerified = persisted?.emailVerified ?? false;
    this.status = (input.status ?? persisted?.status ?? 'active') as UserStatus;
    this.createdAt = persisted?.createdAt ?? new Date();
    this.updatedAt = persisted?.updatedAt ?? new Date();
  }

  static reconstitute(input: ReconstituteUserInput): User {
    return new User(input, input);
  }

  private static validate(input: CreateUserInput): void {
    if (!input.passwordHash || input.passwordHash.length < 10) {
      throw new ValidationError('Invalid user data', [
        { field: 'passwordHash', message: 'Password hash is required' },
      ]);
    }

    const status = input.status ?? 'active';
    if (!USER_STATUSES.includes(status as UserStatus)) {
      throw new ValidationError('Invalid user data', [
        { field: 'status', message: 'Invalid user status' },
      ]);
    }
  }

  /** Devolve iniciais para avatar (ex: "João Silva" → "JS"). */
  getInitials(): string {
    if (!this.name) {
      return this.email.value.slice(0, 2).toUpperCase();
    }
    const parts = this.name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
