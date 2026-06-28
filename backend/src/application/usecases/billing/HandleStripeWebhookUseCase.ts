/**
 * Processa eventos Stripe e sincroniza a base de dados local.
 *
 * Eventos tratados:
 * - checkout.session.completed — nova subscrição após checkout
 * - customer.subscription.updated/deleted — alterações ou cancelamento
 * - invoice.payment_failed — apenas log (sem alteração de plano)
 */

import type {
  StripeSubscriptionRepository,
  WorkspaceRepository,
} from '@application/contracts/repositories';
import type { WorkspacePlanCache } from '@infra/cache/WorkspacePlanCache';
import { logger } from '@infra/frameworks/logging';

export class HandleStripeWebhookUseCase {
  constructor(
    private readonly stripeSubscriptionRepository: StripeSubscriptionRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspacePlanCache: WorkspacePlanCache
  ) {}

  async execute(event: { type: string; data: unknown }): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data as Record<string, unknown>);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionChange(event.data as Record<string, unknown>);
        break;
      case 'invoice.payment_failed':
        logger.warn('stripe_payment_failed', { data: event.data });
        break;
      default:
        logger.info('stripe_webhook_ignored', { type: event.type });
    }
  }

  private async handleCheckoutCompleted(data: Record<string, unknown>): Promise<void> {
    const metadata = data.metadata as Record<string, string> | undefined;
    const wsId = metadata?.workspaceId;
    if (!wsId) {
      logger.warn('stripe_checkout_missing_workspace', { sessionId: data.id });
      return;
    }

    const subscriptionId = String(data.subscription ?? '');
    const customerId = String(data.customer ?? '');
    const plan = metadata?.targetPlan === 'business' ? 'business' : 'pro';

    await this.stripeSubscriptionRepository.upsert({
      workspaceId: wsId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan,
      status: 'active',
    });

    await this.workspaceRepository.updatePlan(wsId, plan);
    await this.workspacePlanCache.invalidate(wsId);
  }

  private async handleSubscriptionChange(data: Record<string, unknown>): Promise<void> {
    const metadata = data.metadata as Record<string, string> | undefined;
    const wsId = metadata?.workspaceId;
    if (!wsId) {
      logger.warn('stripe_subscription_missing_workspace', { subscriptionId: data.id });
      return;
    }

    const status = String(data.status ?? 'canceled');
    const plan = status === 'active' ? (metadata?.targetPlan ?? 'pro') : 'free';

    await this.stripeSubscriptionRepository.upsert({
      workspaceId: wsId,
      stripeCustomerId: String(data.customer),
      stripeSubscriptionId: String(data.id),
      plan,
      status,
    });

    await this.workspaceRepository.updatePlan(wsId, plan);
    await this.workspacePlanCache.invalidate(wsId);
  }
}
