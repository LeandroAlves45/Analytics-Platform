/**
 * Funções de pedido HTTP para o domínio de alerting.
 * Chamadas exclusivamente pelos hooks React Query — componentes nunca importam axios directamente.
 */

import apiClient from './client';
import type {
  AlertEventsListResponse,
  AlertEventsQueryParams,
  AlertRule,
  AlertRulesListResponse,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from '@/types/alerts';

/**
 * Lista todas as regras do workspace.
 * GET /api/alert-rules
 */
export async function fetchAlertRules(): Promise<AlertRulesListResponse> {
  const response = await apiClient.get<{ data: AlertRulesListResponse }>('/api/alert-rules');
  return response.data.data;
}

/**
 * Obtêm uma regra de ID -> usado pelo formulário de edição.
 * GET /api/alert-rules/:id
 */
export async function fetchAlertRule(id: string): Promise<AlertRule> {
  const response = await apiClient.get<{ data: AlertRule }>(`/api/alert-rules/${id}`);
  return response.data.data;
}

/**
 * Cria uma nova regra.
 * POST /api/alert-rules
 */
export async function createAlertRule(input: CreateAlertRuleInput): Promise<AlertRule> {
  const response = await apiClient.post<{ data: AlertRule }>('/api/alert-rules', input);
  return response.data.data;
}

/**
 * Atualiza uma regra existente.
 * PUT /api/alert-rules/:id
 */
export async function updateAlertRule(id: string, input: UpdateAlertRuleInput): Promise<AlertRule> {
  const response = await apiClient.put<{ data: AlertRule }>(`/api/alert-rules/${id}`, input);
  return response.data.data;
}

/**
 * Elimina uma regra (cascade apaga eventos associados no backend).
 * DELETE /api/alert-rules/:id
 *
 * Backend responde 204 No Content — sem corpo, sem envelope { data: ... }.
 * O tipo de retorno é void; não existe DeleteAlertRuleResponse.
 */
export async function deleteAlertRule(id: string): Promise<void> {
  await apiClient.delete(`/api/alert-rules/${id}`);
}

/**
 * Lista eventos de alerta com filtro opcional de estado.
 * GET /api/alert-events?limit=20&status=open|resolved|all
 */
export async function fetchAlertEvents(
  params: AlertEventsQueryParams = {}
): Promise<AlertEventsListResponse> {
  const response = await apiClient.get<{ data: AlertEventsListResponse }>('/api/alert-events', {
    params,
  });
  return response.data.data;
}
