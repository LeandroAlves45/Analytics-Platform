/**
 * EndpointsController — adaptador HTTP para ListActiveEndpointsUseCase.
 *
 * Devolve a lista de endpoints/métodos ativos do workspace autenticado
 * para popular filtros do dashboard.
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';

import { ListActiveEndpointsUseCase } from '@application/usecases/metrics/ListActiveEndpointsUseCase';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { resolveDashboardContext } from '@infra/controllers/resolveTenantContext';

const DEFAULT_LOOKBACK_MINUTES = 1440;

const listEndpointsSchema = z.object({
  minutes: z.coerce
    .number()
    .int('minutes must be an integer')
    .positive('minutes must be positive')
    .max(10_080, 'minutes must be less than 10_080 (7 days)')
    .default(DEFAULT_LOOKBACK_MINUTES),
});

export class EndpointsController {
  constructor(private readonly listActiveEndpointsUseCase: ListActiveEndpointsUseCase) {}

  /**
   * Handler de GET /api/endpoints
   */
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const parseResult = listEndpointsSchema.safeParse(req.query ?? {});

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

    let workspaceId: string;

    try {
      ({ workspaceId } = resolveDashboardContext(req));
    } catch (error) {
      next(error);
      return;
    }

    try {
      const result = await this.listActiveEndpointsUseCase.execute({
        workspaceId,
        minutes: parseResult.data.minutes,
      });

      res.status(200).json({
        data: {
          workspaceId: result.workspaceId,
          minutes: result.minutes,
          endpoints: result.endpoints,
        },
      });
    } catch (error) {
      next(error);
      return;
    }
  };
}
