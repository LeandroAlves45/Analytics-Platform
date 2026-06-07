// config.ts
/**
 * Configuração global de variáveis de ambiente
 * Carrega variáveis do arquivo .env
 *
 * Todas as ligações de infra (BD, Redis) devem obter valores
 * do objecto devolvido por loadConfig() — nunca de process.env directamente.
 */

import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './logging';

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

// Schema de validação com Zod
// Define que as variáveis de ambiente são obrigatórias
const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),

  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().default(5432),
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),

  // Redis
  REDIS_URL: z.string().url().min(1),
  METRICS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // JWT
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Slack
  SLACK_WEBHOOK_URL: z.string().url().optional(),

  // Email
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().email().min(1).optional(),

  // Codecov (opcional — só usado em CI; configurar também em GitHub Secrets)
  CODECOV_TOKEN: z.string().min(1).optional(),
});

// Type derivado do schema -> sempre sincronizado com o schema
export type Config = z.infer<typeof envSchema>;

/**
 * Carrega e valida variáveis de ambiente
 * Se Validação falhar, mostra qual variável está a faltar e exits
 * @returns Objeto de configuração validado
 */
export function loadConfig(): Config {
  try {
    // Valida process.env contra o schema
    const parsed = envSchema.parse(process.env);

    // Validação condicional: JWT_SECRET deve em produção ter no mínimo 32 caracteres
    if (parsed.NODE_ENV === 'production') {
      if (parsed.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET tem que ter no mínimo 32 caracteres');
      }

      // CORS_ORIGIN não deve ser * em produção
      if (parsed.CORS_ORIGIN === '*') {
        throw new Error('CORS_ORIGIN não deve ser * em produção');
      }

      // Stripe keys devem estar em produção
      if (!parsed.STRIPE_SECRET_KEY || !parsed.STRIPE_WEBHOOK_SECRET) {
        throw new Error(
          'STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET devem estar configurados em produção'
        );
      }
    }

    // Log de sucesso
    logger.info('config_loaded', {
      environment: parsed.NODE_ENV,
      port: parsed.PORT,
    });

    return parsed;
  } catch (error: unknown) {
    // Se Zod validation falha, erro é ZodError (estruturado)
    if (error instanceof z.ZodError) {
      logger.error('config_load_failed', {
        errors: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          received: issue.code,
        })),
      });
    } else if (error instanceof Error) {
      logger.error('config_validation_failed', {
        message: error.message,
      });
    } else {
      logger.error('config_load_failed', { error });
    }

    // Exit com erro
    // Força a configurar as variáveis de ambiente
    process.exit(1);
  }
}
