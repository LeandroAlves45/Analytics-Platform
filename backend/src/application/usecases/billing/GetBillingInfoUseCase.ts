/**
 * Devolve plano, usage e estado Stripe para o dashboard.
 */

import type {
  UsageTrackingRepository,
  WorkspaceRepository,
  StripeSubscriptionRepository,
} from '@application/contracts/repositories';
import type { BillingInfoOutputDTO } from '@application/dto/BillingDTO';
import { getMonthlyLimit } from '@shared/constants/plans';

export class GetBillingInfoUseCase {
  constructor(
    private readonly usageRepository: UsageTrackingRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly stripeSubscriptionRepository: StripeSubscriptionRepository
  ) {}

  async execute(workspaceId: string): Promise<BillingInfoOutputDTO> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    const plan = workspace?.plan ?? 'free';
    const limit = getMonthlyLimit(plan);
    const used = await this.usageRepository.getCurrentMonthUsage(workspaceId);
    const sub = await this.stripeSubscriptionRepository.findByWorkspaceId(workspaceId);

    const now = new Date();
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);

    return {
      workspaceId,
      plan,
      requestsTracked: used,
      requestsLimit: limit,
      usagePercentage: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0,
      month,
      stripeSubscriptionStatus: sub?.status ?? null,
      currentPeriod: sub?.currentPeriodEnd?.toISOString() ?? null,
    };
  }
}
