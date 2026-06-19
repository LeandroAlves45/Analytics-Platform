/**
 * Gateway Stripe para dev/test sem credenciais.
 */

import type { StripeGateway } from '@application/contracts/gateways';

export class NoOpStripeGateway implements StripeGateway {
  async createCustomer(): Promise<string> {
    return 'cus_dev_mock';
  }

  async createCheckoutSession(): Promise<string> {
    return 'http://localhost:5173/settings?checkout=mock';
  }

  async constructWebhookEvent() {
    return { type: 'noop', data: {} };
  }
}
