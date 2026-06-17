/**
 * AlertRulesController — adaptador HTTP para CRUD de regras de alerta.
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';

import { ALERT_CONDITIONS, ALERT_RULE_STATUSES } from '@domain/entities/AlertRule';
import { CreateAlertRuleUseCase } from '@application/usecases/alerts/CreateAlertRuleUseCase';
import { UpdateAlertRuleUseCase } from '@application/usecases/alerts/UpdateAlertRuleUseCase';
import { DeleteAlertRuleUseCase } from '@application/usecases/alerts/DeleteAlertRuleUseCase';
import { ListAlertRulesUseCase } from '@application/usecases/alerts/ListAlertRulesUseCase';
import { GetAlertRuleUseCase } from '@application/usecases/alerts/GetAlertRuleUseCase';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { resolveTenantContext } from '@infra/controllers/resolveTenantContext';
import { formatValidationError } from '@infra/controllers/formatValidationError';
import { VALID_HTTP_METHODS, type AlertRuleOutputDTO } from '@application/dto/AlertsDTO';

const createAlertRuleSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().nullable().optional(),
  condition: z.enum(ALERT_CONDITIONS),
  threshold: z.number().finite().positive(),
  windowMinutes: z.number().int().positive().optional(),
  endpoint: z.string().startsWith('/').optional(),
  method: z.enum(VALID_HTTP_METHODS).optional(),
  slackWebhookUrl: z.string().url().nullable().optional(),
  emailAddresses: z.array(z.string().email()).nullable().optional(),
  status: z.enum(ALERT_RULE_STATUSES).optional(),
});

const updateAlertRuleSchema = createAlertRuleSchema.partial();

const alertRuleIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

function toRuleResponse(rule: AlertRuleOutputDTO) {
  return {
    id: rule.id,
    workspaceId: rule.workspaceId,
    endpointId: rule.endpointId,
    endpoint: rule.endpoint,
    method: rule.method,
    name: rule.name,
    description: rule.description,
    condition: rule.condition,
    threshold: rule.threshold,
    windowMinutes: rule.windowMinutes,
    slackWebhookUrl: rule.slackWebhookUrl,
    emailAddresses: rule.emailAddresses,
    status: rule.status,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export class AlertRulesController {
  constructor(
    private readonly createAlertRuleUseCase: CreateAlertRuleUseCase,
    private readonly updateAlertRuleUseCase: UpdateAlertRuleUseCase,
    private readonly deleteAlertRuleUseCase: DeleteAlertRuleUseCase,
    private readonly listAlertRulesUseCase: ListAlertRulesUseCase,
    private readonly getAlertRuleUseCase: GetAlertRuleUseCase
  ) {}

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const parseResult = createAlertRuleSchema.safeParse(req.body ?? {});

    if (!parseResult.success) {
      res.status(422).json(formatValidationError(parseResult.error));
      return;
    }

    try {
      const { workspaceId } = resolveTenantContext(req);
      const rule = await this.createAlertRuleUseCase.execute({
        workspaceId,
        ...parseResult.data,
      });

      res.status(201).json({ data: toRuleResponse(rule) });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId } = resolveTenantContext(req);
      const result = await this.listAlertRulesUseCase.execute({ workspaceId });

      res.status(200).json({
        data: {
          workspaceId: result.workspaceId,
          rules: result.rules.map(toRuleResponse),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const paramResult = alertRuleIdParamSchema.safeParse(req.params);

    if (!paramResult.success) {
      res.status(422).json(formatValidationError(paramResult.error));
      return;
    }

    try {
      const { workspaceId } = resolveTenantContext(req);
      const rule = await this.getAlertRuleUseCase.execute({
        workspaceId,
        alertRuleId: paramResult.data.id,
      });

      res.status(200).json({ data: toRuleResponse(rule) });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const paramResult = alertRuleIdParamSchema.safeParse(req.params);

    if (!paramResult.success) {
      res.status(422).json(formatValidationError(paramResult.error));
      return;
    }

    const bodyResult = updateAlertRuleSchema.safeParse(req.body ?? {});

    if (!bodyResult.success) {
      res.status(422).json(formatValidationError(bodyResult.error));
      return;
    }

    try {
      const { workspaceId } = resolveTenantContext(req);
      const rule = await this.updateAlertRuleUseCase.execute({
        workspaceId,
        alertRuleId: paramResult.data.id,
        ...bodyResult.data,
      });

      res.status(200).json({ data: toRuleResponse(rule) });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const paramResult = alertRuleIdParamSchema.safeParse(req.params);

    if (!paramResult.success) {
      res.status(422).json(formatValidationError(paramResult.error));
      return;
    }

    try {
      const { workspaceId } = resolveTenantContext(req);
      await this.deleteAlertRuleUseCase.execute({
        workspaceId,
        alertRuleId: paramResult.data.id,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
