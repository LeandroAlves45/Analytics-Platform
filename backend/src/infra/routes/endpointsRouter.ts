/**
 * Router dedicado à listagem de endpoints activos do workspace.
 */

import { Router } from 'express';
import { EndpointsController } from '@infra/controllers/EndpointsController';

export function createEndpointsRouter(controller: EndpointsController): Router {
  const router = Router();

  /**
   * GET /
   * Lista endpoints/métodos com tráfego recente no workspace autenticado.
   *
   * Query params: minutes? (default 1440)
   */
  router.get('/', controller.list);

  return router;
}
