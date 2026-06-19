/**
 * Entidade ApiKey — metadata de uma chave de API (não a chave em plaintext).
 *
 * A chave real nunca entra no domain — só keyHash e keyPreview.
 * Geração do plaintext `apk_...` é responsabilidade do use case (infra bcrypt).
 */

import { randomUUID, randomBytes } from 'node:crypto';
import { ValidationError } from '@shared/errors';
import { isValidUuid } from '@shared/validation/uuid';

export const API_KEY_STATUSES = ['active', 'revoked'] as const;
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number];

/** Prefixo público das chaves — permite detecção no middleware sem query BD. */
export const API_KEY_PREFIX = 'apk_';

export interface CreateApiKeyInput {
  workspaceId: string;
  name: string;
  keyHash: string;
  keyPreview: string;
  status?: string;
}

export interface ReconstituteApiKeyInput extends CreateApiKeyInput {
  id: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ApiKey {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly keyHash: string;
  readonly keyPreview: string;
  readonly status: ApiKeyStatus;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(input: CreateApiKeyInput, persisted?: ReconstituteApiKeyInput) {
    ApiKey.validate(input);

    this.id = persisted?.id ?? randomUUID();
    this.workspaceId = input.workspaceId;
    this.name = input.name.trim();
    this.keyHash = input.keyHash;
    this.keyPreview = input.keyPreview;
    this.status = (input.status ?? 'active') as ApiKeyStatus;
    this.lastUsedAt = persisted?.lastUsedAt ?? null;
    this.createdAt = persisted?.createdAt ?? new Date();
    this.updatedAt = persisted?.updatedAt ?? new Date();
  }

  static reconstitute(input: ReconstituteApiKeyInput): ApiKey {
    return new ApiKey(input, input);
  }

  /** Gera plaintext key para mostrar ao utilizador uma única vez. */
  static generatePlaintextKey(): string {
    return `${API_KEY_PREFIX}${randomBytes(32).toString('hex')}`;
  }

  isActive(): boolean {
    return this.status === 'active';
  }

  private static validate(input: CreateApiKeyInput): void {
    if (!isValidUuid(input.workspaceId)) {
      throw new ValidationError('Invalid api key data', [
        { field: 'workspaceId', message: 'workspaceId must be a valid UUID' },
      ]);
    }

    if (!input.name.trim()) {
      throw new ValidationError('Invalid api key data', [
        { field: 'name', message: 'Name is required' },
      ]);
    }

    if (!input.keyHash) {
      throw new ValidationError('Invalid api key data', [
        { field: 'keyHash', message: 'keyHash is required' },
      ]);
    }

    if (!input.keyPreview || input.keyPreview.length < 4) {
      throw new ValidationError('Invalid api key data', [
        { field: 'keyPreview', message: 'keyPreview must be at least 4 characters' },
      ]);
    }
  }
}
