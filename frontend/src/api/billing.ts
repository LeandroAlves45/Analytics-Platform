/**
 * Funções HTTP para billing.
 *
 * Rotas backend (montadas sob dashboardRouter /api com JWT obrigatório):
 * - GET  /api/billing          → informação de billing do workspace autenticado
 * - POST /api/billing/checkout → cria sessão Stripe e devolve URL de redirect
 */

import apiClient from './client';
import type { BillingInfo, TargetPlan } from '@/types/billing';

export async function fetchBillingInfo(): Promise<BillingInfo> {
  const response = await apiClient.get<{ data: BillingInfo }>('/api/billing');
  return response.data.data;
}

export async function createCheckoutSession(targetPlan: TargetPlan): Promise<{ url: string }> {
  const response = await apiClient.post<{ data: { url: string } }>('/api/billing/checkout', {
    targetPlan,
  });
  return response.data.data;
}
