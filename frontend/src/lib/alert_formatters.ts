/**
 * Formatadores específicos do domínio de alerting.
 * Separados de formatters.ts porque misturam métricas de dashboard
 * com vocabulário de regras — manter ficheiros distintos evita acoplamento.
 *
 * Uso correcto de formatAlertThreshold:
 *   - AlertRuleRow: formatar o threshold da REGRA (tem condition disponível).
 *   - AlertRuleForm: apresentar o valor configurado na regra.
 *   NÃO usar para formatar event.value em AlertEventsTable ou RecentAlertsWidget
 *   porque AlertEvent não expõe condition — usar event.message directamente.
 */

import type { AlertConditionMetric, AlertRuleStatus } from '@/types/alerts';

const CONDITION_LABELS: Record<AlertConditionMetric, string> = {
  latency_p95: 'P95 Latency',
  error_rate: 'Error rate',
  status_5xx_count: '5xx count',
};

/**
 * Formata o threshold conforme a métrica — error_rate é ratio (0.05 → 5%),
 * latência em ms, contagem como inteiro.
 */
export function formatAlertThreshold(metric: AlertConditionMetric, threshold: number): string {
  if (metric === 'error_rate') {
    return `${(threshold * 100).toFixed(1)}%`;
  }
  if (metric === 'latency_p95') {
    return `${Math.round(threshold)}ms`;
  }
  return String(Math.round(threshold));
}

/**
 * Label legível da condição completa — ex: "P95 Latency > 500ms".
 * Usado em listagens onde o utilizador precisa reconhecer a regra num relance.
 */
export function formatConditionLabel(metric: AlertConditionMetric, threshold: number): string {
  return `${CONDITION_LABELS[metric]} > ${formatAlertThreshold(metric, threshold)}`;
}

/**
 * Label curto do estado da regra -> badges compactos na tabela de regras.
 */
export function formatRuleStatusLabel(status: AlertRuleStatus): string {
  return status === 'active' ? 'Ativa' : 'Inativa';
}

/**
 * Tempo relativo em português — alinhado com QueryErrorPanel ("Tentar novamente").
 * @example "agora", "há 45s", "há 3 min", "há 2 h"
 */
export function formatRelativeTime(isoTime: string, now: Date = new Date()): string {
  const then = new Date(isoTime);
  const diffMs = now.getTime() - then.getTime();

  if (Number.isNaN(diffMs) || diffMs < 0) {
    return '—';
  }

  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 10) {
    return 'agora';
  }

  if (seconds < 60) {
    return `há ${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `há ${minutes}min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `há ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

/**
 * Indica se um evento está aberto (sem resolvedAt) — usado por badges de evento.
 */
export function isAlertEventOpen(resolvedAt: string | null): boolean {
  return resolvedAt === null;
}
