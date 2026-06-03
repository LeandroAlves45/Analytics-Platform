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
import { DrizzleMetricsRepository } from '@infra/repositories/DrizzleMetricsRepository';
import { NoOpMetricsCacheService } from '@infra/cache/NoOpMetricsCacheService';
import { NoOpAggregationQueueService } from '@infra/queue/NoOpAggregationQueueService';
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
export function bootstrap(): AppRouters {
  // Inicializa a database.
  const db = getDatabase();

  // Instanciar o repositório com a conexão.
  // DrizzleMetricsRepository implementa a interface MetricsRepository
  // definida na application layer. O use case não sabe que é Drizzle.
  const metricsRepository = new DrizzleMetricsRepository(db);

  // Instanciar os serviços de suporte.
  const cacheService = new NoOpMetricsCacheService();
  const aggregationQueue = new NoOpAggregationQueueService();

  // Instanciar o use case com o repositório e serviços.
  // RecordMetricUseCase recebe as interfaces, não as implementações concretas.
  const recordMetricUseCase = new RecordMetricUseCase(
    metricsRepository,
    cacheService,
    aggregationQueue
  );

  // Instanciar o controller com o use case.
  const metricsController = new MetricsController(recordMetricUseCase);

  // Criar o router de métricas com o controller.
  const metricsRouter = createMetricsRouter(metricsController);

  return { metricsRouter };
}
