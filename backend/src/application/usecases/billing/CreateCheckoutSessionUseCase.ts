/**
 * Cria sessão Stripe Checkout para upgrade de plano.
 *
 * Fluxo:
 * 1. Valida membership do utilizador no workspace
 * 2. Reutiliza ou cria Stripe customer
 * 3. Devolve URL de redirect para Hosted Checkout
 */

import type { StripeGateway } from '@application/contracts/gateways';
import type {
  StripeSubscriptionRepository,
  WorkspaceRepository,
  UserRepository,
} from '@application/contracts/repositories';
import type { CreateCheckoutInputDTO, CheckoutSessionOutputDTO } from '@application/dto/BillingDTO';
import { AppError, ForbiddenError, NotFoundError } from '@shared/errors';
import type { Config } from '@infra/frameworks/config';

export class CreateCheckoutSessionUseCase {
  constructor(
    private readonly stripeGateway: StripeGateway,
    private readonly stripeSubscriptionRepository: StripeSubscriptionRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
    private readonly config: Config
  ) {}

  async execute(input: CreateCheckoutInputDTO): Promise<CheckoutSessionOutputDTO> {
    const isMember = await this.workspaceRepository.isMember(input.workspaceId, input.userId);
    if (!isMember) {
      throw new ForbiddenError('Not a member of this workspace');
    }

    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundError('User not found', input.userId, { identifierLabel: 'userId' });
    }

    const sub = await this.stripeSubscriptionRepository.findByWorkspaceId(input.workspaceId);
    let customerId = sub?.stripeCustomerId;

    if (!customerId) {
      customerId = await this.stripeGateway.createCustomer(
        user.email.value,
        user.name ?? user.email.value,
        input.workspaceId
      );
    }

    const priceId = this.resolvePriceId(input.targetPlan);

    const baseUrl = this.config.CORS_ORIGIN;
    const url = await this.stripeGateway.createCheckoutSession({
      customerId,
      priceId,
      workspaceId: input.workspaceId,
      targetPlan: input.targetPlan,
      successUrl: `${baseUrl}/settings?checkout=success`,
      cancelUrl: `${baseUrl}/settings?checkout=cancel`,
    });

    return { url };
  }

  private resolvePriceId(targetPlan: CreateCheckoutInputDTO['targetPlan']): string {
    const priceByPlan = {
      pro: this.config.STRIPE_PRICE_PRO,
      business: this.config.STRIPE_PRICE_BUSINESS,
      enterprise: this.config.STRIPE_PRICE_ENTERPRISE,
    } as const;

    const priceId = priceByPlan[targetPlan];
    if (!priceId) {
      throw new AppError('Stripe price not configured', 'INTERNAL_SERVER_ERROR', 500);
    }

    return priceId;
  }
}
