/**
 * BillingController — adaptador HTTP para checkout Stripe.
 *
 * Expõe POST /api/billing/checkout para utilizadores autenticados via JWT.
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { GetBillingInfoUseCase } from '@application/usecases/billing/GetBillingInfoUseCase';
import { CreateCheckoutSessionUseCase } from '@application/usecases/billing/CreateCheckoutSessionUseCase';
import type { AuthenticatedRequest } from './authenticatedRequest';
import { resolveDashboardContext } from './resolveTenantContext';
import { formatValidationError } from './formatValidationError';

const checkoutSchema = z.object({
  targetPlan: z.enum(['pro', 'business', 'enterprise']),
});

export class BillingController {
  constructor(
    private readonly getBillingInfoUseCase: GetBillingInfoUseCase,
    private readonly createCheckoutSessionUseCase: CreateCheckoutSessionUseCase
  ) {}

  getInfo = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId } = resolveDashboardContext(req);
      const info = await this.getBillingInfoUseCase.execute(workspaceId);
      res.status(200).json({ data: info });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handler de POST /api/billing/checkout
   * Devolve URL de redirect para Stripe Hosted Checkout.
   */
  checkout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const parseResult = checkoutSchema.safeParse(req.body ?? {});

    if (!parseResult.success) {
      res.status(422).json(formatValidationError(parseResult.error));
      return;
    }

    try {
      const { workspaceId, userId } = resolveDashboardContext(req);
      const session = await this.createCheckoutSessionUseCase.execute({
        workspaceId,
        userId,
        targetPlan: parseResult.data.targetPlan,
      });
      res.status(200).json({ data: session });
    } catch (error) {
      next(error);
    }
  };
}
