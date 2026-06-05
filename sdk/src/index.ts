/**
 * Ponto de entrada público do SDK.
 *
 * Exporta apenas o que o utilizador do SDK precisa de conhecer.
 * As classes internas (MetricsBuffer, HttpSender) não são exportadas
 * directamente -> são detalhes de implementação.
 *
 * Uso:
 *   import { MetricsClient } from '@analytics-saas/sdk';
 */

// API pública principal
export { MetricsClient } from './MetricsClient';
export type { MetricsClientConfig, RecordMetricInput } from './MetricsClient';

// MetricPayload exposto para quem quiser usar payloads diretamente
export type { MetricPayload } from './HttpSender';

// NonRetryableError exposto para quem quiser tratar erros específicos
export { NonRetryableError } from './HttpSender';
