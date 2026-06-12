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
import { DrizzleAggregationReadRepository } from '@infra/repositories/DrizzleAggregationReadRepository';
import { RecordMetricUseCase } from '@application/usecases/metrics/RecordMetricUseCase';
import { QueryAggregatedMetricsUseCase } from '@application/usecases/metrics/QueryAggregatedMetricsUseCase';
import { ListActiveEndpointsUseCase } from '@application/usecases/metrics/ListActiveEndpointsUseCase';
import { MetricsController, AuthenticatedRequest } from '@infra/controllers/MetricsController';
import { MetricsQueryController } from '@infra/controllers/MetricsQueryController';
import { EndpointsController } from '@infra/controllers/EndpointsController';
import { createMetricsRouter } from '@infra/routes/metricsRouter';
import { createEndpointsRouter } from '@infra/routes/endpointsRouter';
import { TEST_API_KEY_ID, TEST_WORKSPACE_ID } from '../fixtures/metrics';

export interface TestAppRouters {
  metricsRouter: Router;
  endpointsRouter: Router;
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
/**
 *
 * @param router - O router a ser autenticado.
 * @returns Um novo router com o middleware de autenticação.
 */
function withAuth(router: Router): Router {
  const wrapped = Router();
  wrapped.use(simulateAuthMiddleware);
  wrapped.use(router);
  return wrapped;
}

export function bootstrapForTesting(): TestAppRouters {
  const db = getDatabase();

  // Cache NoOp: nunca falha, nunca guarda nada, nunca invalida nada.
  const metricsCache = new NoOpMetricsCacheService();

  const metricsRepository = new DrizzleMetricsRepository(db, metricsCache);

  const aggregationReadRepository = new DrizzleAggregationReadRepository(db);

  const aggregationService = new NoOpAggregationQueueService();

  const recordMetricUseCase = new RecordMetricUseCase(metricsRepository, aggregationService);

  const queryAggregatedMetricsUseCase = new QueryAggregatedMetricsUseCase(
    aggregationReadRepository
  );

  const listActiveEndpointsUseCase = new ListActiveEndpointsUseCase(metricsRepository);

  const metricsController = new MetricsController(recordMetricUseCase);

  const metricsQueryController = new MetricsQueryController(queryAggregatedMetricsUseCase);

  const endpointsController = new EndpointsController(listActiveEndpointsUseCase);

  return {
    metricsRouter: withAuth(createMetricsRouter(metricsController, metricsQueryController)),
    endpointsRouter: withAuth(createEndpointsRouter(endpointsController)),
  };
}
