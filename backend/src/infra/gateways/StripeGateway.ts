/**
 * Implementação Stripe real — usa SDK stripe (já no package.json).
 *
 * Não inclui payment_method_types para permitir dynamic payment methods
 * configurados no Dashboard Stripe.
 */

import Stripe from 'stripe';
import type { Config } from '@infra/frameworks/config';
import type { StripeGateway as IStripeGateway } from '@application/contracts/gateways';
import { AppError } from '@shared/errors';

export class StripeGateway implements IStripeGateway {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(config: Config) {
    if (!config.STRIPE_SECRET_KEY) {
      throw new AppError('Stripe not configured', 'INTERNAL_SERVER_ERROR', 500);
    }
    if (!config.STRIPE_WEBHOOK_SECRET) {
      throw new AppError('Stripe webhook secret not configured', 'INTERNAL_SERVER_ERROR', 500);
    }

    this.stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    this.webhookSecret = config.STRIPE_WEBHOOK_SECRET;
  }

  async createCustomer(email: string, name: string, workspaceId: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: {
        workspaceId,
      },
    });
    return customer.id;
  }

  async createCheckoutSession(input: {
    customerId: string;
    priceId: string;
    workspaceId: string;
    targetPlan: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const session = await this.stripe.checkout.sessions.create({
      customer: input.customerId,
      mode: 'subscription',
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { workspaceId: input.workspaceId, targetPlan: input.targetPlan ?? 'pro' },
      subscription_data: {
        metadata: { workspaceId: input.workspaceId, targetPlan: input.targetPlan ?? 'pro' },
      },
    });

    if (!session.url) {
      throw new AppError('Failed to create checkout session', 'INTERNAL_SERVER_ERROR', 500);
    }

    return session.url;
  }

  async constructWebhookEvent(rawBody: Buffer, signature: string) {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    return { type: event.type, data: event.data.object };
  }
}
