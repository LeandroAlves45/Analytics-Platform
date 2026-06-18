/**
 * Entidade Workspace — unidade de isolamento multi-tenant.
 *
 * Cada workspace pertence a um owner (userId) e tem plano de billing.
 * slug é URL-friendly e único globalmente.
 */

import { randomUUID } from 'node:crypto';
import { ValidationError } from '@shared/errors';
import { isValidUuid } from '@shared/validation/uuid';

export const WORKSPACE_PLANS = ['free', 'pro', 'business', 'enterprise'] as const;
export type WorkspacePlan = (typeof WORKSPACE_PLANS)[number];

export const WORKSPACE_STATUSES = ['active', 'suspended'] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export interface CreateWorkspaceInput {
  userId: string;
  name: string;
  slug: string;
  plan?: string;
  status?: string;
}

export interface ReconstituteWorkspaceInput extends CreateWorkspaceInput {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Workspace {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly slug: string;
  readonly plan: WorkspacePlan;
  readonly status: WorkspaceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(input: CreateWorkspaceInput, persisted?: ReconstituteWorkspaceInput) {
    Workspace.validate(input);

    this.id = persisted?.id ?? randomUUID();
    this.userId = input.userId;
    this.name = input.name.trim();
    this.slug = input.slug.trim().toLowerCase();
    this.plan = (input.plan ?? 'free') as WorkspacePlan;
    this.status = (input.status ?? 'active') as WorkspaceStatus;
    this.createdAt = persisted?.createdAt ?? new Date();
    this.updatedAt = persisted?.updatedAt ?? new Date();
  }

  static reconstitute(input: ReconstituteWorkspaceInput): Workspace {
    return new Workspace(input, input);
  }

  private static validate(input: CreateWorkspaceInput): void {
    if (!isValidUuid(input.userId)) {
      throw new ValidationError('Invalid workspace data', [
        { field: 'userId', message: 'userId must be a valid UUID' },
      ]);
    }

    if (!input.name.trim()) {
      throw new ValidationError('Invalid workspace data', [
        { field: 'name', message: 'Name is required' },
      ]);
    }

    const slug = input.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,50}$/.test(slug)) {
      throw new ValidationError('Invalid workspace data', [
        {
          field: 'slug',
          value: slug,
          message: 'Slug must be 3-50 lowercase alphanumeric char or hyfens',
        },
      ]);
    }

    const plan = input.plan ?? 'free';
    if (!WORKSPACE_PLANS.includes(plan as WorkspacePlan)) {
      throw new ValidationError('Invalid workspace data', [
        { field: 'plan', value: plan, message: 'Invalid workspace plan' },
      ]);
    }
  }

  /** Gera slug a partir do nome (ex: "My App" → "my-app"). */
  static slugFromName(name: string): string {
    return (
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) || 'workspace'
    );
  }
}
