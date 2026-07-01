/**
 * Load test — pico de concorrência (1000 VUs).
 *
 * Target Sprint 6 DoD: "Load test 1,000 concurrent users".
 * Simula muitos clientes SDK a enviar métricas em simultâneo.
 *
 * IMPORTANTE:
 * - Usar workspace plan BUSINESS (5000 req/min/key) ou múltiplas API keys.
 * - Com plan FREE (100 req/min), o teste falha por 429 — não mede latência real.
 *
 * Uso:
 *   API_KEY=apk_xxx k6 run load-tests/k6/metrics-ingest-peak.js
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

export const options = {
  scenarios: {
    peak_ingest: {
      executor: 'ramping-vus', // aumenta VUs gradualmente até 1000
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '2m', target: 500 },
        { duration: '2m', target: 1000 }, // Sprint 6 DoD: 1000 VUs
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
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
 * Cada VU envia requests com intervalo curto — stress de concorrência.
 * @param {object} data
 */
export default function (data) {
  const payload = buildIngestPayload();

  const res = http.post(`${BASE_URL}/api/metrics`, payload, {
    headers: authHeaders(data.apiKey),
    tags: { scenario: 'peak' },
  });

  check(res, {
    'status is 202 Accepted': (r) => r.status === 202,
    'not rate limited (429)': (r) => r.status !== 429,
  });

  sleep(0.1); // intervalo curto entre requests para stress de concorrência.
}
