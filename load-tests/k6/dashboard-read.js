/**
 * Load test — rotas dashboard JWT (GET métricas agregadas).
 *
 * Valida: JWT verify + query TimescaleDB (metrics_5min/1h/1d).
 * Threshold P95 < 200ms (SLA dashboard, ligeiramente mais alto que ingest).
 *
 * Uso (login automático — evita JWT_TOKEN envelhecido entre geração e arranque):
 *   TEST_EMAIL=teste@exemplo.com TEST_PASSWORD=senha123 k6 run load-tests/k6/dashboard-read.js
 *
 * Uso (token manual — alternativa se já tiveres um accessToken válido):
 *   JWT_TOKEN=eyJ... k6 run load-tests/k6/dashboard-read.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, JWT_TOKEN, validateCredentials } from './helpers/config.js';

export const options = {
  scenarios: {
    dashboard_read: {
      executor: 'constant-vus',
      vus: 100,
      duration: '3m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

/**
 * Faz login para obter um accessToken fresco no arranque do teste — evita
 * usar um JWT_TOKEN copiado manualmente que pode ter expirado (JWT_EXPIRES_IN
 * default 15m) entre a geração e o arranque efectivo do k6.
 */
function loginAndGetToken() {
  const email = __ENV.TEST_EMAIL;
  const password = __ENV.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_EMAIL and TEST_PASSWORD env vars are required for automatic login. ' +
        'Usage: TEST_EMAIL=... TEST_PASSWORD=... k6 run ... ' +
        '(or provide JWT_TOKEN directly instead)'
    );
  }

  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status !== 200) {
    throw new Error(`Login failed in setup(): status=${res.status} body=${res.body}`);
  }

  const token = res.json('data.accessToken');
  if (!token) {
    throw new Error('Login response did not include data.accessToken');
  }

  return token;
}

export function setup() {
  validateCredentials();
  const jwt = JWT_TOKEN || loginAndGetToken();
  return { jwt };
}

/**
 * Consulta últimas 24h com intervalo 5 minutos.
 * @param {object} data
 */
export default function (data) {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();

  const url =
    `${BASE_URL}/api/metrics/aggregated` +
    `?from=${encodeURIComponent(from)}` +
    `&to=${encodeURIComponent(to)}` +
    `&interval=5m`;

  const res = http.get(url, {
    headers: { Authorization: `Bearer ${data.jwt}` },
    tags: { scenario: 'dashboard' },
  });

  check(res, {
    'status is 200 OK': (r) => r.status === 200,
  });

  sleep(1);
}
