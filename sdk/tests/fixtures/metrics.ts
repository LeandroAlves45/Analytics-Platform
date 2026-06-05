/**
 * Fixtures centralizadas de teste para o SDK de métricas.
 * UUIDs válidos (RFC 4122) que passam validação no servidor.
 */

import { randomUUID } from 'crypto';
import type { MetricPayload, HttpSenderConfig } from '../../src/HttpSender';

/** URL base do servidor fictício nos testes */
export const TEST_SERVER_URL = 'http://localhost:3000';

/** API key fictícia para autenticação nos testes */
export const TEST_API_KEY = 'test-api-key-fixture';

/**
 * UUID v4 válido para requestId em testes.
 * Usar quando o requestId deve ser fixo (testes de idempotência, duplicado).
 */
export const TEST_REQUEST_ID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Segundo requestId para testes que precisam de dois IDs distintos.
 */
export const TEST_REQUEST_ID_2 = '660e8400-e29b-41d4-a716-446655440001';

/**
 * Payload base válido para MetricPayload.
 * Usar spread para sobrepor apenas os campos relevantes ao teste.
 *
 * @example
 * const metric = { ...BASE_METRIC_PAYLOAD, latencyMs: 500 };
 */
export const BASE_METRIC_PAYLOAD: MetricPayload = {
  endpoint: '/api/users',
  method: 'GET',
  latencyMs: 150,
  statusCode: 200,
  requestId: TEST_REQUEST_ID,
};

/**
 * Config base para HttpSender.
 * maxRetries: 1 para testes de retry não ficarem lentos.
 * retryDelayMs: 0 elimina o delay real entre tentativas.
 *
 * @example
 * const sender = new HttpSender({ ...BASE_HTTP_SENDER_CONFIG, maxRetries: 3 });
 */
export const BASE_HTTP_SENDER_CONFIG: HttpSenderConfig = {
  serverUrl: TEST_SERVER_URL,
  apiKey: TEST_API_KEY,
  maxRetries: 1,
  retryBaseDelayMs: 0,
  timeoutMs: 5000,
};

/**
 * Constrói um MetricPayload completo com valores por defeito.
 * Sobrepõe apenas os campos passados em overrides.
 *
 * @example
 * makeMetricPayload({ latencyMs: 500, statusCode: 404 })
 */
export const makeMetricPayload = (overrides: Partial<MetricPayload> = {}): MetricPayload => ({
  ...BASE_METRIC_PAYLOAD,
  ...overrides,
});

/**
 * Constrói uma HttpSenderConfig completa com valores por defeito.
 * Sobrepõe apenas os campos passados em overrides.
 *
 * @example
 * makeHttpSenderConfig({ maxRetries: 3, retryDelayMs: 100 })
 */
export const makeHttpSenderConfig = (
  overrides: Partial<HttpSenderConfig> = {}
): HttpSenderConfig => ({
  ...BASE_HTTP_SENDER_CONFIG,
  ...overrides,
});

/**
 * Gera um requestId UUID v4 único por chamada.
 * Usar quando precisas de múltiplas métricas sem colisão de requestId.
 *
 * @example
 * makeMetricPayload({ requestId: createUniqueRequestId() })
 */
export const createUniqueRequestId = (): string => randomUUID();
