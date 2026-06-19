/**
 * Cria API key — devolve plaintext uma única vez.
 */

import bcrypt from 'bcryptjs';
import { ApiKey } from '@domain/entities/ApiKey';
import type { ApiKeyRepository, WorkspaceRepository } from '@application/contracts/repositories';
import type { CreateApiKeyInputDTO, CreateApiKeyOutputDTO } from '@application/dto/WorkspacesDTO';
import { ForbiddenError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';

const BCRYPT_ROUNDS = 10;

export class CreateApiKeyUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly workspaceRepository: WorkspaceRepository
  ) {}

  async execute(input: CreateApiKeyInputDTO): Promise<CreateApiKeyOutputDTO> {
    const isMember = await this.workspaceRepository.isMember(input.workspaceId, input.userId);
    if (!isMember) {
      throw new ForbiddenError('Not a member of this workspace');
    }

    const plaintextKey = ApiKey.generatePlaintextKey();
    const keyHash = await bcrypt.hash(plaintextKey, BCRYPT_ROUNDS);
    const keyPreview = plaintextKey.slice(-6);

    const apiKey = new ApiKey({
      workspaceId: input.workspaceId,
      name: input.name,
      keyHash,
      keyPreview,
    });

    const saved = await this.apiKeyRepository.save(apiKey);

    logger.info('api_key_created', { workspaceId: input.workspaceId, apiKeyId: saved.id });

    return {
      ...saved,
      plaintextKey,
    };
  }
}
