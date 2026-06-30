/**
 * Informação de billing devolvida por GET /api/billing.
 * Inclui uso mensal, limites do plano e estado da subscrição Stripe.
 */

export interface BillingInfo {
  workspaceId: string;
  plan: string;
  requestsTracked: number;
  requestsLimit: number;
  usagePercentage: number;
  month: string;
  stripeSubscriptionStatus: string | null;
  currentPeriod: string | null;
}

/**
 * Planos disponíveis para upgrade via Stripe Checkout (self-service).
 * 'enterprise' é excluído — contacto directo B2B, não self-service.
 * O backend aceita 'enterprise' em POST /api/billing/checkout mas a UI não o expõe.
 */
export type TargetPlan = 'pro' | 'business';
