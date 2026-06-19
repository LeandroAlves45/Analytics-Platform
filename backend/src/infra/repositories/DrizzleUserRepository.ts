/**
 * Implementação Drizzle de UserRepository.
 */

import { eq } from 'drizzle-orm';
import type { Database } from '@infra/frameworks/database/connection';
import { users } from '@infra/frameworks/database/schema';
import { User } from '@domain/entities/User';
import type { UserRepository } from '@application/contracts/repositories';
import { AppError, ValidationError } from '@shared/errors';

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  /** Persiste um novo utilizador e devolve campos públicos */
  async save(user: User): Promise<{ id: string; email: string; name: string | null }> {
    try {
      const [row] = await this.db
        .insert(users)
        .values({
          id: user.id,
          email: user.email.value,
          passwordHash: user.passwordHash,
          name: user.name,
          emailVerified: user.emailVerified,
          status: user.status,
        })
        .returning({ id: users.id, email: users.email, name: users.name });

      return row;
    } catch (error) {
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        throw new ValidationError('Email already registered', [
          { field: 'email', message: 'Email already registered' },
        ]);
      }
      throw new AppError('Failed to save user', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  /** Lookup por email normalizado (lowercase) */
  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const [row] = await this.db.select().from(users).where(eq(users.email, normalized)).limit(1);

    if (!row) {
      return null;
    }

    return User.reconstitute({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      name: row.name,
      emailVerified: row.emailVerified,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /** Lookup por ID */
  async findById(userId: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!row) {
      return null;
    }

    return User.reconstitute({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      name: row.name,
      emailVerified: row.emailVerified,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
