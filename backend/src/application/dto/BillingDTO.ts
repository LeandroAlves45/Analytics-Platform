/**
 * DTOs para billing, usage e Stripe.
 */

import type { WorkspacePlan } from '@domain/entities/Workspace';

/** Planos pagos — exclui 'free' que nunca passa por checkout. */
export type PaidPlan = Exclude<WorkspacePlan, 'free'>;

export interface BillingInfoOutputDTO {
  workspaceId: string;
  plan: WorkspacePlan;
  requestsTracked: number;
  requestsLimit: number;
  usagePercentage: number;
  month: string;
  stripeSubscriptionStatus: string | null;
  currentPeriod: string | null;
}

export interface CreateCheckoutInputDTO {
  workspaceId: string;
  userId: string;
  targetPlan: PaidPlan;
}

export interface CheckoutSessionOutputDTO {
  url: string;
}

export interface StripeWebhookEventDTO {
  type: string;
  data: Record<string, unknown>;
}
