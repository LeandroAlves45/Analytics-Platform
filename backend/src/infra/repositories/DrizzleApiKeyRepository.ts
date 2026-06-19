/**
 * Implementação Drizzle de ApiKeyRepository.
 *
 * Trade-off: bcrypt compare não pode usar índice no hash — filtramos por keyPreview
 * (últimos 6 chars) para reduzir candidatos antes do compare.
 */

import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { Database } from '@infra/frameworks/database/connection';
import { apiKeys } from '@infra/frameworks/database/schema';
import { ApiKey } from '@domain/entities/ApiKey';
import type { ApiKeyRepository } from '@application/contracts/repositories';
import type { ApiKeyOutputDTO } from '@application/dto/WorkspacesDTO';
import { AppError } from '@shared/errors';

function toOutput(row: typeof apiKeys.$inferSelect): ApiKeyOutputDTO {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    keyPreview: row.keyPreview,
    status: row.status,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly db: Database) {}

  /** Lookup por ativas API keys */
  async findActiveByPlaintextKey(plaintextKey: string): Promise<{
    id: string;
    workspaceId: string;
    keyHash: string;
  } | null> {
    const preview = plaintextKey.slice(-6);
    const candidates = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyPreview, preview), eq(apiKeys.status, 'active')));

    for (const row of candidates) {
      const match = await bcrypt.compare(plaintextKey, row.keyHash);
      if (match) {
        return {
          id: row.id,
          workspaceId: row.workspaceId,
          keyHash: row.keyHash,
        };
      }
    }
    return null;
  }

  /** Atualiza lastUsedAt para uma API key */
  async updateLastUsed(apiKeyId: string): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyId));
  }

  /** Persiste uma nova API key e devolve campos públicos */
  async save(apiKey: ApiKey): Promise<ApiKeyOutputDTO> {
    try {
      const [row] = await this.db
        .insert(apiKeys)
        .values({
          id: apiKey.id,
          workspaceId: apiKey.workspaceId,
          name: apiKey.name,
          keyHash: apiKey.keyHash,
          keyPreview: apiKey.keyPreview,
          status: apiKey.status,
        })
        .returning();

      return toOutput(row);
    } catch (error) {
      throw new AppError('Failed to save API key', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  /** Lookup por workspace */
  async findByWorkspace(workspaceId: string): Promise<ApiKeyOutputDTO[]> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.workspaceId, workspaceId), eq(apiKeys.status, 'active')));

    return rows.map(toOutput);
  }

  /** Lookup por ID */
  async findById(apiKeyId: string, workspaceId: string): Promise<ApiKeyOutputDTO | null> {
    const [row] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.workspaceId, workspaceId)));

    return row ? toOutput(row) : null;
  }

  async revoke(apiKeyId: string, workspaceId: string): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.workspaceId, workspaceId)));
  }
}
