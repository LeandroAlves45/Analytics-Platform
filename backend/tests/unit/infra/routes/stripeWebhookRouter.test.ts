/**
 * Testes de contrato HTTP do router Stripe webhook.
 * Cobrem assinatura inválida, evento desconhecido e falha downstream.
 */

import express from 'express';
import request from 'supertest';

import { createStripeWebhookRouter } from '@infra/routes/stripeWebhookRouter';
import { errorHandlerMiddleware } from '@infra/middleware/ErrorHandlerMiddleware';
import type { StripeGateway } from '@application/contracts/gateways';
import { HandleStripeWebhookUseCase } from '@application/usecases/billing/HandleStripeWebhookUseCase';

jest.mock('@infra/frameworks/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

function makeStripeGateway(overrides?: Partial<StripeGateway>): jest.Mocked<StripeGateway> {
  return {
    createCustomer: jest.fn(),
    createCheckoutSession: jest.fn(),
    constructWebhookEvent: jest.fn(),
    ...overrides,
  } as jest.Mocked<StripeGateway>;
}

function makeWebhookApp(stripeGateway: StripeGateway, useCase: HandleStripeWebhookUseCase) {
  const app = express();
  app.use('/webhooks/stripe', createStripeWebhookRouter(stripeGateway, useCase));
  app.use(errorHandlerMiddleware);
  return app;
}

describe('createStripeWebhookRouter', () => {
  it('should return 200 when signature is valid and use case succeeds', async () => {
    const stripeGateway = makeStripeGateway({
      constructWebhookEvent: jest.fn().mockResolvedValue({
        type: 'checkout.session.completed',
        data: { id: 'cs_1' },
      }),
    });
    const execute = jest.fn().mockResolvedValue(undefined);
    const useCase = { execute } as unknown as HandleStripeWebhookUseCase;
    const app = makeWebhookApp(stripeGateway, useCase);

    const response = await request(app)
      .post('/webhooks/stripe/')
      .set('stripe-signature', 'sig_valid')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ id: 'evt_1' })));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(stripeGateway.constructWebhookEvent).toHaveBeenCalled();
    expect(execute).toHaveBeenCalledWith({
      type: 'checkout.session.completed',
      data: { id: 'cs_1' },
    });
  });

  it('should return 500 when webhook signature is invalid', async () => {
    process.env.NODE_ENV = 'development';
    const stripeGateway = makeStripeGateway({
      constructWebhookEvent: jest.fn().mockRejectedValue(new Error('Invalid signature')),
    });
    const useCase = { execute: jest.fn() } as unknown as HandleStripeWebhookUseCase;
    const app = makeWebhookApp(stripeGateway, useCase);

    const response = await request(app)
      .post('/webhooks/stripe/')
      .set('stripe-signature', 'sig_bad')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it('should return 500 when downstream use case fails', async () => {
    process.env.NODE_ENV = 'development';
    const stripeGateway = makeStripeGateway({
      constructWebhookEvent: jest.fn().mockResolvedValue({
        type: 'customer.subscription.deleted',
        data: { id: 'sub_1' },
      }),
    });
    const useCase = {
      execute: jest.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as HandleStripeWebhookUseCase;
    const app = makeWebhookApp(stripeGateway, useCase);

    const response = await request(app)
      .post('/webhooks/stripe/')
      .set('stripe-signature', 'sig_valid')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ type: 'customer.subscription.deleted' })));

    expect(response.status).toBe(500);
    expect(response.body.error.message).toBe('database unavailable');
  });

  it('should accept unknown event types and delegate to use case', async () => {
    const stripeGateway = makeStripeGateway({
      constructWebhookEvent: jest.fn().mockResolvedValue({
        type: 'unknown.event.type',
        data: { id: 'obj_1' },
      }),
    });
    const execute = jest.fn().mockResolvedValue(undefined);
    const useCase = { execute } as unknown as HandleStripeWebhookUseCase;
    const app = makeWebhookApp(stripeGateway, useCase);

    const response = await request(app)
      .post('/webhooks/stripe/')
      .set('stripe-signature', 'sig_valid')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith({
      type: 'unknown.event.type',
      data: { id: 'obj_1' },
    });
  });
});
