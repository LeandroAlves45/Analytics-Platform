/**
 * Lista todas as API keys activas de um workspace.
 * Não devolve keyHash — apenas metadata segura (keyPreview, status, lastUsedAt).
 */

import type { ApiKeyRepository, WorkspaceRepository } from '@application/contracts/repositories';
import type { ListApiKeysInputDTO, ApiKeyOutputDTO } from '@application/dto/WorkspacesDTO';
import { ForbiddenError } from '@shared/errors';

export class ListApiKeysUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly workspaceRepository: WorkspaceRepository
  ) {}

  async execute(input: ListApiKeysInputDTO): Promise<ApiKeyOutputDTO[]> {
    const isMember = await this.workspaceRepository.isMember(input.workspaceId, input.userId);
    if (!isMember) {
      throw new ForbiddenError('Not a member of this workspace');
    }

    return this.apiKeyRepository.findByWorkspace(input.workspaceId);
  }
}
