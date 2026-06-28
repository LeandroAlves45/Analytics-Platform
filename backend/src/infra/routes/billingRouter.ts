/**
 * Router de billing.
 *
 * JWT já aplicado pelo dashboardRouter pai — não repetir aqui.
 *
 * @param billingController - BillingController com handlers de billing
 */

import { Router } from 'express';
import { BillingController } from '@infra/controllers/BillingController';

export function createBillingRouter(billingController: BillingController): Router {
  const router = Router();

  router.get('/', billingController.getInfo);
  router.post('/checkout', billingController.checkout);

  return router;
}
