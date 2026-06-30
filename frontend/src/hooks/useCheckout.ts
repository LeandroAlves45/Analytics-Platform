/**
 * Mutation para criar sessão Stripe Checkout.
 */

import { useMutation } from '@tanstack/react-query';
import { createCheckoutSession } from '@/api/billing';
import type { TargetPlan } from '@/types/billing';

export function useCheckout() {
  return useMutation({
    mutationFn: (plan: TargetPlan) => createCheckoutSession(plan),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}
