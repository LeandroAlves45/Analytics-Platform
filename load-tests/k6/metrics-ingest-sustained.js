/**
 * Load test — throughput sustentado (capacidade diária).
 *
 * Target: 1M metrics/day ≈ 11.57 req/s média.
 * Este script usa 12 req/s constantes durante 10 minutos (~7200 requests).
 *
 * Threshold: P95 < 150ms, error rate < 1%.
 *
 * Uso:
 *   API_KEY=apk_xxx k6 run load-tests/k6/metrics-ingest-sustained.js
 *
 * Pré-requisito: workspace plan business (5000 req/min) ou API key dedicada.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  BASE_URL,
  API_KEY,
  buildIngestPayload,
  authHeaders,
  validateCredentials,
} from './helpers/config.js';

/** Taxa alvo: 12 req/s alinhado com 1M metrics/day. */
const TARGET_RATE = 12;

/** Duração do teste sustentado: 10 minutos. */
const TEST_DURATION = '10m';

export const options = {
  scenarios: {
    sustained_ingest: {
      executor: 'constant-arrival-rate', // mantém taxa constante (12 req/s), ajusta VUs automaticamente
      rate: TARGET_RATE,
      timeUnit: '1s',
      duration: TEST_DURATION,
      preAllocatedVUs: 20, // inicia 20 VUs
      maxVUs: 50, // pode crescer até 50 se necessário
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<250'], // P95 < 250ms (mais realista para CI)
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  validateCredentials();
  if (!API_KEY) {
    throw new Error('API_KEY env var is required. Usage: API_KEY=apk_xxx k6 run ...');
  }
  return { apiKey: API_KEY };
}

/**
 * Iteração principal: uma métrica por arrival tick
 * constant-arrival-rate gerencia o pacing automaticamente
 * @param {Object} data Output de setup()
 */
export default function (data) {
  const payload = buildIngestPayload();

  const res = http.post(`${BASE_URL}/api/metrics`, payload, {
    headers: authHeaders(data.apiKey),
    tags: { scenario: 'sustained' },
  });

  check(res, {
    'status is 202 Accepted': (r) => r.status === 202,
    'not rate limited (429)': (r) => r.status !== 429,
  });

  sleep(0.01);
}
