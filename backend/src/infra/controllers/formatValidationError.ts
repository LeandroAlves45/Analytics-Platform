/**
 * Utilitário partilhado de formatação de erros de validação Zod.
 * Garante um formato de resposta HTTP consistente em todos os controllers.
 */
import { z } from 'zod';

export function formatValidationError(error: z.ZodError): {
  error: { code: string; message: string; details: { field: string; message: string }[] };
} {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    },
  };
}
