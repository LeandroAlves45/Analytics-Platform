/**
 * Revoga uma API key do workspace — marca como revoked e invalida cache de auth.
 * Verifica membership antes de qualquer acção para garantir isolamento multi-tenant.
 */

import type { ApiKeyRepository, WorkspaceRepository } from '@application/contracts/repositories';
import type { RevokeApiKeyInputDTO } from '@application/dto/WorkspacesDTO';
import type { IApiKeyAuthCache } from '@infra/cache/ApiKeyAuthCache';
import { ForbiddenError, NotFoundError } from '@shared/errors';

export class RevokeApiKeyUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly apiKeyAuthCache: IApiKeyAuthCache
  ) {}

  async execute(input: RevokeApiKeyInputDTO): Promise<void> {
    const isMember = await this.workspaceRepository.isMember(input.workspaceId, input.userId);
    if (!isMember) {
      throw new ForbiddenError('Not a member of this workspace');
    }

    const key = await this.apiKeyRepository.findById(input.apiKeyId, input.workspaceId);
    if (!key) {
      throw new NotFoundError('ApiKey', input.apiKeyId);
    }

    await this.apiKeyRepository.revoke(input.apiKeyId, input.workspaceId);
    await this.apiKeyAuthCache.invalidateByApiKeyId(input.apiKeyId);
  }
}
