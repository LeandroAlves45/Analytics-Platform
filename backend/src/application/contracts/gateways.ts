/**
 * Contrato para envio de notificações de alerta.
 * Implementações: SlackWebhookGateway, NodemailerEmailService, NoOpNotificationGateway.
 */

export interface AlertNotificationPayload {
  ruleName: string;
  message: string;
  observedValue: number;
  threshold: number;
  condition: string;
  workspaceId: string;
  slackWebhookUrl?: string | null;
  emailAddresses?: string[];
}

export interface AlertNotificationResult {
  slackSent: boolean;
  emailSent: boolean;
}

export interface NotificationGateway {
  sendAlert(payload: AlertNotificationPayload): Promise<AlertNotificationResult>;
}

/**
 * Contrato para integração Stripe.
 * Implementado por StripeGateway (prod) ou NoOpStripeGateway (dev).
 */
export interface StripeGateway {
  createCustomer(email: string, name: string, workspaceId: string): Promise<string>;

  createCheckoutSession(input: {
    customerId: string;
    priceId: string;
    workspaceId: string;
    targetPlan?: 'pro' | 'business' | 'enterprise';
    successUrl: string;
    cancelUrl: string;
  }): Promise<string>;

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string
  ): Promise<{ type: string; data: unknown }>;
}

/**
 * Contrato para refresh tokens opacos em Redis.
 */
export interface RefreshTokenStore {
  store(
    tokenId: string,
    payload: { userId: string; workspaceId: string },
    ttlSeconds: number
  ): Promise<void>;

  get(tokenId: string): Promise<{ userId: string; workspaceId: string } | null>;

  revoke(tokenId: string): Promise<void>;
}
