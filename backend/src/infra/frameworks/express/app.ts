/**
 * Configuração base da aplicação Express.
 *
 *   createApp()       — middleware de infra + health checks
 *   registerRoutes()  — routers de negócio + 404 + error handler
 */

import cookieParser from 'cookie-parser';
import express, { Express, Request, Response, NextFunction, Router } from 'express';
import { AppRouters } from './bootstrap';
import { logger } from '@infra/frameworks/logging';
import { checkDatabaseConnection } from '@infra/frameworks/database/connection';
import { checkRedisConnection } from '@infra/frameworks/cache/redis';
import { errorHandlerMiddleware } from '@infra/middleware/ErrorHandlerMiddleware';
import { ErrorCodes } from '@shared/errors';

// Estender a interface Request do Express com o campo id
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Cria a aplicação Express com middleware de infra.
 *
 * @param stripeWebhookRouter - Router montado ANTES do JSON parser (raw body Stripe)
 * @returns Instância Express configurada com middleware de infra
 */
export function createApp(stripeWebhookRouter?: Router, corsOrigin?: string): Express {
  const app = express();

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Webhook Stripe primeiro — signature verification exige raw body.
  if (stripeWebhookRouter) {
    app.use('/api/webhooks/stripe', stripeWebhookRouter);
  }

  // Parseia cookies HTTP.
  app.use(cookieParser());

  // Parseia o body de requests com Content-Type: application/json.
  // Limite de 1mb é suficiente para payloads de métricas.
  app.use(express.json({ limit: '1mb' }));

  // Atribui um ID único a cada request.
  // Usado nos logs para correlacionar todas as entradas de um mesmo pedido.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    // Usa o header X-Request-ID se o cliente o enviar (ex: SDK ou load balancer),
    // caso contrário gera um novo baseado em timestamp + random.
    req.id =
      (req.headers['x-request-id'] as string) ??
      `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    next();
  });

  // Loga cada request com método, path, status e duração.
  // Usa o response 'finish' event para capturar o status após o handler correr.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.id;

    res.on('finish', () => {
      logger.info('http_request', {
        request_id: requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Date.now() - startTime,
      });
    });

    next();
  });

  /**
   * CORS + preflight OPTIONS.
   *
   * Browsers enviam OPTIONS antes de pedidos cross-origin com Authorization.
   * Responder 204 aqui evita que o preflight caia no handler 404.
   */

  const resolvedCorsOrigin = corsOrigin ?? 'http://localhost:5173';

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', resolvedCorsOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Liveness probe —> o orquestrador (Kubernetes, Railway) usa este endpoint
  // para saber se o processo está vivo. Responde sempre 200 se o servidor correr.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * Readiness — pronto para tráfego.
   *
   * - BD down  → 503, status: 'not_ready' (app não pode servir requests de negócio)
   * - Redis down → 200, status: 'degraded' (cache degradado, BD funciona)
   * - Ambos ok → 200, status: 'ready'
   */
  app.get('/ready', async (_req: Request, res: Response) => {
    const [dbOk, redisOk] = await Promise.all([checkDatabaseConnection(), checkRedisConnection()]);

    const isReady = dbOk;
    const status = !isReady ? 'not_ready' : redisOk ? 'ready' : 'degraded';

    res.status(isReady ? 200 : 503).json({
      status,
      db: dbOk,
      redis: redisOk,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

/**
 * Monta routers de negócio e handlers terminais.
 *
 * Ordem de montagem (a ordem importa no Express):
 *   1. /api/auth    — register, login, refresh (públicos) + /me (JWT)
 *   2. /api/metrics — POST ingestão (API key + rate limit) + GET /aggregated (JWT)
 *   3. /api         — dashboardRouter com jwtAuth: endpoints, alertas, api-keys, billing
 *   4. 404          — fallback para paths não reconhecidos
 *   5. errorHandler — captura todos os erros passados via next(err)
 *
 * Nota: /api/webhooks/stripe é montado em createApp() ANTES do JSON parser
 * para preservar o raw body necessário na Stripe signature verification.
 *
 * @param app     — Instância Express criada por createApp()
 * @param routers — Routers criados pelo bootstrap()
 */
export function registerRoutes(app: Express, routers: AppRouters): void {
  app.use('/api/auth', routers.authRouter);
  app.use('/api/metrics', routers.metricsRouter);
  app.use('/api', routers.dashboardRouter);

  // Handler de 404 — só chega aqui se nenhum router acima correspondeu ao path.
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: `Cannot ${req.method} ${req.path}`,
      },
    });
  });

  // Middleware global de erros — SEMPRE o último middleware registado.
  // A assinatura com 4 parâmetros é obrigatória para o Express reconhecê-lo
  // como error handler e não como middleware normal.
  app.use(errorHandlerMiddleware);
}

/**
 * Inicia o servidor HTTP.
 *
 * @param app  — Instância Express configurada
 * @param port — Porta de escuta (default 3000)
 */
export function startServer(app: Express, port: number = 3000): void {
  app.listen(port, () => {
    logger.info('server_started', {
      port,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    });
  });
}
