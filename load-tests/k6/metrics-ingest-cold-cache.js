/**
 * Load test — cache frio / multi-tenant (valida Passo 15 + bcrypt path).
 *
 * Roda com pool de API keys (round-robin por VU) para evitar cache Redis quente
 * numa única key — simula muitos tenants com keys diferentes.
 *
 * Uso:
 *   API_KEYS=apk_a,apk_b,apk_c k6 run load-tests/k6/metrics-ingest-cold-cache.js
 *
 * Recomendado: 10–50 keys, plan business, flush Redis antes do teste:
 *   docker exec analytics-saas-redis redis-cli FLUSHDB
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

import {
  BASE_URL,
  parseApiKeyPool,
  buildIngestPayload,
  authHeaders,
  validateCredentials,
} from './helpers/config.js';

export const options = {
  scenarios: {
    cold_cache: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '2m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    // Cache miss inclui bcrypt -> threshold mais permissivo que sustained.
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  validateCredentials();
  const keys = parseApiKeyPool();
  if (keys.length === 0) {
    throw new Error(
      'API_KEYS or API_KEY env var is required. Usage: API_KEYS=apk_a,apk_b,apk_c k6 run ...'
    );
  }
  return { keys };
}

/**
 * Selecciona key por VU -> distribuição estável entre keys e pool.
 * @param {object} data
 */
export default function (data) {
  const keyIndex = (__VU - 1) % data.keys.length;
  const apiKey = data.keys[keyIndex];

  const payload = buildIngestPayload();

  const res = http.post(`${BASE_URL}/api/metrics`, payload, {
    headers: authHeaders(apiKey),
    tags: { scenario: 'cold_cache' },
  });

  check(res, {
    'status is 202 Accepted': (r) => r.status === 202,
    'not rate limited (429)': (r) => r.status !== 429,
  });

  sleep(0.2);
}
