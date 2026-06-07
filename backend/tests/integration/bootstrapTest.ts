/**
 * Bootstrap alternativo para testes de integração.
 *
 * Idêntico ao bootstrap.ts de produção, com duas diferenças:
 * 1. usa NoOpMetricsCacheService em vez de RedisMetricsCache.
 * 2. monta um middleware que simula o AuthMiddleware (ainda não implementado —
 *    sprint 6), injectando workspaceId/apiKeyId de teste no request.
 *
 * Motivo (1): testes de integração focam-se na camada BD + HTTP.
 * Adicionar Redis como dependência obrigatória tornaria a suite
 * dependente de dois serviços externos em vez de um.
 * O comportamento do cache é testado nos testes unitários do RedisMetricsCache.
 *
 * Motivo (2): sem este middleware, o MetricsController usa o fallback
 * dev (DEV_WORKSPACE_ID/DEV_API_KEY_ID), e os testes não conseguiriam
 * verificar que o workspaceId/apiKeyId autenticados chegam corretamente
 * à BD. Isto simula o contrato real de produção: o cliente nunca indica
 * o seu próprio workspaceId — vem sempre do contexto de autenticação.
 */

import { NextFunction, Response, Router } from 'express';
import { getDatabase } from '@infra/frameworks/database';
import { NoOpMetricsCacheService } from '@infra/cache/NoOpMetricsCacheService';
import { NoOpAggregationQueueService } from '@infra/queue/NoOpAggregationQueueService';
import { DrizzleMetricsRepository } from '@infra/repositories/DrizzleMetricsRepository';
import { RecordMetricUseCase } from '@application/usecases/metrics/RecordMetricUseCase';
import { MetricsController, AuthenticatedRequest } from '@infra/controllers/MetricsController';
import { createMetricsRouter } from '@infra/routes/metricsRouter';
import { TEST_API_KEY_ID, TEST_WORKSPACE_ID } from '../fixtures/metrics';

export interface TestAppRouters {
  metricsRouter: Router;
}

/**
 * Substitui temporariamente o AuthMiddleware nos testes de integração,
 * injectando os valores de workspaceId/apiKeyId que o middleware real
 * vai extrair da API Key autenticada.
 */
function simulateAuthMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  req.workspaceId = TEST_WORKSPACE_ID;
  req.apiKeyId = TEST_API_KEY_ID;
  next();
}

export function bootstrapForTesting(): TestAppRouters {
  const db = getDatabase();

  // Cache NoOp: nunca falha, nunca guarda nada, nunca invalida nada.
  const metricsCache = new NoOpMetricsCacheService();

  const metricsRepository = new DrizzleMetricsRepository(db, metricsCache);

  const aggregationService = new NoOpAggregationQueueService();

  const recordMetricUseCase = new RecordMetricUseCase(metricsRepository, aggregationService);

  const metricsController = new MetricsController(recordMetricUseCase);

  const metricsRouter = Router();
  metricsRouter.use(simulateAuthMiddleware);
  metricsRouter.use(createMetricsRouter(metricsController));

  return { metricsRouter };
}
