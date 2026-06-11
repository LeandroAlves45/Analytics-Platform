/**
 * Composition Root da aplicação.
 *
 * Este é o ÚNICO ficheiro em todo o projecto onde as dependências
 * são instanciadas e as suas relações são definidas.
 *
 * Ordem obrigatória de instanciação (da camada mais externa para a mais interna):
 *   1. Infra externa  (database, redis)
 *   2. Repositórios   (dependem da database)
 *   3. Use cases      (dependem dos repositórios)
 *   4. Controllers    (dependem dos use cases)
 *   5. Routers        (dependem dos controllers)
 *
 * Esta ordem reflecte a Dependency Rule da Clean Architecture:
 * dependências apontam sempre para dentro (domain), nunca para fora.
 */

import { Router } from 'express';
import { getDatabase } from '@infra/frameworks/database/connection';
import { getRedisClient, getBullMQRedisClient } from '@infra/frameworks/cache/redis';
import { RedisMetricsCache } from '@infra/cache/RedisMetricsCache';
import { BullMQAggregationQueue } from '@infra/queue/BullMQAggregationQueue';
import { DrizzleMetricsRepository } from '@infra/repositories/DrizzleMetricsRepository';
import { DrizzleAggregationRepository } from '@infra/repositories/DrizzleAggregationRepository';
import { RecordMetricUseCase } from '@application/usecases/metrics/RecordMetricUseCase';
import { AggregateMetricsUseCase } from '@application/usecases/aggregation/AggregateMetricsUseCase';
import { AggregationWorker } from '@infra/queue/AggregationWorker';
import { AggregationScheduler } from '@infra/queue/AggregationScheduler';
import { MetricsController } from '@infra/controllers/MetricsController';
import { DrizzleAggregationReadRepository } from '@infra/repositories/DrizzleAggregationReadRepository';
import { QueryAggregatedMetricsUseCase } from '@application/usecases/metrics/QueryAggregatedMetricsUseCase';
import { ListActiveEndpointsUseCase } from '@application/usecases/metrics/ListActiveEndpointsUseCase';
import { MetricsQueryController } from '@infra/controllers/MetricsQueryController';
import { EndpointsController } from '@infra/controllers/EndpointsController';
import { createMetricsRouter } from '@infra/routes/metricsRouter';
import { createEndpointsRouter } from '@infra/routes/endpointsRouter';

/**
 * Tipo que descreve o conjunto de routers prontos a montar no app Express.
 * À medida que adicionarmos features (alertas, workspaces), este tipo cresce.
 */
export interface AppRouters {
  metricsRouter: Router;
  endpointsRouter: Router;
}

/**
 * Expõe os componentes com ciclo de vida que precisam de ser fechados
 * no graceful shutdown em main.ts.
 *
 * A ordem de shutdown é inversa à ordem de arranque:
 * scheduler → worker → queue → redis → database
 */
export interface AppLifecycle {
  aggregationScheduler: AggregationScheduler;
  aggregationWorker: AggregationWorker;
  aggregationQueue: BullMQAggregationQueue;
}

export interface BootstrapResult {
  routers: AppRouters;
  lifecycle: AppLifecycle;
}

/**
 * Inicializa todas as dependências da aplicação e devolve os routers
 * prontos a ser montados no app Express.
 *
 * Esta função é chamada uma única vez em main.ts antes de startServer().
 *
 * @returns Objecto com todos os routers configurados.
 */
export function bootstrap(metricsCacheTtlSeconds: number): BootstrapResult {
  // Passo 1: infra externa.
  const db = getDatabase();
  const redisClient = getRedisClient();
  const bullMQRedisClient = getBullMQRedisClient();

  // Passo 2: serviço de cache
  // RedisMetricsCache implementa MetricsCacheService com estratégia Cache-Aside.
  const metricsCache = new RedisMetricsCache(redisClient, metricsCacheTtlSeconds);

  // Passo 3: repositório com cache injectado
  // DrizzleMetricsRepository usa o cache em getRecent() e invalida em save().
  const metricsRepository = new DrizzleMetricsRepository(db, metricsCache);
  const aggregationRepository = new DrizzleAggregationRepository(db);
  const aggregationReadRepository = new DrizzleAggregationReadRepository(db);

  // Passo 4: queue BullMQ
  const aggregationQueue = new BullMQAggregationQueue(bullMQRedisClient);

  // Passo 5: use case com repositório e queue
  const recordMetricUseCase = new RecordMetricUseCase(metricsRepository, aggregationQueue);
  const queryAggregatedMetricsUseCase = new QueryAggregatedMetricsUseCase(
    aggregationReadRepository
  );
  const listActiveEndpointsUseCase = new ListActiveEndpointsUseCase(metricsRepository);
  const aggregateMetricsUseCase = new AggregateMetricsUseCase(metricsRepository);

  // Passo 6: workers e scheduler
  const aggregationWorker = new AggregationWorker(
    aggregateMetricsUseCase,
    aggregationRepository,
    bullMQRedisClient
  );
  const aggregationScheduler = new AggregationScheduler(metricsRepository, aggregationQueue);

  // Arranca o scheduler -> começa a enfileirar jobs a cada 5 minutos.
  aggregationScheduler.start();

  // Passo 7: controller e router
  const metricsController = new MetricsController(recordMetricUseCase);
  const metricsQueryController = new MetricsQueryController(queryAggregatedMetricsUseCase);
  const endpointsController = new EndpointsController(listActiveEndpointsUseCase);

  const metricsRouter = createMetricsRouter(metricsController, metricsQueryController);
  const endpointsRouter = createEndpointsRouter(endpointsController);

  return {
    routers: { metricsRouter, endpointsRouter },
    lifecycle: { aggregationScheduler, aggregationWorker, aggregationQueue },
  };
}
