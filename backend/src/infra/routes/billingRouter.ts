/**
 * Router de billing — checkout Stripe e futuros endpoints de consumo.
 */

import { Router, RequestHandler } from 'express';
import { BillingController } from '@infra/controllers/BillingController';

export function createBillingRouter(
  billingController: BillingController,
  jwtAuth: RequestHandler
): Router {
  const router = Router();

  router.post('/checkout', jwtAuth, billingController.createCheckout);

  return router;
}
