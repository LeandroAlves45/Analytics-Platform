/**
 * Testes unitários para a API de billing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/api/client';
import { fetchBillingInfo, createCheckoutSession } from '@/api/billing';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('billing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should unwrap billing info response envelope', async () => {
    const mockBilling = {
      workspaceId: 'ws-id',
      plan: 'free',
      requestsTracked: 12_000,
      requestsLimit: 100_000,
      usagePercentage: 12,
      month: '2026-06-01',
      stripeSubscriptionStatus: null,
      currentPeriod: null,
    };

    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: mockBilling },
    });

    const result = await fetchBillingInfo();

    expect(apiClient.get).toHaveBeenCalledWith('/api/billing');
    expect(result.plan).toBe('free');
    expect(result.requestsTracked).toBe(12_000);
  });

  it('should post targetPlan and return checkout URL', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { data: { url: 'https://checkout.stripe.com/pay/cs_test_abc' } },
    });

    const result = await createCheckoutSession('pro');

    expect(apiClient.post).toHaveBeenCalledWith('/api/billing/checkout', { targetPlan: 'pro' });
    expect(result.url).toContain('stripe.com');
  });
});
