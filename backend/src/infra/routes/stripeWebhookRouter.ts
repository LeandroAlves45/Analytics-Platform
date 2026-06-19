/**
 * Router Stripe webhook — requer raw body, não JSON parsed.
 *
 * Montado em createApp() ANTES de express.json() para preservar
 * o body original necessário à verificação de assinatura Stripe.
 */

import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import type { StripeGateway } from '@application/contracts/gateways';
import { HandleStripeWebhookUseCase } from '@application/usecases/billing/HandleStripeWebhookUseCase';

export function createStripeWebhookRouter(
  stripeGateway: StripeGateway,
  handleWebhookUseCase: HandleStripeWebhookUseCase
): Router {
  const router = Router();

  router.post(
    '/',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const signature = req.headers['stripe-signature'] as string;
        const event = await stripeGateway.constructWebhookEvent(req.body as Buffer, signature);
        await handleWebhookUseCase.execute(event);
        res.status(200).json({ received: true });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
