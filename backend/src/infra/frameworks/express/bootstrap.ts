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
import { DrizzleAggregationReadRepository } from '@infra/repositories/DrizzleAggregationReadRepository';
import { DrizzleAlertRepository } from '@infra/repositories/DrizzleAlertRepository';
import { DrizzleEndpointRepository } from '@infra/repositories/DrizzleEndpointRepository';
import { RecordMetricUseCase } from '@application/usecases/metrics/RecordMetricUseCase';
import { AggregateMetricsUseCase } from '@application/usecases/aggregation/AggregateMetricsUseCase';
import { QueryAggregatedMetricsUseCase } from '@application/usecases/metrics/QueryAggregatedMetricsUseCase';
import { ListActiveEndpointsUseCase } from '@application/usecases/metrics/ListActiveEndpointsUseCase';
import { CreateAlertRuleUseCase } from '@application/usecases/alerts/CreateAlertRuleUseCase';
import { UpdateAlertRuleUseCase } from '@application/usecases/alerts/UpdateAlertRuleUseCase';
import { DeleteAlertRuleUseCase } from '@application/usecases/alerts/DeleteAlertRuleUseCase';
import { ListAlertRulesUseCase } from '@application/usecases/alerts/ListAlertRulesUseCase';
import { GetAlertRuleUseCase } from '@application/usecases/alerts/GetAlertRuleUseCase';
import { ListAlertEventsUseCase } from '@application/usecases/alerts/ListAlertEventsUseCase';
import { TriggerAlertUseCase } from '@application/usecases/alerts/TriggerAlertUseCase';
import { EvaluateAlertsUseCase } from '@application/usecases/alerts/EvaluateAlertsUseCase';
import { AggregationWorker } from '@infra/queue/AggregationWorker';
import { AggregationScheduler } from '@infra/queue/AggregationScheduler';
import { AlertEvaluationScheduler } from '@infra/queue/AlertEvaluationScheduler';
import { MetricsController } from '@infra/controllers/MetricsController';
import { MetricsQueryController } from '@infra/controllers/MetricsQueryController';
import { EndpointsController } from '@infra/controllers/EndpointsController';
import { AlertRulesController } from '@infra/controllers/AlertRulesController';
import { AlertEventsController } from '@infra/controllers/AlertEventsController';
import { SlackWebhookGateway } from '@infra/gateways/SlackWebhookGateway';
import { NodemailerEmailService } from '@infra/gateways/NodemailerEmailService';
import { CompositeNotificationGateway } from '@infra/gateways/CompositeNotificationGateway';
import { createMetricsRouter } from '@infra/routes/metricsRouter';
import { createEndpointsRouter } from '@infra/routes/endpointsRouter';
import { createAlertRulesRouter, createAlertEventsRouter } from '@infra/routes/alertsRouter';

/**
 * Tipo que descreve o conjunto de routers prontos a montar no app Express.
 * À medida que adicionarmos features (alertas, workspaces), este tipo cresce.
 */
export interface AppRouters {
  metricsRouter: Router;
  endpointsRouter: Router;
  alertRulesRouter: Router;
  alertEventsRouter: Router;
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
  alertEvaluationScheduler: AlertEvaluationScheduler;
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
  const alertRepository = new DrizzleAlertRepository(db);
  const endpointRepository = new DrizzleEndpointRepository(db);

  // Passo 4: queue BullMQ
  const aggregationQueue = new BullMQAggregationQueue(bullMQRedisClient);

  // Passo 5: gateways
  const notificationGateway = new CompositeNotificationGateway([
    new SlackWebhookGateway(),
    new NodemailerEmailService(),
  ]);

  // Passo 6: use case com repositório e queue
  const recordMetricUseCase = new RecordMetricUseCase(metricsRepository, aggregationQueue);
  const queryAggregatedMetricsUseCase = new QueryAggregatedMetricsUseCase(
    aggregationReadRepository
  );
  const listActiveEndpointsUseCase = new ListActiveEndpointsUseCase(metricsRepository);
  const aggregateMetricsUseCase = new AggregateMetricsUseCase(metricsRepository);

  const createAlertRuleUseCase = new CreateAlertRuleUseCase(alertRepository, endpointRepository);
  const updateAlertRuleUseCase = new UpdateAlertRuleUseCase(alertRepository, endpointRepository);
  const deleteAlertRuleUseCase = new DeleteAlertRuleUseCase(alertRepository);
  const listAlertRulesUseCase = new ListAlertRulesUseCase(alertRepository);
  const getAlertRuleUseCase = new GetAlertRuleUseCase(alertRepository);
  const listAlertEventsUseCase = new ListAlertEventsUseCase(alertRepository);
  const triggerAlertUseCase = new TriggerAlertUseCase(alertRepository, notificationGateway);
  const evaluateAlertsUseCase = new EvaluateAlertsUseCase(alertRepository, triggerAlertUseCase);

  // Passo 7: workers e scheduler
  const aggregationWorker = new AggregationWorker(
    aggregateMetricsUseCase,
    aggregationRepository,
    bullMQRedisClient
  );
  const aggregationScheduler = new AggregationScheduler(metricsRepository, aggregationQueue);
  const alertEvaluationScheduler = new AlertEvaluationScheduler(evaluateAlertsUseCase);

  // Arranca os schedulers de agregação (5 min) e de avaliação de alertas (60 s).
  aggregationScheduler.start();
  alertEvaluationScheduler.start();

  // Passo 8: controllers e routers
  const metricsController = new MetricsController(recordMetricUseCase);
  const metricsQueryController = new MetricsQueryController(queryAggregatedMetricsUseCase);
  const endpointsController = new EndpointsController(listActiveEndpointsUseCase);
  const alertRulesController = new AlertRulesController(
    createAlertRuleUseCase,
    updateAlertRuleUseCase,
    deleteAlertRuleUseCase,
    listAlertRulesUseCase,
    getAlertRuleUseCase
  );
  const alertEventsController = new AlertEventsController(listAlertEventsUseCase);

  return {
    routers: {
      metricsRouter: createMetricsRouter(metricsController, metricsQueryController),
      endpointsRouter: createEndpointsRouter(endpointsController),
      alertRulesRouter: createAlertRulesRouter(alertRulesController),
      alertEventsRouter: createAlertEventsRouter(alertEventsController),
    },
    lifecycle: {
      aggregationScheduler,
      aggregationWorker,
      aggregationQueue,
      alertEvaluationScheduler,
    },
  };
}
