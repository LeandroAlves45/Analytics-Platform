/**
 * Verifica se workspace ainda tem quota mensal disponível.
 */

import type {
  UsageTrackingRepository,
  WorkspaceRepository,
} from '@application/contracts/repositories';
import { getMonthlyLimit } from '@shared/constants/plans';
import { AppError } from '@shared/errors';

export class CheckUsageQuotaUseCase {
  constructor(
    private readonly usageRepository: UsageTrackingRepository,
    private readonly workspaceRepository: WorkspaceRepository
  ) {}

  async execute(workspaceId: string): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    const plan = workspace?.plan ?? 'free';
    const limit = getMonthlyLimit(plan);
    const used = await this.usageRepository.getCurrentMonthUsage(workspaceId);

    if (used >= limit) {
      throw new AppError(
        `Monthly quota exceeded (${used}/${limit} requests)`,
        'QUOTA_EXCEEDED',
        403
      );
    }
  }
}
