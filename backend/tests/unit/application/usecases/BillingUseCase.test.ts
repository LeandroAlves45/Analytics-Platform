/**
 * Testes unitários dos use cases de billing.
 *
 * Cobrem: CheckUsageQuotaUseCase (limites por plano free/pro),
 * GetBillingInfoUseCase (percentagem de uso, estado de subscrição Stripe),
 * CreateCheckoutSessionUseCase (Stripe Checkout) e
 * HandleStripeWebhookUseCase (sincronização de eventos Stripe).
 * Repositórios e gateways são mockados — sem I/O real.
 */

import { CheckUsageQuotaUseCase } from '@application/usecases/billing/CheckUsageQuotaUseCase';
import { GetBillingInfoUseCase } from '@application/usecases/billing/GetBillingInfoUseCase';
import { CreateCheckoutSessionUseCase } from '@application/usecases/billing/CreateCheckoutSessionUseCase';
import { HandleStripeWebhookUseCase } from '@application/usecases/billing/HandleStripeWebhookUseCase';
import type {
  UsageTrackingRepository,
  WorkspaceRepository,
  UserRepository,
} from '@application/contracts/repositories';
import type { StripeSubscriptionRepository } from '@application/contracts/repositories';
import type { StripeGateway } from '@application/contracts/gateways';
import type { WorkspacePlanCache } from '@infra/cache/WorkspacePlanCache';
import type { Config } from '@infra/frameworks/config';
import { AppError, ForbiddenError, NotFoundError } from '@shared/errors';
import { getMonthlyLimit } from '@shared/constants/plans';

jest.mock('@shared/constants/plans', () => {
  const actual =
    jest.requireActual<typeof import('@shared/constants/plans')>('@shared/constants/plans');
  return {
    ...actual,
    getMonthlyLimit: jest.fn(actual.getMonthlyLimit),
  };
});

/**
 * Mock de `UsageTrackingRepository` com contagem mensal fixa.
 *
 * @param monthlyCount - Número de requests registados no mês corrente.
 */
function makeUsageTrackingRepository(monthlyCount: number) {
  return {
    increment: jest.fn().mockResolvedValue(undefined),
    getCurrentMonthUsage: jest.fn().mockResolvedValue(monthlyCount),
  } as unknown as UsageTrackingRepository;
}

/**
 * Mock de `WorkspaceRepository` que devolve workspace com plano indicado.
 *
 * @param plan - Plano do workspace (`free`, `pro`, etc.).
 */
function makeWorkspaceRepository(plan: string) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 'ws-1', plan }),
    findByUserId: jest.fn().mockResolvedValue({ id: 'ws-1', plan }),
  } as unknown as WorkspaceRepository;
}

/**
 * Mock de `StripeSubscriptionRepository` com subscrição opcional.
 *
 * @param overrides - Estado e fim de período da subscrição; omitir devolve `null`.
 */
function makeStripeSubscriptionRepository(
  overrides?: Partial<{ status: string; currentPeriodEnd: string }>
) {
  return {
    findByWorkspaceId: jest.fn().mockResolvedValue(
      overrides
        ? {
            status: overrides.status ?? 'active',
            currentPeriodEnd: overrides.currentPeriodEnd
              ? new Date(overrides.currentPeriodEnd)
              : null,
          }
        : null
    ),
  } as unknown as StripeSubscriptionRepository;
}

// CheckUsageQuotaUseCase

describe('CheckUsageQuotaUseCase', () => {
  it('should resolve without throwing when usage is under free plan limit', async () => {
    const useCase = new CheckUsageQuotaUseCase(
      makeUsageTrackingRepository(50_000),
      makeWorkspaceRepository('free')
    );

    await expect(useCase.execute('ws-1')).resolves.not.toThrow();
  });

  it('should resolve for pro plan with 500k usage (limit: 1M)', async () => {
    const useCase = new CheckUsageQuotaUseCase(
      makeUsageTrackingRepository(500_000),
      makeWorkspaceRepository('pro')
    );

    await expect(useCase.execute('ws-1')).resolves.not.toThrow();
  });

  it('should throw AppError when pro plan limit (1M) is exceeded', async () => {
    const useCase = new CheckUsageQuotaUseCase(
      makeUsageTrackingRepository(1_000_001),
      makeWorkspaceRepository('pro')
    );

    await expect(useCase.execute('ws-1')).rejects.toThrow(AppError);
  });

  it('should throw AppError when usage is exactly at the limit (boundary)', async () => {
    const useCase = new CheckUsageQuotaUseCase(
      makeUsageTrackingRepository(100_000),
      makeWorkspaceRepository('free')
    );

    await expect(useCase.execute('ws-1')).rejects.toThrow(AppError);
  });

  it('should fall back to free plan when workspace is not found', async () => {
    const noWorkspaceRepo = {
      findById: jest.fn().mockResolvedValue(null),
    } as unknown as import('@application/contracts/repositories').WorkspaceRepository;

    // 50k < 100k (free limit) — deve resolver sem lançar
    await expect(
      new CheckUsageQuotaUseCase(makeUsageTrackingRepository(50_000), noWorkspaceRepo).execute(
        'ws-unknown'
      )
    ).resolves.not.toThrow();
  });
});

// GetBillingInfoUseCase

describe('GetBillingInfoUseCase', () => {
  it('should return billing info with usage percent for free plan', async () => {
    const useCase = new GetBillingInfoUseCase(
      makeUsageTrackingRepository(25_000),
      makeWorkspaceRepository('free'),
      makeStripeSubscriptionRepository()
    );

    const result = await useCase.execute('ws-1');

    expect(result.plan).toBe('free');
    expect(result.requestsTracked).toBe(25_000);
    expect(result.requestsLimit).toBeGreaterThan(0);
    expect(result.usagePercentage).toBeGreaterThan(0);
    expect(result.usagePercentage).toBeLessThanOrEqual(100);
  });

  it('should return stripeSubscriptionStatus when subscription exists', async () => {
    const useCase = new GetBillingInfoUseCase(
      makeUsageTrackingRepository(0),
      makeWorkspaceRepository('pro'),
      makeStripeSubscriptionRepository({ status: 'active', currentPeriodEnd: '2025-12-31' })
    );

    const result = await useCase.execute('ws-1');

    expect(result.stripeSubscriptionStatus).toBe('active');
    expect(result.currentPeriod).toBe(new Date('2025-12-31').toISOString());
  });

  it('should return null stripeSubscriptionStatus for free plan without subscription', async () => {
    const useCase = new GetBillingInfoUseCase(
      makeUsageTrackingRepository(0),
      makeWorkspaceRepository('free'),
      makeStripeSubscriptionRepository()
    );

    const result = await useCase.execute('ws-1');

    expect(result.stripeSubscriptionStatus).toBeNull();
  });

  it('should fall back to free plan when workspace is not found', async () => {
    const noWorkspaceRepo = {
      findById: jest.fn().mockResolvedValue(null),
    } as unknown as WorkspaceRepository;

    const useCase = new GetBillingInfoUseCase(
      makeUsageTrackingRepository(0),
      noWorkspaceRepo,
      makeStripeSubscriptionRepository()
    );

    const result = await useCase.execute('ws-unknown');

    expect(result.plan).toBe('free');
    expect(result.requestsLimit).toBe(100_000);
  });

  it('should return null currentPeriod when subscription has no period end', async () => {
    const subRepo = {
      findByWorkspaceId: jest.fn().mockResolvedValue({
        status: 'active',
        currentPeriodEnd: null,
      }),
    } as unknown as StripeSubscriptionRepository;

    const useCase = new GetBillingInfoUseCase(
      makeUsageTrackingRepository(0),
      makeWorkspaceRepository('pro'),
      subRepo
    );

    const result = await useCase.execute('ws-1');

    expect(result.currentPeriod).toBeNull();
  });

  it('should return zero usage percentage when monthly limit is zero', async () => {
    (getMonthlyLimit as jest.Mock).mockReturnValueOnce(0);

    const useCase = new GetBillingInfoUseCase(
      makeUsageTrackingRepository(50_000),
      makeWorkspaceRepository('enterprise'),
      makeStripeSubscriptionRepository()
    );

    const result = await useCase.execute('ws-1');

    expect(result.usagePercentage).toBe(0);
  });
});

// CreateCheckoutSessionUseCase

const TEST_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';

function makeStripeGateway(): jest.Mocked<StripeGateway> {
  return {
    createCustomer: jest.fn().mockResolvedValue('cus_new'),
    createCheckoutSession: jest.fn().mockResolvedValue('https://checkout.stripe.com/session'),
    constructWebhookEvent: jest.fn(),
  } as unknown as jest.Mocked<StripeGateway>;
}

function makeUserRepositoryForCheckout(
  user: object | null = {
    id: TEST_USER_ID,
    email: { value: 'user@example.com' },
    name: 'Test User',
  }
) {
  return {
    findById: jest.fn().mockResolvedValue(user),
  } as unknown as UserRepository;
}

function makeCheckoutWorkspaceRepository(isMember = true) {
  return {
    isMember: jest.fn().mockResolvedValue(isMember),
  } as unknown as WorkspaceRepository;
}

function makeConfig(overrides?: Partial<Config>): Config {
  return {
    CORS_ORIGIN: 'http://localhost:5173',
    STRIPE_PRICE_PRO: 'price_pro',
    STRIPE_PRICE_BUSINESS: 'price_business',
    STRIPE_PRICE_ENTERPRISE: 'price_enterprise',
    ...overrides,
  } as Config;
}

describe('CreateCheckoutSessionUseCase', () => {
  it('should throw ForbiddenError when user is not a workspace member', async () => {
    const useCase = new CreateCheckoutSessionUseCase(
      makeStripeGateway(),
      makeStripeSubscriptionRepository(),
      makeCheckoutWorkspaceRepository(false),
      makeUserRepositoryForCheckout(),
      makeConfig()
    );

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        targetPlan: 'pro',
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('should throw NotFoundError when user does not exist', async () => {
    const useCase = new CreateCheckoutSessionUseCase(
      makeStripeGateway(),
      makeStripeSubscriptionRepository(),
      makeCheckoutWorkspaceRepository(true),
      makeUserRepositoryForCheckout(null),
      makeConfig()
    );

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        targetPlan: 'pro',
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('should reuse existing stripe customer when subscription exists', async () => {
    const stripeGateway = makeStripeGateway();
    const stripeSubRepo = makeStripeSubscriptionRepository();
    (stripeSubRepo.findByWorkspaceId as jest.Mock).mockResolvedValue({
      stripeCustomerId: 'cus_existing',
    });

    const useCase = new CreateCheckoutSessionUseCase(
      stripeGateway,
      stripeSubRepo,
      makeCheckoutWorkspaceRepository(true),
      makeUserRepositoryForCheckout(),
      makeConfig()
    );

    const result = await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      userId: TEST_USER_ID,
      targetPlan: 'pro',
    });

    expect(stripeGateway.createCustomer).not.toHaveBeenCalled();
    expect(stripeGateway.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_existing', priceId: 'price_pro' })
    );
    expect(result.url).toBe('https://checkout.stripe.com/session');
  });

  it('should create new stripe customer when none exists', async () => {
    const stripeGateway = makeStripeGateway();

    const useCase = new CreateCheckoutSessionUseCase(
      stripeGateway,
      makeStripeSubscriptionRepository(),
      makeCheckoutWorkspaceRepository(true),
      makeUserRepositoryForCheckout({ id: TEST_USER_ID, email: { value: 'a@b.com' }, name: null }),
      makeConfig()
    );

    await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      userId: TEST_USER_ID,
      targetPlan: 'business',
    });

    expect(stripeGateway.createCustomer).toHaveBeenCalledWith(
      'a@b.com',
      'a@b.com',
      TEST_WORKSPACE_ID
    );
    expect(stripeGateway.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_new', priceId: 'price_business' })
    );
  });

  it('should throw AppError when stripe price is not configured', async () => {
    const useCase = new CreateCheckoutSessionUseCase(
      makeStripeGateway(),
      makeStripeSubscriptionRepository(),
      makeCheckoutWorkspaceRepository(true),
      makeUserRepositoryForCheckout(),
      makeConfig({ STRIPE_PRICE_PRO: '' })
    );

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        targetPlan: 'pro',
      })
    ).rejects.toThrow(AppError);
  });
});

// HandleStripeWebhookUseCase

function makeWebhookRepositories() {
  return {
    stripeSubscriptionRepository: {
      upsert: jest.fn().mockResolvedValue(undefined),
    } as unknown as StripeSubscriptionRepository,
    workspaceRepository: {
      updatePlan: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceRepository,
    workspacePlanCache: {
      invalidate: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspacePlanCache,
  };
}

describe('HandleStripeWebhookUseCase', () => {
  it('should upsert subscription and update plan on checkout.session.completed', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'checkout.session.completed',
      data: {
        id: 'cs_1',
        subscription: 'sub_1',
        customer: 'cus_1',
        metadata: { workspaceId: TEST_WORKSPACE_ID, targetPlan: 'pro' },
      },
    });

    expect(repos.stripeSubscriptionRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: TEST_WORKSPACE_ID,
        plan: 'pro',
        status: 'active',
      })
    );
    expect(repos.workspaceRepository.updatePlan).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 'pro');
    expect(repos.workspacePlanCache.invalidate).toHaveBeenCalledWith(TEST_WORKSPACE_ID);
  });

  it('should map business plan on checkout.session.completed', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'checkout.session.completed',
      data: {
        id: 'cs_2',
        subscription: 'sub_2',
        customer: 'cus_2',
        metadata: { workspaceId: TEST_WORKSPACE_ID, targetPlan: 'business' },
      },
    });

    expect(repos.workspaceRepository.updatePlan).toHaveBeenCalledWith(
      TEST_WORKSPACE_ID,
      'business'
    );
  });

  it('should default pro plan when checkout targetPlan is not business', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'checkout.session.completed',
      data: {
        id: 'cs_2b',
        metadata: { workspaceId: TEST_WORKSPACE_ID, targetPlan: 'enterprise' },
      },
    });

    expect(repos.workspaceRepository.updatePlan).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 'pro');
  });

  it('should handle checkout with missing subscription and customer ids', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'checkout.session.completed',
      data: {
        id: 'cs_2c',
        metadata: { workspaceId: TEST_WORKSPACE_ID, targetPlan: 'pro' },
      },
    });

    expect(repos.stripeSubscriptionRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerId: '',
        stripeSubscriptionId: '',
      })
    );
  });

  it('should skip checkout when workspace metadata is missing', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'checkout.session.completed',
      data: { id: 'cs_3', subscription: 'sub_3', customer: 'cus_3', metadata: {} },
    });

    expect(repos.stripeSubscriptionRepository.upsert).not.toHaveBeenCalled();
  });

  it('should update plan on customer.subscription.updated when active', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'customer.subscription.updated',
      data: {
        id: 'sub_4',
        customer: 'cus_4',
        status: 'active',
        metadata: { workspaceId: TEST_WORKSPACE_ID, targetPlan: 'business' },
      },
    });

    expect(repos.workspaceRepository.updatePlan).toHaveBeenCalledWith(
      TEST_WORKSPACE_ID,
      'business'
    );
  });

  it('should default to pro plan when active subscription has no targetPlan metadata', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'customer.subscription.updated',
      data: {
        id: 'sub_4b',
        customer: 'cus_4b',
        status: 'active',
        metadata: { workspaceId: TEST_WORKSPACE_ID },
      },
    });

    expect(repos.workspaceRepository.updatePlan).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 'pro');
  });

  it('should default status to canceled when subscription payload omits status', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'customer.subscription.updated',
      data: {
        id: 'sub_4c',
        customer: 'cus_4c',
        metadata: { workspaceId: TEST_WORKSPACE_ID },
      },
    });

    expect(repos.workspaceRepository.updatePlan).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 'free');
  });

  it('should downgrade to free on customer.subscription.deleted', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'customer.subscription.deleted',
      data: {
        id: 'sub_5',
        customer: 'cus_5',
        status: 'canceled',
        metadata: { workspaceId: TEST_WORKSPACE_ID },
      },
    });

    expect(repos.stripeSubscriptionRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'free', status: 'canceled' })
    );
    expect(repos.workspaceRepository.updatePlan).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 'free');
  });

  it('should skip subscription change when workspace metadata is missing', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'customer.subscription.updated',
      data: { id: 'sub_6', customer: 'cus_6', status: 'active', metadata: {} },
    });

    expect(repos.stripeSubscriptionRepository.upsert).not.toHaveBeenCalled();
  });

  it('should log invoice.payment_failed without updating plan', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({
      type: 'invoice.payment_failed',
      data: { id: 'inv_1' },
    });

    expect(repos.stripeSubscriptionRepository.upsert).not.toHaveBeenCalled();
    expect(repos.workspaceRepository.updatePlan).not.toHaveBeenCalled();
  });

  it('should ignore unknown webhook event types', async () => {
    const repos = makeWebhookRepositories();
    const useCase = new HandleStripeWebhookUseCase(
      repos.stripeSubscriptionRepository,
      repos.workspaceRepository,
      repos.workspacePlanCache
    );

    await useCase.execute({ type: 'customer.created', data: { id: 'cus_x' } });

    expect(repos.stripeSubscriptionRepository.upsert).not.toHaveBeenCalled();
  });
});
