/**
 * Composition Root da aplicação.
 *
 * Este é o ÚNICO ficheiro em todo o projecto onde as dependências
 * são instanciadas e as suas relações são definidas.
 *
 * Ordem obrigatória de instanciação (da camada mais externa para a mais interna):
 *   1. Infra externa  (database, redis)
 *   2. Repositórios   (dependem da database)
 *   3. Serviços       (dependem da config)
 *   4. Use cases      (dependem dos repositórios e serviços)
 *   5. Middlewares    (dependem dos repositórios e serviços)
 *   6. Workers        (dependem dos use cases)
 *   7. Controllers    (dependem dos use cases)
 *   8. Routers        (dependem dos controllers e middlewares)
 *
 * Esta ordem reflecte a Dependency Rule da Clean Architecture:
 * dependências apontam sempre para dentro (domain), nunca para fora.
 */

import { Router } from 'express';
import { loadConfig } from '@infra/frameworks/config';
import { getDatabase } from '@infra/frameworks/database/connection';
import { getRedisClient, getBullMQRedisClient } from '@infra/frameworks/cache/redis';
import { RedisMetricsCache } from '@infra/cache/RedisMetricsCache';
import { BullMQAggregationQueue } from '@infra/queue/BullMQAggregationQueue';
import { DrizzleMetricsRepository } from '@infra/repositories/DrizzleMetricsRepository';
import { DrizzleAggregationRepository } from '@infra/repositories/DrizzleAggregationRepository';
import { DrizzleAggregationReadRepository } from '@infra/repositories/DrizzleAggregationReadRepository';
import { DrizzleAlertRepository } from '@infra/repositories/DrizzleAlertRepository';
import { DrizzleEndpointRepository } from '@infra/repositories/DrizzleEndpointRepository';
import { DrizzleUserRepository } from '@infra/repositories/DrizzleUserRepository';
import { DrizzleWorkspaceRepository } from '@infra/repositories/DrizzleWorkspaceRepository';
import { DrizzleApiKeyRepository } from '@infra/repositories/DrizzleApiKeyRepository';
import { DrizzleUsageTrackingRepository } from '@infra/repositories/DrizzleUsageTrackingRepository';
import { DrizzleStripeSubscriptionRepository } from '@infra/repositories/DrizzleStripeSubscriptionRepository';
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
import { AuthController } from '@infra/controllers/AuthController';
import { ApiKeysController } from '@infra/controllers/ApiKeysController';
import { BillingController } from '@infra/controllers/BillingController';
import { SlackWebhookGateway } from '@infra/gateways/SlackWebhookGateway';
import { NodemailerEmailService } from '@infra/gateways/NodemailerEmailService';
import { CompositeNotificationGateway } from '@infra/gateways/CompositeNotificationGateway';
import { StripeGateway } from '@infra/gateways/StripeGateway';
import { NoOpStripeGateway } from '@infra/gateways/NoOpStripeGateway';
import { JwtService } from '@infra/services/JwtService';
import { RedisRefreshTokenStore } from '@infra/cache/RedisRefreshTokenStore';
import { createApiKeyAuthMiddleware } from '@infra/middleware/ApiKeyAuthMiddleware';
import { createJwtAuthMiddleware } from '@infra/middleware/JwtAuthMiddleware';
import { createRateLimitMiddleware } from '@infra/middleware/RateLimitMiddleware';
import { RegisterUserUseCase } from '@application/usecases/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '@application/usecases/auth/LoginUserUseCase';
import { RefreshTokenUseCase } from '@application/usecases/auth/RefreshTokenUseCase';
import { CreateApiKeyUseCase } from '@application/usecases/workspaces/CreateApiKeyUseCase';
import { ListApiKeysUseCase } from '@application/usecases/workspaces/ListApiKeysUseCase';
import { RevokeApiKeyUseCase } from '@application/usecases/workspaces/RevokeApiKeyUseCase';
import { CheckUsageQuotaUseCase } from '@application/usecases/billing/CheckUsageQuotaUseCase';
import { GetBillingInfoUseCase } from '@application/usecases/billing/GetBillingInfoUseCase';
import { CreateCheckoutSessionUseCase } from '@application/usecases/billing/CreateCheckoutSessionUseCase';
import { HandleStripeWebhookUseCase } from '@application/usecases/billing/HandleStripeWebhookUseCase';
import { createMetricsRouter } from '@infra/routes/metricsRouter';
import { createEndpointsRouter } from '@infra/routes/endpointsRouter';
import { createAlertRulesRouter, createAlertEventsRouter } from '@infra/routes/alertsRouter';
import { createAuthRouter } from '@infra/routes/authRouter';
import { createApiKeysRouter } from '@infra/routes/apiKeysRouter';
import { createBillingRouter } from '@infra/routes/billingRouter';
import { createStripeWebhookRouter } from '@infra/routes/stripeWebhookRouter';
import { createAuthRateLimitMiddleware } from '@infra/middleware/AuthRateLimitMiddleware';
import { ApiKeyAuthCache } from '@infra/cache/ApiKeyAuthCache';
import { WorkspacePlanCache } from '@infra/cache/WorkspacePlanCache';

/**
 * Tipo que descreve o conjunto de routers prontos a montar no app Express.
 *
 * - metricsRouter      → POST /api/metrics (apiKeyAuth) + GET /api/metrics/aggregated (JWT)
 * - authRouter         → POST /api/auth/register|login|refresh (público) + GET /api/auth/me (JWT)
 * - dashboardRouter    → todas as rotas JWT-protegidas do dashboard (endpoints, alertas, api-keys, billing)
 */
export interface AppRouters {
  metricsRouter: Router;
  authRouter: Router;
  dashboardRouter: Router;
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

/**
 * Resultado de bootstrap() — routers prontos a montar + lifecycle para graceful shutdown.
 * `stripeWebhookRouter` é exposto ao nível raiz para ser passado a createApp() ANTES
 * do JSON parser (raw body necessário para a Stripe signature verification).
 */
export interface BootstrapResult {
  routers: AppRouters;
  lifecycle: AppLifecycle;
  stripeWebhookRouter: Router;
}

/**
 * Inicializa todas as dependências da aplicação e devolve os routers
 * prontos a ser montados no app Express.
 *
 * Esta função é chamada uma única vez em main.ts antes de startServer().
 *
 * @param metricsCacheTtlSeconds - TTL do cache Redis de métricas (segundos)
 * @param config                 - Configuração validada da aplicação
 * @returns Objecto com routers, lifecycle e webhook Stripe
 */
export function bootstrap(
  metricsCacheTtlSeconds: number,
  config: ReturnType<typeof loadConfig>
): BootstrapResult {
  // Passo 1: infra externa.
  const db = getDatabase();
  const redisClient = getRedisClient();
  const bullMQRedisClient = getBullMQRedisClient();

  // Passo 2: serviço de cache
  // RedisMetricsCache implementa MetricsCacheService com estratégia Cache-Aside.
  const metricsCache = new RedisMetricsCache(redisClient, metricsCacheTtlSeconds);
  const apiKeyAuthCache = new ApiKeyAuthCache(redisClient);
  const workspacePlanCache = new WorkspacePlanCache(redisClient);

  // Passo 3: repositórios com cache injectado onde aplicável
  const metricsRepository = new DrizzleMetricsRepository(db, metricsCache);
  const aggregationRepository = new DrizzleAggregationRepository(db);
  const aggregationReadRepository = new DrizzleAggregationReadRepository(db);
  const alertRepository = new DrizzleAlertRepository(db);
  const endpointRepository = new DrizzleEndpointRepository(db);
  const userRepository = new DrizzleUserRepository(db);
  const workspaceRepository = new DrizzleWorkspaceRepository(db);
  const apiKeyRepository = new DrizzleApiKeyRepository(db);
  const stripeSubscriptionRepository = new DrizzleStripeSubscriptionRepository(db);
  const usageTrackingRepository = new DrizzleUsageTrackingRepository(db);
  const refreshTokenStore = new RedisRefreshTokenStore(redisClient);

  // Passo 4: serviços de domínio
  const jwtService = new JwtService(config);

  // Passo 5: queue BullMQ
  const aggregationQueue = new BullMQAggregationQueue(bullMQRedisClient);

  // Passo 6: gateways externos
  const notificationGateway = new CompositeNotificationGateway([
    new SlackWebhookGateway(),
    new NodemailerEmailService(),
  ]);

  // Stripe real se STRIPE_SECRET_KEY existir; NoOp em dev sem chave configurada.
  const stripeGateway = config.STRIPE_SECRET_KEY
    ? new StripeGateway(config)
    : new NoOpStripeGateway();

  // Passo 7: use cases
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

  // refreshTokenTtlSeconds vem de config
  const registerUserUseCase = new RegisterUserUseCase(
    userRepository,
    workspaceRepository,
    jwtService,
    refreshTokenStore,
    config.REFRESH_TOKEN_TTL_SECONDS,
    config.JWT_EXPIRES_IN
  );
  const loginUserUseCase = new LoginUserUseCase(
    userRepository,
    workspaceRepository,
    jwtService,
    refreshTokenStore,
    config.REFRESH_TOKEN_TTL_SECONDS,
    config.JWT_EXPIRES_IN
  );
  const refreshTokenUseCase = new RefreshTokenUseCase(
    userRepository,
    jwtService,
    refreshTokenStore,
    config.REFRESH_TOKEN_TTL_SECONDS,
    config.JWT_EXPIRES_IN
  );

  const createApiKeyUseCase = new CreateApiKeyUseCase(apiKeyRepository, workspaceRepository);
  const listApiKeysUseCase = new ListApiKeysUseCase(apiKeyRepository, workspaceRepository);
  const revokeApiKeyUseCase = new RevokeApiKeyUseCase(
    apiKeyRepository,
    workspaceRepository,
    apiKeyAuthCache
  );

  const checkUsageQuotaUseCase = new CheckUsageQuotaUseCase(
    usageTrackingRepository,
    workspaceRepository
  );
  const getBillingInfoUseCase = new GetBillingInfoUseCase(
    usageTrackingRepository,
    workspaceRepository,
    stripeSubscriptionRepository
  );
  const createCheckoutSessionUseCase = new CreateCheckoutSessionUseCase(
    stripeGateway,
    stripeSubscriptionRepository,
    workspaceRepository,
    userRepository,
    config
  );
  const handleStripeWebhookUseCase = new HandleStripeWebhookUseCase(
    stripeSubscriptionRepository,
    workspaceRepository,
    workspacePlanCache
  );

  const recordMetricUseCase = new RecordMetricUseCase(
    metricsRepository,
    aggregationQueue,
    checkUsageQuotaUseCase,
    usageTrackingRepository
  );

  // Passo 8: middlewares
  const apiKeyAuth = createApiKeyAuthMiddleware(apiKeyRepository, apiKeyAuthCache);
  const jwtAuth = createJwtAuthMiddleware(jwtService);
  const rateLimit = createRateLimitMiddleware(redisClient, workspaceRepository, workspacePlanCache);
  const loginRateLimit = createAuthRateLimitMiddleware(redisClient, 'login');
  const registerRateLimit = createAuthRateLimitMiddleware(redisClient, 'register');
  const refreshRateLimit = createAuthRateLimitMiddleware(redisClient, 'refresh');

  // Passo 9: workers e schedulers
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

  // Passo 10: controllers
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
  const authController = new AuthController(
    registerUserUseCase,
    loginUserUseCase,
    refreshTokenUseCase,
    userRepository,
    refreshTokenStore,
    config.REFRESH_TOKEN_TTL_SECONDS
  );
  const apiKeysController = new ApiKeysController(
    createApiKeyUseCase,
    listApiKeysUseCase,
    revokeApiKeyUseCase
  );
  const billingController = new BillingController(
    getBillingInfoUseCase,
    createCheckoutSessionUseCase
  );

  // Passo 11: routers
  //
  // dashboardRouter agrupa todas as rotas JWT-protegidas do dashboard.
  // O jwtAuth é aplicado uma única vez aqui — os routers filhos não o repetem.
  const dashboardRouter = Router();
  dashboardRouter.use(jwtAuth);
  dashboardRouter.use('/endpoints', createEndpointsRouter(endpointsController));
  dashboardRouter.use('/alert-rules', createAlertRulesRouter(alertRulesController));
  dashboardRouter.use('/alert-events', createAlertEventsRouter(alertEventsController));
  dashboardRouter.use('/', createApiKeysRouter(apiKeysController));
  dashboardRouter.use('/billing', createBillingRouter(billingController));

  // authRouter: rotas públicas + /me protegido com JWT
  const authRouter = createAuthRouter(
    authController,
    jwtAuth,
    loginRateLimit,
    registerRateLimit,
    refreshRateLimit
  );

  // stripeWebhookRouter exposto em top-level para main.ts o passar a createApp()
  // antes do JSON parser (raw body necessário para Stripe signature verification).
  const stripeWebhookRouter = createStripeWebhookRouter(stripeGateway, handleStripeWebhookUseCase);

  return {
    routers: {
      metricsRouter: createMetricsRouter(
        metricsController,
        metricsQueryController,
        apiKeyAuth,
        rateLimit,
        jwtAuth
      ),
      authRouter,
      dashboardRouter,
    },
    lifecycle: {
      aggregationScheduler,
      aggregationWorker,
      aggregationQueue,
      alertEvaluationScheduler,
    },
    stripeWebhookRouter,
  };
}
