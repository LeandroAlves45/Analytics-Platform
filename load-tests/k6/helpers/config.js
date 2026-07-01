/**
 * Configuração partilhada entre scripts k6.
 *
 * Variáveis de ambiente (passadas na linha de comando):
 * @env {string} API_URL   - Base URL da API (default: http://localhost:3000)
 * @env {string} API_KEY    - Uma API key apk_... (cenários sustained/peak/dashboard setup)
 * @env {string} API_KEYS  - Lista comma-separated de keys (cenário cold-cache)
 * @env {string} JWT_TOKEN - Bearer JWT para rotas dashboard
 */

/** @type {string} URL base — sem trailing slash */
export const BASE_URL = (__ENV.API_URL || 'http://localhost:3000').replace(/\/$/, '');

/** @type {string|undefined} API key única para cenários simples */
export const API_KEY = __ENV.API_KEY;

/** @type {string|undefined} JWT para GET /api/metrics/aggregated */
export const JWT_TOKEN = __ENV.JWT_TOKEN;

/**
 * Parseia API_KEYS env num array não vazio.
 * @returns {string[]} Lista de plaintext keys
 */
export function parseApiKeyPool() {
  const raw = __ENV.API_KEYS || __ENV.API_KEY || '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/**
 * Payload mínimo válido para POST /api/metrics (schema Zod do MetricsController).
 * requestId único por request evita 409 Conflict.
 *
 * @returns {string} JSON serializado com requestId único
 * @throws {Error} Se UUID gerado é inválido
 */
/**
 * UUID v4 generator usando k6 built-in randomBytes.
 * Retorna formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
function generateUUID() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;  // versão 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80;  // variant 1

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function buildIngestPayload() {
  const uuid = generateUUID();
  if (!uuid || typeof uuid !== 'string') {
    throw new Error(`Generated UUID is invalid: ${uuid}`);
  }

  const payload = {
    endpoint: '/api/users',
    method: 'GET',
    latencyMs: Math.floor(Math.random() * 200) + 50,
    statusCode: 200,
    requestId: uuid,
  };

  return JSON.stringify(payload);
}

/** Headers comuns para ingestão autenticada por API key. */
export const INGEST_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * @param {string} apiKey - plaintext API key com prefixo apk_
 * @returns {Record<string, string>}
 */
export function authHeaders(apiKey) {
  return {
    ...INGEST_HEADERS,
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Valida credenciais antes de iniciar o teste.
 * Falha cedo se API_KEY ou JWT_TOKEN forem inválidos.
 * @throws {Error} Se credenciais têm formato inválido
 */
export function validateCredentials() {
  if (API_KEY && !API_KEY.startsWith('apk_')) {
    throw new Error(`API_KEY must start with "apk_", received: ${API_KEY.substring(0, 10)}...`);
  }
  if (JWT_TOKEN && !JWT_TOKEN.startsWith('eyJ')) {
    throw new Error(
      `JWT_TOKEN is not a valid JWT token (must start with "eyJ"), received: ${JWT_TOKEN.substring(0, 10)}...`
    );
  }
}
