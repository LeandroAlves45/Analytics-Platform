/**
 *O MetricsController é o adaptador entre HTTP e o use case RecordMetricUseCase.
 * Responsabilidades exclusivas deste controller:
 *   1. Validar a forma dos dados HTTP com Zod
 *   2. Extrair dados relevantes do request
 *   3. Chamar o use case com os dados formatados
 *   4. Formatar e enviar a resposta HTTP
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { RecordMetricUseCase } from '@application/usecases/metrics/RecordMetricUseCase';

/**
 * Schema Zod para validar o body do request de ingestão.
 * Esta validação acontece ANTES de criar a entidade Metric.
 * Zod verifica tipos e formato; a entidade verifica regras de negócio.
 *
 * @example
 * {
 *   "endpoint": "/api/users",
 *   "method": "GET",
 *   "latencyMs": 150,
 *   "statusCode": 200,
 *   "requestId": "req-uuid-aqui"
 * }
 */
const ingestMetricSchema = z.object({
  endpoint: z.string().min(1, 'Endpoint is required'),
  method: z
    .string()
    .min(1, 'Method is required')
    .transform((val) => val.toUpperCase()),
  latencyMs: z.number('latencyMs is required').positive('latencyMs must be positive'),
  statusCode: z.number('statusCode is required').int('statusCode must be an integer'),
  requestId: z.string().min(1, 'RequestId is required'),
  // Campos opcionais:
  payloadSizeBytes: z.number().int().nonnegative().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

/**
 * Tipo TypeScript inferido automaticamente pelo Zod.
 * Evitamos definir o tipo manualmente e depois manter dois sítios sincronizados.
 */
type IngestMetricBody = z.infer<typeof ingestMetricSchema>;

/**
 * Extensão do tipo Request do Express para incluir campos que o AuthMiddleware
 * vai adicionar após validar a API Key.
 */
interface AuthenticatedRequest extends Request {
  workspaceId?: string;
  apiKeyId?: string;
}

/**
 * Controller para ingestão de métricas.
 */
export class MetricsController {
  // Injeção de dependência do use case.
  constructor(private readonly recordMetricUseCase: RecordMetricUseCase) {}

  // Handler do endpoint POST /api/metrics.
  // Express requer que o handler tenha esta assinatura exata.
  ingest = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // Passo 1: validar o body com Zod.
    // safeParse não lança excepção — devolve { success, data } ou { success, error }.
    const parseResult = ingestMetricSchema.safeParse(req.body);

    if (!parseResult.success) {
      // Formatamos os erros Zod num formato consistente com o resto da API.
      // O cliente recebe um array de { field, message } para cada campo inválido.
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      return;
    }

    // Passo 2: extrair dados válidados e contexto de autenticação.
    const body: IngestMetricBody = parseResult.data;

    // Estes campos são injectados pelo AuthMiddleware antes de chegar aqui.
    // TODO: Irão ser feitos no sprint 6.
    const workspaceId = req.workspaceId ?? 'dev-workspace-id';
    const apiKeyId = req.apiKeyId ?? 'dev-api-key-id';

    // Passo 3: chamar o use case com os dados formatados.
    // Qualquer erro lançado pelo use case (ValidationError, AppError) é passado
    // ao next() para o ErrorHandlerMiddleware tratar e formatar correctamente.
    try {
      const result = await this.recordMetricUseCase.execute({
        workspaceId,
        apiKeyId,
        endpoint: body.endpoint,
        method: body.method,
        latencyMs: body.latencyMs,
        statusCode: body.statusCode,
        payloadSizeBytes: body.payloadSizeBytes,
        requestId: body.requestId,
        userAgent: body.userAgent ?? req.headers['user-agent'],
        ipAddress: body.ipAddress ?? req.ip,
      });

      // Passo 4: responder com sucesso (202 Accepted).
      // Usamos 202 porque a métrica pode ainda não ter sido processada.
      res.status(202).json({
        data: {
          metricId: result.metricId,
          recordedAt: result.recordedAt.toISOString(),
        },
      });
    } catch (error) {
      // Delegamos ao ErrorHandlerMiddleware tratar e formatar correctamente.
      next(error);
    }
  };
}
