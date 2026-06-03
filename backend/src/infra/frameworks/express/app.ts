/**
 * Configuração base da aplicação Express.
 *
 * Este ficheiro tem duas responsabilidades separadas:
 *
 *   createApp()       — cria a app com middleware de infra (parsing, CORS,
 *                       logging, health checks). Não conhece rotas de negócio.
 *
 *   registerRoutes()  — monta os routers de negócio e os handlers terminais
 *                       (404 e error handler). Chamada depois de createApp().
 *
 * Separar as duas funções permite que testes de integração criem a app base
 * e montem apenas os routers relevantes para cada teste.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { AppRouters } from './bootstrap';
import { logger } from '../../frameworks/logging';
import { errorHandlerMiddleware } from '../../middleware/ErrorHandlerMiddleware';
import { ErrorCodes } from '../../../shared/errors';

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
 * Não regista rotas de negócio — isso é responsabilidade de registerRoutes().
 *
 * Middleware registado aqui (por ordem):
 *   1. express.json()  — parseia body JSON de todos os requests
 *   2. requestId       — atribui ID único a cada request para correlação de logs
 *   3. requestLogger   — loga método, path e duração de cada request
 *   4. cors            — cabeçalhos de controlo de acesso cross-origin
 *   5. /health         — liveness probe (está o servidor vivo?)
 *   6. /ready          — readiness probe (está pronto para tráfego?)
 *
 * @returns Instância Express configurada com middleware de infra.
 */
export function createApp(): Express {
  const app = express();

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

  // Cabeçalhos CORS para permitir pedidos cross-origin.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const corsOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:3000';
    res.header('Access-Control-Allow-Origin', corsOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    next();
  });

  // Liveness probe — o orquestrador (Kubernetes, Railway) usa este endpoint
  // para saber se o processo está vivo. Responde sempre 200 se o servidor correr.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Readiness probe — indica se a app está pronta para receber tráfego.
  // Num sistema com base de dados, aqui verificaríamos a conexão.
  app.get('/ready', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  });

  return app;
}

/**
 * Monta os routers de negócio e os handlers terminais na app Express.
 *
 * Deve ser chamada DEPOIS de createApp() e ANTES de startServer().
 * A ordem interna desta função também importa:
 *   1. Routers de negócio   — respondem a rotas conhecidas
 *   2. 404 handler          — apanha rotas desconhecidas (depois dos routers)
 *   3. errorHandlerMiddleware — apanha erros de tudo o que veio acima (sempre último)
 *
 * @param app     — Instância Express criada por createApp().
 * @param routers — Routers de negócio criados pelo bootstrap().
 */
export function registerRoutes(app: Express, routers: AppRouters): void {
  app.use('/api/metrics', routers.metricsRouter);

  // Handler de 404 — só chega aqui se nenhum router acima correspondeu ao path.
  // Deve ficar depois de todos os routers para não interceptar rotas válidas.
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: `Cannot ${req.method} ${req.path}`,
      },
    });
  });

  // Middleware global de erros — SEMPRE o último middleware registado.
  // Captura qualquer erro passado via next(err) por qualquer router acima.
  // A assinatura com 4 parâmetros é obrigatória para o Express reconhecê-lo
  // como error handler e não como middleware normal.
  app.use(errorHandlerMiddleware);
}

/**
 * Inicializa o servidor HTTP
 * @param port Porta para o servidor (3000 por padrão)
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
