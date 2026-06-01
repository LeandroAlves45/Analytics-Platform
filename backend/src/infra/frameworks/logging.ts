// logging.ts
/**
 * Configuração de logging para o servidor
 * Usa Pino para logging estruturado
 */

import pino from 'pino';

/**
 * Configuração global de logger Pino
 * Estruturado, perfomante, usado em toda a aplicação
 */
export const logger = pino({
  // Level de log mínimo (pode ser overridado por LOG_LEVEL env)
  level: process.env.LOG_LEVEL || 'info',

  // Em desenvolvimento, usa pretty-printing (légivel)
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
});
