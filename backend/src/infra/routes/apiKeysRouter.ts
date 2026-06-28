/**
 * Router de API keys de workspace.
 *
 * JWT já aplicado pelo dashboardRouter pai — não repetir aqui.
 *
 * @param controller - ApiKeysController com handlers de API keys
 */

import { Router } from 'express';
import { ApiKeysController } from '@infra/controllers/ApiKeysController';

export function createApiKeysRouter(controller: ApiKeysController): Router {
  const router = Router();

  router.get('/workspaces/:workspaceId/api-keys', controller.list);
  router.post('/workspaces/:workspaceId/api-keys', controller.create);
  router.delete('/api-keys/:id', controller.revoke);

  return router;
}
