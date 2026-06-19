/**
 * BillingController — adaptador HTTP para checkout Stripe.
 *
 * Expõe POST /api/billing/checkout para utilizadores autenticados via JWT.
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';

import { CreateCheckoutSessionUseCase } from '@application/usecases/billing/CreateCheckoutSessionUseCase';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { resolveDashboardContext } from '@infra/controllers/resolveTenantContext';

const checkoutSchema = z.object({
  targetPlan: z.enum(['pro', 'business', 'enterprise']),
});

export class BillingController {
  constructor(private readonly createCheckoutSessionUseCase: CreateCheckoutSessionUseCase) {}

  /**
   * Handler de POST /api/billing/checkout
   * Devolve URL de redirect para Stripe Hosted Checkout.
   */
  createCheckout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const parseResult = checkoutSchema.safeParse(req.body ?? {});

    if (!parseResult.success) {
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

    let workspaceId: string;
    let userId: string;

    try {
      ({ workspaceId, userId } = resolveDashboardContext(req));
    } catch (error) {
      next(error);
      return;
    }

    try {
      const result = await this.createCheckoutSessionUseCase.execute({
        workspaceId,
        userId,
        targetPlan: parseResult.data.targetPlan,
      });

      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };
}
