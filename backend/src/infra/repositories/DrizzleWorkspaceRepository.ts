/**
 * Implementação Drizzle de WorkspaceRepository.
 */

import { eq, and } from 'drizzle-orm';
import type { Database } from '@infra/frameworks/database/connection';
import { workspaces, workspaceMembers } from '@infra/frameworks/database/schema';
import { Workspace } from '@domain/entities/Workspace';
import type { WorkspaceRepository } from '@application/contracts/repositories';
import { AppError, ValidationError } from '@shared/errors';

export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: Database) {}

  /** Persiste um novo workspace e devolve campos públicos */
  async save(
    workspace: Workspace
  ): Promise<{ id: string; name: string; slug: string; plan: string }> {
    try {
      const [row] = await this.db
        .insert(workspaces)
        .values({
          id: workspace.id,
          userId: workspace.userId,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          status: workspace.status,
        })
        .returning({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          plan: workspaces.plan,
        });

      return row;
    } catch (error) {
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        throw new ValidationError('Workspace slug already taken', [
          { field: 'slug', message: 'This slug is already in use' },
        ]);
      }
      throw new AppError('Failed to save workspace', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  /** Lookup por ID */
  async findById(workspaceId: string): Promise<Workspace | null> {
    const [row] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!row) {
      return null;
    }

    return Workspace.reconstitute({
      id: row.id,
      userId: row.userId,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /** Devolve o primeiro workspace do utilizador (MVP: um workspace por user). */
  async findByUserId(userId: string): Promise<Workspace | null> {
    const [row] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, userId))
      .limit(1);

    if (!row) {
      return null;
    }

    return Workspace.reconstitute({
      id: row.id,
      userId: row.userId,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /** Adiciona um novo membro ao workspace */
  async addMember(workspaceId: string, userId: string, role: string): Promise<void> {
    try {
      await this.db.insert(workspaceMembers).values({
        workspaceId,
        userId,
        role,
      });
    } catch (error) {
      throw new AppError('Failed to add member to workspace', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  /** Verifica se um utilizador é membro de um workspace */
  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))
      )
      .limit(1);

    return Boolean(row);
  }

  /** Atualiza o plano de um workspace */
  async updatePlan(workspaceId: string, plan: string): Promise<void> {
    try {
      await this.db
        .update(workspaces)
        .set({ plan, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
    } catch (error) {
      throw new AppError('Failed to update workspace plan', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }
}
