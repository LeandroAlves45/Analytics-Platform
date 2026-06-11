/**
 * MetricsQueryController — adaptador HTTP para QueryAggregatedMetricsUseCase.
 *
 * Responsabilidades:
 *   1. Validar query params com Zod
 *   2. Resolver contexto de tenant (workspaceId)
 *   3. Chamar o use case
 *   4. Formatar resposta HTTP (datas em ISO string)
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';

import { QueryAggregatedMetricsUseCase } from '@application/usecases/metrics/QueryAggregatedMetricsUseCase';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { resolveTenantContext } from '@infra/controllers/resolveTenantContext';

const aggregatedQuerySchema = z.object({
  from: z.string().datetime({ message: 'from must be a valid ISO 8601 datetime' }),
  to: z.string().datetime({ message: 'to must be a valid ISO 8601 datetime' }),
  interval: z.enum(['5m', '1h', '1d'], {
    message: 'interval must be one of 5m, 1h, 1d',
  }),
  endpoint: z.string().min(1, 'endpoint must not be empty').optional(),
  method: z
    .string()
    .min(1, 'method must not be empty')
    .transform((val) => val.toUpperCase())
    .optional(),
});

type AggregatedQueryParams = z.infer<typeof aggregatedQuerySchema>;

export class MetricsQueryController {
  constructor(private readonly queryAggregatedMetricsUseCase: QueryAggregatedMetricsUseCase) {}

  /**
   * Handler de GET /api/metrics/aggregated
   */
  getAggregated = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const parseResult = aggregatedQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      return;
    }

    const query: AggregatedQueryParams = parseResult.data;

    let workspaceId: string;

    try {
      ({ workspaceId } = resolveTenantContext(req));
    } catch (error) {
      next(error);
      return;
    }

    try {
      const result = await this.queryAggregatedMetricsUseCase.execute({
        workspaceId,
        from: new Date(query.from),
        to: new Date(query.to),
        interval: query.interval,
        endpoint: query.endpoint,
        method: query.method,
      });

      res.status(200).json({
        data: {
          workspaceId: result.workspaceId,
          interval: result.interval,
          from: result.from.toISOString(),
          to: result.to.toISOString(),
          series: result.series.map((point) => ({
            time: point.time.toISOString(),
            endpoint: point.endpoint,
            method: point.method,
            count: point.count,
            latencyP50: point.latencyP50,
            latencyP75: point.latencyP75,
            latencyP95: point.latencyP95,
            latencyP99: point.latencyP99,
            latencyAvg: point.latencyAvg,
            latencyMax: point.latencyMax,
            latencyMin: point.latencyMin,
            status2xxCount: point.status2xxCount,
            status3xxCount: point.status3xxCount,
            status4xxCount: point.status4xxCount,
            status5xxCount: point.status5xxCount,
            errorRate: point.errorRate,
            throughputPerSec: point.throughputPerSec,
          })),
        },
      });
    } catch (error) {
      next(error);
      return;
    }
  };
}
