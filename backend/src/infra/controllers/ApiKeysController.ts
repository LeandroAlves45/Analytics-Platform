/**
 * ApiKeysController — CRUD de API keys (JWT required).
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreateApiKeyUseCase } from '@application/usecases/workspaces/CreateApiKeyUseCase';
import { ListApiKeysUseCase } from '@application/usecases/workspaces/ListApiKeysUseCase';
import { RevokeApiKeyUseCase } from '@application/usecases/workspaces/RevokeApiKeyUseCase';
import type { AuthenticatedRequest } from './authenticatedRequest';
import { resolveDashboardContext } from './resolveTenantContext';
import { formatValidationError } from './formatValidationError';

const createSchema = z.object({
  name: z.string().min(1),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const workspaceParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export class ApiKeysController {
  constructor(
    private readonly createApiKeyUseCase: CreateApiKeyUseCase,
    private readonly listApiKeysUseCase: ListApiKeysUseCase,
    private readonly revokeApiKeyUseCase: RevokeApiKeyUseCase
  ) {}

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const params = workspaceParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(422).json(formatValidationError(params.error));
      return;
    }

    try {
      const { userId, workspaceId } = resolveDashboardContext(req);
      // IDOR guard: URL workspaceId tem de coincidir com JWT do workspace
      if (params.data.workspaceId !== workspaceId) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Workspace access denied' } });
        return;
      }

      const keys = await this.listApiKeysUseCase.execute({
        workspaceId: params.data.workspaceId,
        userId,
      });

      res.status(200).json({ data: { apiKeys: keys } });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const params = workspaceParamsSchema.safeParse(req.params);
    const body = createSchema.safeParse(req.body ?? {});
    if (!params.success) {
      res.status(422).json(formatValidationError(params.error));
      return;
    }
    if (!body.success) {
      res.status(422).json(formatValidationError(body.error));
      return;
    }

    try {
      const { userId, workspaceId } = resolveDashboardContext(req);
      // IDOR guard: URL workspaceId tem de coincidir com JWT do workspace
      if (params.data.workspaceId !== workspaceId) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Workspace access denied' } });
        return;
      }

      const key = await this.createApiKeyUseCase.execute({
        workspaceId: params.data.workspaceId,
        userId,
        name: body.data.name,
      });

      res.status(201).json({ data: key });
    } catch (error) {
      next(error);
    }
  };

  revoke = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const params = idParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(422).json(formatValidationError(params.error));
      return;
    }
    try {
      const { userId, workspaceId } = resolveDashboardContext(req);
      await this.revokeApiKeyUseCase.execute({
        apiKeyId: params.data.id,
        workspaceId,
        userId,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
