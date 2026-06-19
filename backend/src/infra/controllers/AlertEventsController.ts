/**
 * AlertEventsController — listagem de histórico de alertas.
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';

import { ListAlertEventsUseCase } from '@application/usecases/alerts/ListAlertEventsUseCase';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { resolveDashboardContext } from '@infra/controllers/resolveTenantContext';
import { formatValidationError } from '@infra/controllers/formatValidationError';

const listEventsSchema = z.object({
  alertRuleId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['open', 'resolved', 'all']).optional().default('all'),
});

export class AlertEventsController {
  constructor(private readonly listAlertEventsUseCase: ListAlertEventsUseCase) {}

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const parseResult = listEventsSchema.safeParse(req.query ?? {});

    if (!parseResult.success) {
      res.status(422).json(formatValidationError(parseResult.error));
      return;
    }

    try {
      const { workspaceId } = resolveDashboardContext(req);
      const result = await this.listAlertEventsUseCase.execute({
        workspaceId,
        alertRuleId: parseResult.data.alertRuleId,
        limit: parseResult.data.limit,
        eventStatus: parseResult.data.status,
      });

      res.status(200).json({
        data: {
          workspaceId: result.workspaceId,
          events: result.events.map((event) => ({
            id: event.id,
            alertRuleId: event.alertRuleId,
            ruleName: event.ruleName,
            workspaceId: event.workspaceId,
            triggeredAt: event.triggeredAt.toISOString(),
            resolvedAt: event.resolvedAt?.toISOString() ?? null,
            value: event.value,
            message: event.message,
            slackSent: event.slackSent,
            emailSent: event.emailSent,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
