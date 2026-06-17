/**
 * Tipos de dados para alerting.
 * Alinhados com alert_rules e alert_events na documentação do backend.
 * e com os endpoints POST/GET/PUT/DELETE /api/alert-rules e GET /api/alert-events.
 */

/**
 * Métricas que uma regra pode monitorizar.
 * O backend persiste o campo `condition` como string — estes valores são o vocabulário fixo.
 */
export type AlertConditionMetric = 'latency_p95' | 'error_rate' | 'status_5xx_count';

/**
 * Estado operacional da regra alinhado com alert_rules.status na BD.
 * `inactive` impede avaliação sem apagar histórico — preferível a DELETE para debugging.
 */
export type AlertRuleStatus = 'active' | 'inactive';

/**
 * Filtro de eventos expostos em GET /api/alert-events?status=...
 */
export type AlertEventStatusFilter = 'open' | 'resolved' | 'all';

/**
 * Regra de alerta tal como devolvida pelo backend.
 */
export interface AlertRule {
  id: string;
  workspaceId: string;
  endpointId: string | null;
  endpoint: string | null;
  method: string | null;
  name: string;
  description: string | null;
  condition: AlertConditionMetric;
  threshold: number;
  windowMinutes: number;
  slackWebhookUrl: string | null;
  emailAddresses: string[];
  status: AlertRuleStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload para POST /api/alert-rules.
 * Campos opcionais reflectem defaults do backend (windowMinutes=5, status=active).
 */
export interface CreateAlertRuleInput {
  name: string;
  description?: string;
  condition: AlertConditionMetric;
  threshold: number;
  windowMinutes?: number;
  // Par endpoint/method — backend faz upsert e resolve endpointId internamente
  endpoint?: string;
  method?: string;
  slackWebhookUrl?: string | null;
  emailAddresses?: string[];
  status?: AlertRuleStatus;
}

/**
 * Payload para PUT /api/alert-rules/:id — todos os campos opcionais (patch semântico).
 */
export type UpdateAlertRuleInput = Partial<CreateAlertRuleInput>;

/**
 * Resposta de GET /api/alert-rules (lista)
 */
export interface AlertRulesListResponse {
  workspaceId: string;
  rules: AlertRule[];
}

/**
 * Evento de alerta — registo de um trigger (e eventual resolução).
 *
 * ruleName: propagado pelo caller (TriggerAlertUseCase) via CreateAlertEventData.ruleName
 * e devolvido directamente pelo repositório sem JOIN pós-INSERT.
 *
 * message: sempre definido pelo backend via AlertRule.buildTriggerMessage(value).
 * Componentes não devem depender de message=null — é invariante de negócio, não de contrato.
 *
 * Nota: AlertEvent não expõe `condition` — o tipo de métrica pertence à AlertRule, não ao evento.
 * Para formatar o valor do evento usa-se message directamente (já inclui unidade e contexto).
 */
export interface AlertEvent {
  id: string;
  alertRuleId: string;
  ruleName: string;
  workspaceId: string;
  triggeredAt: string;
  resolvedAt: string | null;
  value: number;
  message: string | null;
  slackSent: boolean;
  emailSent: boolean;
}

/**
 * Parâmetros de query para GET /api/alert-events.
 */
export interface AlertEventsQueryParams {
  limit?: number;
  status?: AlertEventStatusFilter;
}

/**
 * Resposta de GET /api/alert-events
 */
export interface AlertEventsListResponse {
  workspaceId: string;
  events: AlertEvent[];
}
