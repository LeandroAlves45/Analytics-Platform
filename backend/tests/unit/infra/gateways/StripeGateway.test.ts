/**
 * Testes unitários do StripeGateway real.
 * Cobrem configuração em falta, constructWebhookEvent e falha de assinatura.
 */

const mockConstructEvent = jest.fn();
const mockCustomersCreate = jest.fn();
const mockCheckoutCreate = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    customers: {
      create: mockCustomersCreate,
    },
    checkout: {
      sessions: {
        create: mockCheckoutCreate,
      },
    },
  }));
});

import { StripeGateway } from '@infra/gateways/StripeGateway';
import { AppError } from '@shared/errors';
import type { Config } from '@infra/frameworks/config';

function makeConfig(overrides?: Partial<Config>): Config {
  return {
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_PRICE_PRO: 'price_pro',
    STRIPE_PRICE_BUSINESS: 'price_business',
    STRIPE_PRICE_ENTERPRISE: 'price_enterprise',
    ...overrides,
  } as Config;
}

describe('StripeGateway', () => {
  beforeEach(() => {
    mockConstructEvent.mockReset();
    mockCustomersCreate.mockReset();
    mockCheckoutCreate.mockReset();
  });

  it('should throw AppError when STRIPE_SECRET_KEY is missing', () => {
    expect(() => new StripeGateway(makeConfig({ STRIPE_SECRET_KEY: undefined }))).toThrow(AppError);
  });

  it('should throw AppError when STRIPE_WEBHOOK_SECRET is missing', () => {
    expect(() => new StripeGateway(makeConfig({ STRIPE_WEBHOOK_SECRET: undefined }))).toThrow(
      AppError
    );
  });

  it('should construct webhook event from raw body and signature', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.paid',
      data: { object: { id: 'in_1' } },
    });
    const gateway = new StripeGateway(makeConfig());
    const rawBody = Buffer.from('{"id":"evt_1"}');

    const event = await gateway.constructWebhookEvent(rawBody, 'sig_header');

    expect(mockConstructEvent).toHaveBeenCalledWith(rawBody, 'sig_header', 'whsec_test');
    expect(event).toEqual({
      type: 'invoice.paid',
      data: { id: 'in_1' },
    });
  });

  it('should propagate signature verification failure from Stripe SDK', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });
    const gateway = new StripeGateway(makeConfig());

    await expect(gateway.constructWebhookEvent(Buffer.from('{}'), 'bad_sig')).rejects.toThrow(
      'No signatures found'
    );
  });

  it('should create checkout session and return url', async () => {
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });
    const gateway = new StripeGateway(makeConfig());

    const url = await gateway.createCheckoutSession({
      customerId: 'cus_1',
      priceId: 'price_pro',
      workspaceId: 'ws-1',
      targetPlan: 'pro',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });

    expect(url).toBe('https://checkout.stripe.com/session');
  });

  it('should throw AppError when checkout session has no url', async () => {
    mockCheckoutCreate.mockResolvedValue({ url: null });
    const gateway = new StripeGateway(makeConfig());

    await expect(
      gateway.createCheckoutSession({
        customerId: 'cus_1',
        priceId: 'price_pro',
        workspaceId: 'ws-1',
        targetPlan: 'pro',
        successUrl: 'https://app/success',
        cancelUrl: 'https://app/cancel',
      })
    ).rejects.toMatchObject({
      message: 'Failed to create checkout session',
      statusCode: 500,
    });
  });
});
