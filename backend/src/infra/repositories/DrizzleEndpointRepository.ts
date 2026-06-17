/**
 * Repositório Drizzle para metadata de endpoints.
 * Upsert idempotente usado ao criar regras de alerta com endpoint+method.
 */

import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type { EndpointRepository, EndpointRecord } from '@application/contracts/repositories';
import type * as schema from '@infra/frameworks/database/schema';
import { endpoints } from '@infra/frameworks/database/schema';
import { AppError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';

// Tipo de instância Drizzle com o schema completo.
type Database = PostgresJsDatabase<typeof schema>;

export class DrizzleEndpointRepository implements EndpointRepository {
  constructor(private readonly db: Database) {}

  async upsert(workspaceId: string, endpoint: string, method: string): Promise<EndpointRecord> {
    try {
      const existing = await this.findByWorkspaceEndpointMethod(workspaceId, endpoint, method);

      if (existing) {
        return existing;
      }

      const [inserted] = await this.db
        .insert(endpoints)
        .values({
          workspaceId,
          endpoint,
          method,
          alertsEnabled: true,
        })
        .onConflictDoNothing({
          target: [endpoints.workspaceId, endpoints.endpoint, endpoints.method],
        })
        .returning({
          id: endpoints.id,
          workspaceId: endpoints.workspaceId,
          endpoint: endpoints.endpoint,
          method: endpoints.method,
        });

      if (inserted) {
        return inserted;
      }

      const found = await this.findByWorkspaceEndpointMethod(workspaceId, endpoint, method);

      if (!found) {
        throw new AppError('Failed to upsert endpoint', 'INTERNAL_SERVER_ERROR', 500);
      }

      return found;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('endpoint_upsert_failed', {
        workspaceId,
        endpoint,
        method,
        error: error instanceof Error ? error.message : 'unknown',
      });

      throw new AppError('Failed to upsert endpoint', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  async findByWorkspaceEndpointMethod(
    workspaceId: string,
    endpoint: string,
    method: string
  ): Promise<EndpointRecord | null> {
    const result = await this.db
      .select({
        id: endpoints.id,
        workspaceId: endpoints.workspaceId,
        endpoint: endpoints.endpoint,
        method: endpoints.method,
      })
      .from(endpoints)
      .where(
        and(
          eq(endpoints.workspaceId, workspaceId),
          eq(endpoints.endpoint, endpoint),
          eq(endpoints.method, method)
        )
      )
      .limit(1);

    return result[0] ?? null;
  }
}
