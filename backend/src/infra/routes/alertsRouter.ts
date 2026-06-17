/**
 * Router de alertas — monta regras e eventos sob /api/alert-rules e /api/alert-events.
 */

import { Router } from 'express';
import { AlertRulesController } from '@infra/controllers/AlertRulesController';
import { AlertEventsController } from '@infra/controllers/AlertEventsController';

export function createAlertRulesRouter(controller: AlertRulesController): Router {
  const router = Router();

  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);

  return router;
}

export function createAlertEventsRouter(controller: AlertEventsController): Router {
  const router = Router();

  router.get('/', controller.list);

  return router;
}
