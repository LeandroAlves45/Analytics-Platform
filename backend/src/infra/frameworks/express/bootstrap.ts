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
import { getRedisClient } from '@infra/frameworks/cache/redis';
import { RedisMetricsCache } from '@infra/cache/RedisMetricsCache';
import { NoOpAggregationQueueService } from '@infra/queue/NoOpAggregationQueueService';
import { DrizzleMetricsRepository } from '@infra/repositories/DrizzleMetricsRepository';
import { RecordMetricUseCase } from '@application/usecases/metrics/RecordMetricUseCase';
import { MetricsController } from '@infra/controllers/MetricsController';
import { createMetricsRouter } from '@infra/routes/metricsRouter';

/**
 * Tipo que descreve o conjunto de routers prontos a montar no app Express.
 * À medida que adicionarmos features (alertas, workspaces), este tipo cresce.
 */
export interface AppRouters {
  metricsRouter: Router;
}

/**
 * Inicializa todas as dependências da aplicação e devolve os routers
 * prontos a ser montados no app Express.
 *
 * Esta função é chamada uma única vez em main.ts antes de startServer().
 *
 * @returns Objecto com todos os routers configurados.
 */
export function bootstrap(metricsCacheTtlSeconds: number): AppRouters {
  // Passo 1: infra externa.
  const db = getDatabase();
  const redisClient = getRedisClient();

  // Passo 2: serviço de cache
  // RedisMetricsCache implementa MetricsCacheService com estratégia Cache-Aside.
  const metricsCache = new RedisMetricsCache(redisClient, metricsCacheTtlSeconds);

  // Passo 3: repositório com cache injectado
  // DrizzleMetricsRepository usa o cache em getRecent() e invalida em save().
  const metricsRepository = new DrizzleMetricsRepository(db, metricsCache);

  // TODO: Passo 4: serviço de queue (NoOp por enquanto — implementado no Sprint 3)
  const aggregationQueue = new NoOpAggregationQueueService();

  // Passo 5: use case com repositório e queue
  const recordMetricUseCase = new RecordMetricUseCase(metricsRepository, aggregationQueue);

  // Passo 6: controller e router
  const metricsController = new MetricsController(recordMetricUseCase);
  const metricsRouter = createMetricsRouter(metricsController);

  return { metricsRouter };
}
