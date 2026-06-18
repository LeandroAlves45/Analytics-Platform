/**
 * DTOs para billing, usage e Stripe.
 */

export interface BillingInfoOutputDTO {
  workspaceId: string;
  plan: string;
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
  targetPlan: 'pro' | 'business' | 'enterprise';
}

export interface CheckoutSessionOutputDTO {
  url: string;
}

export interface StripeWebhookEventDTO {
  type: string;
  data: Record<string, unknown>;
}
