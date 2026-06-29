/**
 * Bootstrap alternativo para testes de integração.
 *
 * Exporta duas funções com propósitos distintos:
 *
 * `bootstrapForTesting()` — idêntico ao bootstrap.ts de produção, com três diferenças:
 *   1. Usa NoOpMetricsCacheService em vez de RedisMetricsCache — sem dependência Redis.
 *   2. Usa NoOpAggregationQueueService — sem BullMQ.
 *   3. Usa dois middlewares de simulação de autenticação:
 *      - simulateAuthMiddleware  → workspaceId + apiKeyId para ingestão (POST /api/metrics)
 *      - simulateJwtMiddleware   → workspaceId + userId para dashboard (endpoints, alertas, billing)
 *   Usado pelos testes de alertas, métricas e billing que não testam auth.
 *
 * `bootstrapForAuthTesting()` — usa JWT e API key reais (sem Redis):
 *   1. JwtService real com config de testes.
 *   2. ApiKeyAuthMiddleware real — valida API keys na BD.
 *   3. Rate limiting substituído por passthroughMiddleware — sem Redis em testes.
 *   Usado pelos testes de auth e isolamento multi-tenant.
 *
 * O comportamento real de auth (JWT, API keys) é coberto pelos testes de integração
 * específicos de auth — o bootstrapForTesting não depende de tokens.
 */

import { NextFunction, Response, Router, RequestHandler } from 'express';
import { getDatabase } from '@infra/frameworks/database';
import { NoOpMetricsCacheService } from '@infra/cache/NoOpMetricsCacheService';
import { NoOpAggregationQueueService } from '@infra/queue/NoOpAggregationQueueService';
import { DrizzleMetricsRepository } from '@infra/repositories/DrizzleMetricsRepository';
import { DrizzleAggregationReadRepository } from '@infra/repositories/DrizzleAggregationReadRepository';
import { DrizzleAlertRepository } from '@infra/repositories/DrizzleAlertRepository';
import { DrizzleEndpointRepository } from '@infra/repositories/DrizzleEndpointRepository';
import { DrizzleWorkspaceRepository } from '@infra/repositories/DrizzleWorkspaceRepository';
import { DrizzleUserRepository } from '@infra/repositories/DrizzleUserRepository';
import { DrizzleStripeSubscriptionRepository } from '@infra/repositories/DrizzleStripeSubscriptionRepository';
import { DrizzleUsageTrackingRepository } from '@infra/repositories/DrizzleUsageTrackingRepository';
import { DrizzleApiKeyRepository } from '@infra/repositories/DrizzleApiKeyRepository';
import { RecordMetricUseCase } from '@application/usecases/metrics/RecordMetricUseCase';
import { QueryAggregatedMetricsUseCase } from '@application/usecases/metrics/QueryAggregatedMetricsUseCase';
import { ListActiveEndpointsUseCase } from '@application/usecases/metrics/ListActiveEndpointsUseCase';
import { CheckUsageQuotaUseCase } from '@application/usecases/billing/CheckUsageQuotaUseCase';
import { GetBillingInfoUseCase } from '@application/usecases/billing/GetBillingInfoUseCase';
import { CreateCheckoutSessionUseCase } from '@application/usecases/billing/CreateCheckoutSessionUseCase';
import { CreateAlertRuleUseCase } from '@application/usecases/alerts/CreateAlertRuleUseCase';
import { TriggerAlertUseCase } from '@application/usecases/alerts/TriggerAlertUseCase';
import { UpdateAlertRuleUseCase } from '@application/usecases/alerts/UpdateAlertRuleUseCase';
import { DeleteAlertRuleUseCase } from '@application/usecases/alerts/DeleteAlertRuleUseCase';
import { ListAlertRulesUseCase } from '@application/usecases/alerts/ListAlertRulesUseCase';
import { GetAlertRuleUseCase } from '@application/usecases/alerts/GetAlertRuleUseCase';
import { ListAlertEventsUseCase } from '@application/usecases/alerts/ListAlertEventsUseCase';
import { RegisterUserUseCase } from '@application/usecases/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '@application/usecases/auth/LoginUserUseCase';
import { RefreshTokenUseCase } from '@application/usecases/auth/RefreshTokenUseCase';
import { CreateApiKeyUseCase } from '@application/usecases/workspaces/CreateApiKeyUseCase';
import { ListApiKeysUseCase } from '@application/usecases/workspaces/ListApiKeysUseCase';
import { RevokeApiKeyUseCase } from '@application/usecases/workspaces/RevokeApiKeyUseCase';
import { MetricsController } from '@infra/controllers/MetricsController';
import { MetricsQueryController } from '@infra/controllers/MetricsQueryController';
import { EndpointsController } from '@infra/controllers/EndpointsController';
import { AlertRulesController } from '@infra/controllers/AlertRulesController';
import { AlertEventsController } from '@infra/controllers/AlertEventsController';
import { AuthController } from '@infra/controllers/AuthController';
import { ApiKeysController } from '@infra/controllers/ApiKeysController';
import { BillingController } from '@infra/controllers/BillingController';
import { NoOpNotificationGateway } from '@infra/gateways/NoOpNotificationGateway';
import { NoOpStripeGateway } from '@infra/gateways/NoOpStripeGateway';
import { NoOpRefreshTokenStore } from '@infra/cache/NoOpRefreshTokenStore';
import { NoOpApiKeyAuthCache } from '../helpers/NoOpApiKeyAuthCache';
import { JwtService } from '@infra/services/JwtService';
import { createJwtAuthMiddleware } from '@infra/middleware/JwtAuthMiddleware';
import { createApiKeyAuthMiddleware } from '@infra/middleware/ApiKeyAuthMiddleware';
import { createMetricsRouter } from '@infra/routes/metricsRouter';
import { createEndpointsRouter } from '@infra/routes/endpointsRouter';
import { createAlertRulesRouter, createAlertEventsRouter } from '@infra/routes/alertsRouter';
import { createBillingRouter } from '@infra/routes/billingRouter';
import { createAuthRouter } from '@infra/routes/authRouter';
import { createApiKeysRouter } from '@infra/routes/apiKeysRouter';
import { loadConfig } from '@infra/frameworks/config';
import { TEST_API_KEY_ID, TEST_WORKSPACE_ID } from '../fixtures/metrics';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { DEV_USER_ID } from '@infra/controllers/resolveTenantContext';
import type { AppRouters } from '@infra/frameworks/express/bootstrap';

const passthroughMiddleware: RequestHandler = (_req, _res, next) => next();

/** Simula API key auth para POST /api/metrics — injeta workspaceId e apiKeyId. */
function simulateAuthMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  req.workspaceId = TEST_WORKSPACE_ID;
  req.apiKeyId = TEST_API_KEY_ID;
  next();
}

/** Simula JWT auth para rotas dashboard — injeta workspaceId e userId. */
function simulateJwtMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  req.workspaceId = TEST_WORKSPACE_ID;
  req.userId = DEV_USER_ID;
  next();
}

function withIngestAuth(router: Router): Router {
  const wrapped = Router();
  wrapped.use(simulateAuthMiddleware);
  wrapped.use(router);
  return wrapped;
}

/**
 * Bootstrap para testes de alertas, métricas e billing.
 *
 * Usa middleware simulado — sem JWT real nem API key real.
 * Compatível com todos os testes de integração anteriores ao Sprint 6.
 */
export function bootstrapForTesting(): AppRouters & { triggerAlertUseCase: TriggerAlertUseCase } {
  const db = getDatabase();
  const config = loadConfig();

  const metricsCache = new NoOpMetricsCacheService();
  const aggregationService = new NoOpAggregationQueueService();
  const notificationGateway = new NoOpNotificationGateway();

  // Repositórios
  const metricsRepository = new DrizzleMetricsRepository(db, metricsCache);
  const aggregationReadRepository = new DrizzleAggregationReadRepository(db);
  const alertRepository = new DrizzleAlertRepository(db);
  const endpointRepository = new DrizzleEndpointRepository(db);
  const workspaceRepository = new DrizzleWorkspaceRepository(db);
  const userRepository = new DrizzleUserRepository(db);
  const stripeSubscriptionRepository = new DrizzleStripeSubscriptionRepository(db);
  const usageTrackingRepository = new DrizzleUsageTrackingRepository(db);
  const apiKeyRepository = new DrizzleApiKeyRepository(db);

  // Cache in-memory — sem Redis
  const apiKeyAuthCache = new NoOpApiKeyAuthCache();

  // Use cases — métricas
  const checkUsageQuotaUseCase = new CheckUsageQuotaUseCase(
    usageTrackingRepository,
    workspaceRepository
  );
  const recordMetricUseCase = new RecordMetricUseCase(
    metricsRepository,
    aggregationService,
    checkUsageQuotaUseCase,
    usageTrackingRepository
  );
  const queryAggregatedMetricsUseCase = new QueryAggregatedMetricsUseCase(
    aggregationReadRepository
  );
  const listActiveEndpointsUseCase = new ListActiveEndpointsUseCase(metricsRepository);

  // Use cases — alertas
  const createAlertRuleUseCase = new CreateAlertRuleUseCase(alertRepository, endpointRepository);
  const updateAlertRuleUseCase = new UpdateAlertRuleUseCase(alertRepository, endpointRepository);
  const deleteAlertRuleUseCase = new DeleteAlertRuleUseCase(alertRepository);
  const listAlertRulesUseCase = new ListAlertRulesUseCase(alertRepository);
  const getAlertRuleUseCase = new GetAlertRuleUseCase(alertRepository);
  const listAlertEventsUseCase = new ListAlertEventsUseCase(alertRepository);
  const triggerAlertUseCase = new TriggerAlertUseCase(alertRepository, notificationGateway);

  // Use cases — billing
  const getBillingInfoUseCase = new GetBillingInfoUseCase(
    usageTrackingRepository,
    workspaceRepository,
    stripeSubscriptionRepository
  );
  const createCheckoutSessionUseCase = new CreateCheckoutSessionUseCase(
    new NoOpStripeGateway(),
    stripeSubscriptionRepository,
    workspaceRepository,
    userRepository,
    config
  );

  // Use cases — api-keys (necessários para ApiKeysController no dashboardRouter)
  const createApiKeyUseCase = new CreateApiKeyUseCase(apiKeyRepository, workspaceRepository);
  const listApiKeysUseCase = new ListApiKeysUseCase(apiKeyRepository, workspaceRepository);
  const revokeApiKeyUseCase = new RevokeApiKeyUseCase(
    apiKeyRepository,
    workspaceRepository,
    apiKeyAuthCache
  );

  // Controllers
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
  const billingController = new BillingController(
    getBillingInfoUseCase,
    createCheckoutSessionUseCase
  );
  const apiKeysController = new ApiKeysController(
    createApiKeyUseCase,
    listApiKeysUseCase,
    revokeApiKeyUseCase
  );

  // metricsRouter: POST / com simulação de API key auth; GET /aggregated sem middleware real
  const metricsRouter = withIngestAuth(
    createMetricsRouter(
      metricsController,
      metricsQueryController,
      passthroughMiddleware,
      passthroughMiddleware,
      passthroughMiddleware
    )
  );

  // dashboardRouter: todas as rotas protegidas por JWT simulado
  const dashboardRouter = Router();
  dashboardRouter.use(simulateJwtMiddleware);
  dashboardRouter.use('/endpoints', createEndpointsRouter(endpointsController));
  dashboardRouter.use('/alert-rules', createAlertRulesRouter(alertRulesController));
  dashboardRouter.use('/alert-events', createAlertEventsRouter(alertEventsController));
  dashboardRouter.use('/billing', createBillingRouter(billingController));
  dashboardRouter.use('/', createApiKeysRouter(apiKeysController));

  // authRouter: não testado nos testes existentes — router vazio
  const authRouter = Router();

  return {
    metricsRouter,
    authRouter,
    dashboardRouter,
    triggerAlertUseCase,
  };
}

/**
 * Bootstrap para testes de auth e isolamento multi-tenant.
 *
 * Usa JWT real e API key real — sem middlewares simulados.
 * Rate limiting substituído por passthroughMiddleware (sem Redis em testes).
 *
 * Chamar `NoOpRefreshTokenStore.clear()` e `NoOpApiKeyAuthCache.clear()`
 * em `beforeEach` para isolar o estado entre testes.
 */
export function bootstrapForAuthTesting(): AppRouters {
  const db = getDatabase();
  const config = loadConfig();

  const metricsCache = new NoOpMetricsCacheService();
  const aggregationService = new NoOpAggregationQueueService();

  // Repositórios
  const metricsRepository = new DrizzleMetricsRepository(db, metricsCache);
  const aggregationReadRepository = new DrizzleAggregationReadRepository(db);
  const alertRepository = new DrizzleAlertRepository(db);
  const endpointRepository = new DrizzleEndpointRepository(db);
  const workspaceRepository = new DrizzleWorkspaceRepository(db);
  const userRepository = new DrizzleUserRepository(db);
  const stripeSubscriptionRepository = new DrizzleStripeSubscriptionRepository(db);
  const usageTrackingRepository = new DrizzleUsageTrackingRepository(db);
  const apiKeyRepository = new DrizzleApiKeyRepository(db);

  // Cache in-memory — sem Redis
  const apiKeyAuthCache = new NoOpApiKeyAuthCache();
  const refreshTokenStore = new NoOpRefreshTokenStore();

  // Serviço JWT real
  const jwtService = new JwtService(config);

  // Use cases — auth
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

  // Use cases — api-keys
  const createApiKeyUseCase = new CreateApiKeyUseCase(apiKeyRepository, workspaceRepository);
  const listApiKeysUseCase = new ListApiKeysUseCase(apiKeyRepository, workspaceRepository);
  const revokeApiKeyUseCase = new RevokeApiKeyUseCase(
    apiKeyRepository,
    workspaceRepository,
    apiKeyAuthCache
  );

  // Use cases — métricas (necessários para metricsRouter)
  const checkUsageQuotaUseCase = new CheckUsageQuotaUseCase(
    usageTrackingRepository,
    workspaceRepository
  );
  const recordMetricUseCase = new RecordMetricUseCase(
    metricsRepository,
    aggregationService,
    checkUsageQuotaUseCase,
    usageTrackingRepository
  );
  const queryAggregatedMetricsUseCase = new QueryAggregatedMetricsUseCase(
    aggregationReadRepository
  );
  const listActiveEndpointsUseCase = new ListActiveEndpointsUseCase(metricsRepository);

  // Use cases — alertas
  const createAlertRuleUseCase = new CreateAlertRuleUseCase(alertRepository, endpointRepository);
  const updateAlertRuleUseCase = new UpdateAlertRuleUseCase(alertRepository, endpointRepository);
  const deleteAlertRuleUseCase = new DeleteAlertRuleUseCase(alertRepository);
  const listAlertRulesUseCase = new ListAlertRulesUseCase(alertRepository);
  const getAlertRuleUseCase = new GetAlertRuleUseCase(alertRepository);
  const listAlertEventsUseCase = new ListAlertEventsUseCase(alertRepository);

  // Use cases — billing
  const getBillingInfoUseCase = new GetBillingInfoUseCase(
    usageTrackingRepository,
    workspaceRepository,
    stripeSubscriptionRepository
  );
  const createCheckoutSessionUseCase = new CreateCheckoutSessionUseCase(
    new NoOpStripeGateway(),
    stripeSubscriptionRepository,
    workspaceRepository,
    userRepository,
    config
  );

  // Middlewares — auth real; rate limiting via passthroughMiddleware (sem Redis em testes)
  const jwtAuth = createJwtAuthMiddleware(jwtService);
  const apiKeyAuth = createApiKeyAuthMiddleware(apiKeyRepository, apiKeyAuthCache);

  // Controllers
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
  const billingController = new BillingController(
    getBillingInfoUseCase,
    createCheckoutSessionUseCase
  );
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

  // authRouter — auth real com passthroughMiddleware nos rate limits (sem Redis)
  const authRouter = createAuthRouter(
    authController,
    jwtAuth,
    passthroughMiddleware,
    passthroughMiddleware,
    passthroughMiddleware
  );

  // dashboardRouter — JWT real aplicado uma vez no topo
  const dashboardRouter = Router();
  dashboardRouter.use(jwtAuth);
  dashboardRouter.use('/endpoints', createEndpointsRouter(endpointsController));
  dashboardRouter.use('/alert-rules', createAlertRulesRouter(alertRulesController));
  dashboardRouter.use('/alert-events', createAlertEventsRouter(alertEventsController));
  dashboardRouter.use('/billing', createBillingRouter(billingController));
  dashboardRouter.use('/', createApiKeysRouter(apiKeysController));

  // metricsRouter — API key real; rate limit via passthroughMiddleware (sem Redis)
  const metricsRouter = createMetricsRouter(
    metricsController,
    metricsQueryController,
    apiKeyAuth,
    passthroughMiddleware,
    jwtAuth
  );

  return { metricsRouter, authRouter, dashboardRouter };
}
