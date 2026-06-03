/**
 * Router dedicado às rotas de ingestão de métricas.
 *
 * Este ficheiro define APENAS o mapeamento entre
 * HTTP verb + path → método do controller.
 *
 * Não instancia dependências. Recebe o controller
 * já construído como parâmetro (Composition Root pattern).
 */

import { Router } from 'express';
import { MetricsController } from '@infra/controllers/MetricsController';

/**
 * Cria e configura o router de métricas.
 *
 * @param controller - Instância do MetricsController criada no bootstrap.
 *                     Receber como parâmetro garante que este ficheiro
 *                     nunca instancia dependências directamente.
 * @returns Router Express configurado com as rotas de métricas.
 */
export function createMetricsRouter(controller: MetricsController): Router {
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
  router.post('/', controller.ingest);

  return router;
}
