/**
 * Hook React Query para a informação de billing.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchBillingInfo } from '@/api/billing';

export const BILLING_KEY = 'billing';

export function useBillingInfo() {
  return useQuery({
    queryKey: [BILLING_KEY],
    queryFn: fetchBillingInfo,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
