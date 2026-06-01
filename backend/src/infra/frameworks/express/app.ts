// app.ts
// Arquivo de configuração do Express

import express, { Express, Request, Response, NextFunction } from 'express';
import { logger } from '../../frameworks/logging';
import { errorHandlerMiddleware } from '../../middleware/ErrorHandlerMiddleware';
import { ErrorCodes } from '../../../shared/errors';

// Interface para request com contexto adicional
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Cria e configura o servidor Express
 * Configura middlewares, rotas e handlers de erro
 * @returns Aplicação Express configurada
 */
export function createApp(): Express {
  const app = express();

  // Middlewares: Parsing de Json
  // Converte requesst body em JSON string para objeto JavaScript
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Middlewares: Request ID
  // Gera um ID único para cada requisição (rastreamento de logs)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    next();
  });

  // Middlewares: Logging de requests
  // Loga cada request com método, path, status e duração
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Hook executado após a resposta ser finalizada
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('http_request', {
        request_id: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
        ip: req.ip,
      });
    });

    next();
  });

  // Middlewares: CORS
  // Permite requisições de outros domínios
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    return next();
  });

  // Route: Health check
  // Endpoint para verificar se o servidor está online
  // Usado para monitoramento e load balancers
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Route: Readiness check
  // Verifica se o servidor está pronto para receber tráfego
  // Diferente de health, pode estar vivo mas não pronto
  app.get('/ready', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  });

  // Middleware: 404 — rota HTTP não registada (diferente de NotFoundError de domínio)
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'Endpoint does not exist',
      },
    });
  });

  // Middleware: tratamento global de erros — deve ser o último middleware registado
  app.use(errorHandlerMiddleware);

  return app;
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
