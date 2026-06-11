/**
 * Router dedicado às rotas de métricas (ingestão + consulta agregada).
 *
 * Este ficheiro define APENAS o mapeamento entre
 * HTTP verb + path → método do controller.
 */

import { Router } from 'express';
import { MetricsController } from '@infra/controllers/MetricsController';
import { MetricsQueryController } from '@infra/controllers/MetricsQueryController';

/**
 * Cria e configura o router de métricas.
 *
 * @param ingestController - POST /api/metrics
 * @param queryController  - GET /api/metrics/aggregated
 */
export function createMetricsRouter(
  ingestController: MetricsController,
  queryController: MetricsQueryController
): Router {
  const router = Router();

  /**
   * POST /api/metrics
   *
   * Endpoint de ingestão de uma métrica.
   * O body deve seguir o schema definido no MetricsController (Zod).
   *
   * Respostas possíveis:
   *   202 Accepted       — métrica recebida e persistida
   *   422 Unprocessable  — body inválido (Zod validation)
   *   409 Conflict       — requestId duplicado
   *   500 Internal       — erro inesperado (tratado pelo errorHandlerMiddleware)
   */
  router.post('/', ingestController.ingest);

  /**
   * GET /aggregated
   * Consulta de série temporal agregada.
   *
   * Query params: from, to, interval, endpoint?, method?
   */
  router.get('/aggregated', queryController.getAggregated);

  return router;
}
