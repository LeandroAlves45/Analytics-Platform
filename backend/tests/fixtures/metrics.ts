/**
 * Fixtures centralizadas de teste para ingestão de métricas.
 * UUIDs válidos (RFC 4122) que passam validação de BD.
 */

import { randomUUID } from 'crypto';
import type { CreateMetricInput } from '@domain/entities/Metric';

/** UUID v4 válido para workspaceId em testes */
export const TEST_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';

/** UUID v4 válido para apiKeyId em testes */
export const TEST_API_KEY_ID = '660e8400-e29b-41d4-a716-446655440001';

/**
 * UUID v4 válido para requestId em testes.
 * Usar quando o requestId pode ser fixo (testes de duplicado, idempotência).
 */
export const TEST_REQUEST_ID = '770e8400-e29b-41d4-a716-446655440002';

/**
 * Segundo requestId para testes que precisam de dois IDs distintos.
 * Usar em testes de duplicado ou race condition.
 */
export const TEST_REQUEST_ID_2 = '880e8400-e29b-41d4-a716-446655440003';

/**
 * Input base válido para criar uma Metric em testes.
 * Usar spread para sobrepor apenas os campos relevantes ao teste.
 *
 * @example
 * const metric = new Metric({ ...BASE_METRIC_INPUT, latencyMs: 500 });
 * const input = { ...BASE_METRIC_INPUT, requestId: TEST_REQUEST_ID_2 };
 */
export const BASE_METRIC_INPUT: CreateMetricInput = {
  workspaceId: TEST_WORKSPACE_ID,
  apiKeyId: TEST_API_KEY_ID,
  endpoint: '/api/users',
  method: 'GET',
  latencyMs: 150,
  statusCode: 200,
  requestId: TEST_REQUEST_ID,
};

/**
 * Gera um requestId UUID v4 único por chamada.
 * Usar em `createValidMetric()` e em qualquer teste que precise de múltiplas
 * métricas sem colisão de requestId.
 *
 * @example
 * requestId: createUniqueRequestId()
 */
export const createUniqueRequestId = (): string => randomUUID();
