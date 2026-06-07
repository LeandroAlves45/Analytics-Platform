/**
 * Testes unitários do RedisMetricsCache.
 *
 * O Redis é mockado com um objecto manual que espelha apenas os métodos
 * usados pela implementação: get, setex, scan, del.
 * Isto mantém os testes rápidos (sem I/O real) e focados no comportamento
 * da classe, não no comportamento do ioredis.
 *
 * O que estamos a testar:
 * - getRecent: cache hit, cache miss, falha silenciosa, desserialização correcta
 * - setRecent: chave e TTL correctos, serialização correcta, falha silenciosa
 * - invalidate: sem chaves, com chaves, paginação SCAN, falha silenciosa
 * - round-trip: todos os campos preservados após set → get
 */

import { RedisMetricsCache } from '@infra/cache/RedisMetricsCache';
import { Metric } from '@domain/entities/Metric';
import {
  TEST_WORKSPACE_ID,
  TEST_API_KEY_ID,
  TEST_REQUEST_ID,
  createUniqueRequestId,
} from '../../../fixtures/metrics';

/** TTL esperado */
const CUSTOM_TTL = 120;

/** Prefixo de chaves */
const KEY_PREFIX = 'metrics:recent';

/**
 * Cria uma Metric válida com timestamp fixo para testes de serialização.
 * O timestamp fixo garante que comparações de igualdade funcionam.
 */
const createTestMetric = (requestId = TEST_REQUEST_ID): Metric => {
  return Metric.reconstitute({
    workspaceId: TEST_WORKSPACE_ID,
    apiKeyId: TEST_API_KEY_ID,
    endpoint: '/api/users',
    method: 'GET',
    latencyMs: 150,
    statusCode: 200,
    requestId,
    timestamp: new Date('2026-01-01T12:00:00Z'),
  });
};

/**
 * Mock manual do cliente ioredis.
 * Espelha apenas os métodos que RedisMetricsCache usa.
 * Cada método é um jest.fn() para permitir verificação de chamadas.
 */
const createMockRedis = () => ({
  get: jest.fn(),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  // SCAN devolve [cursor, keys[]]. Por defeito simula iteração completa com '0'.
  scan: jest.fn().mockResolvedValue(['0', []]),
});

describe('RedisMetricsCache', () => {
  let cache: RedisMetricsCache;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    // Cast necessário — o mock não implementa toda a interface Redis do ioredis.
    cache = new RedisMetricsCache(mockRedis as never, CUSTOM_TTL);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Grupo 1: getRecent()
  describe('getRecent', () => {
    it('should return null on cache miss (Redis returns null)', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.getRecent(TEST_WORKSPACE_ID, 5);

      expect(result).toBeNull();
    });

    it('should call Redis GET with correct key', async () => {
      mockRedis.get.mockResolvedValue(null);
      const expectedKey = `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:5`;

      await cache.getRecent(TEST_WORKSPACE_ID, 5);

      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should return hydrated Metric array on cache hit', async () => {
      const metric = createTestMetric();

      const serialized = JSON.stringify([
        {
          workspaceId: metric.workspaceId,
          apiKeyId: metric.apiKeyId,
          endpoint: metric.endpoint,
          method: metric.method,
          latencyMs: metric.latencyMs,
          statusCode: metric.statusCode,
          payloadSizeBytes: metric.payloadSizeBytes,
          requestId: metric.requestId,
          userAgent: metric.userAgent,
          ipAddress: metric.ipAddress,
          timestamp: metric.timestamp.toISOString(),
        },
      ]);

      mockRedis.get.mockResolvedValue(serialized);

      const result = await cache.getRecent(TEST_WORKSPACE_ID, 5);

      expect(result).toHaveLength(1);
      expect(result).not.toBeNull();
      expect(result![0]).toBeInstanceOf(Metric);
    });

    it('should preserve original timestamp after deserialization', async () => {
      const originalTimestamp = new Date('2026-01-01T12:00:00Z');
      const metric = createTestMetric();

      const serialized = JSON.stringify([
        {
          workspaceId: metric.workspaceId,
          apiKeyId: metric.apiKeyId,
          endpoint: metric.endpoint,
          method: metric.method,
          latencyMs: metric.latencyMs,
          statusCode: metric.statusCode,
          payloadSizeBytes: metric.payloadSizeBytes,
          requestId: metric.requestId,
          userAgent: metric.userAgent,
          ipAddress: metric.ipAddress,
          timestamp: originalTimestamp.toISOString(),
        },
      ]);

      mockRedis.get.mockResolvedValue(serialized);

      const result = await cache.getRecent(TEST_WORKSPACE_ID, 5);

      expect(result![0].timestamp.getTime()).toBe(originalTimestamp.getTime());
    });

    it('should return null silently when Redis throws (graceful degradation)', async () => {
      mockRedis.get.mockRejectedValue(new Error('ECONNRESET'));

      const result = await cache.getRecent(TEST_WORKSPACE_ID, 5);

      expect(result).toBeNull();
    });

    it('should return null silently when JSON parsing fails', async () => {
      mockRedis.get.mockResolvedValue('{ invalid JSON }');

      const result = await cache.getRecent(TEST_WORKSPACE_ID, 5);

      expect(result).toBeNull();
    });

    it('should use minutes in the cache key to differentiate time windows', async () => {
      mockRedis.get.mockResolvedValue(null);

      await cache.getRecent(TEST_WORKSPACE_ID, 5);
      await cache.getRecent(TEST_WORKSPACE_ID, 60);

      expect(mockRedis.get).toHaveBeenNthCalledWith(1, `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:5`);
      expect(mockRedis.get).toHaveBeenNthCalledWith(2, `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:60`);
    });

    it('should return multiple hydrated Metrics from cache', async () => {
      const metrics = [
        createTestMetric(createUniqueRequestId()),
        createTestMetric(createUniqueRequestId()),
        createTestMetric(createUniqueRequestId()),
      ];

      const serialized = JSON.stringify(
        metrics.map((m) => ({
          workspaceId: m.workspaceId,
          apiKeyId: m.apiKeyId,
          endpoint: m.endpoint,
          method: m.method,
          latencyMs: m.latencyMs,
          statusCode: m.statusCode,
          payloadSizeBytes: m.payloadSizeBytes,
          requestId: m.requestId,
          userAgent: m.userAgent,
          ipAddress: m.ipAddress,
          timestamp: m.timestamp.toISOString(),
        }))
      );

      mockRedis.get.mockResolvedValue(serialized);

      const result = await cache.getRecent(TEST_WORKSPACE_ID, 5);

      expect(result).toHaveLength(3);
      result!.forEach((m) => expect(m).toBeInstanceOf(Metric));
    });
  });

  describe('constructor TTL injection', () => {
    it('should use a different injected TTL without changing the default cache instance', async () => {
      const metric = createTestMetric();
      const customCache = new RedisMetricsCache(mockRedis as never, 90);

      await customCache.setRecent(TEST_WORKSPACE_ID, 5, [metric]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('metrics:recent'),
        90,
        expect.any(String)
      );
    });
  });

  // Grupo 2: setRecent()
  describe('setRecent', () => {
    it('should call Redis SETEX with correct key', async () => {
      const metric = createTestMetric();
      const expectedKey = `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:5`;

      await cache.setRecent(TEST_WORKSPACE_ID, 5, [metric]);

      expect(mockRedis.setex).toHaveBeenCalledWith(expectedKey, CUSTOM_TTL, expect.any(String));
    });

    it('should use injected TTL from constructor', async () => {
      const metric = createTestMetric();

      await cache.setRecent(TEST_WORKSPACE_ID, 5, [metric]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        CUSTOM_TTL,
        expect.any(String)
      );
    });

    it('should serialize metric data as valid JSON', async () => {
      const metric = createTestMetric();

      await cache.setRecent(TEST_WORKSPACE_ID, 5, [metric]);

      const serializedArg = mockRedis.setex.mock.calls[0][2] as string;

      expect(() => JSON.parse(serializedArg)).not.toThrow();

      const parsed = JSON.parse(serializedArg) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(1);
      expect(parsed[0]['workspaceId']).toBe(TEST_WORKSPACE_ID);
      expect(parsed[0]['requestId']).toBe(TEST_REQUEST_ID);
    });

    it('should serialize timestamp as ISO 8601 string', async () => {
      const metric = createTestMetric();

      await cache.setRecent(TEST_WORKSPACE_ID, 5, [metric]);

      const serializedArg = mockRedis.setex.mock.calls[0][2] as string;

      const parsed = JSON.parse(serializedArg) as Array<Record<string, unknown>>;
      expect(typeof parsed[0]['timestamp']).toBe('string');
      expect(new Date(parsed[0]['timestamp'] as string).getTime()).toBe(metric.timestamp.getTime());
    });

    it('should work correctly with empty array', async () => {
      await cache.setRecent(TEST_WORKSPACE_ID, 5, []);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:5`,
        CUSTOM_TTL,
        '[]'
      );
    });

    it('should not throw when Redis SETEX fails', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis write error'));

      const metric = createTestMetric();

      await expect(cache.setRecent(TEST_WORKSPACE_ID, 5, [metric])).resolves.toBeUndefined();
    });
  });

  // Grupo 3: invalidate()
  describe('invalidate', () => {
    it('should not call DEL when no keys are found in workspace', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await cache.invalidate(TEST_WORKSPACE_ID);

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should call DEL with all found keys', async () => {
      const key1 = `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:5`;
      const key2 = `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:60`;

      mockRedis.scan.mockResolvedValue(['0', [key1, key2]]);

      await cache.invalidate(TEST_WORKSPACE_ID);

      expect(mockRedis.del).toHaveBeenCalledWith(key1, key2);
    });

    it('should use SCAN with correct pattern for workspace', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      const expectedPattern = `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:*`;

      await cache.invalidate(TEST_WORKSPACE_ID);

      expect(mockRedis.scan).toHaveBeenCalledWith(`0`, 'MATCH', expectedPattern, 'COUNT', 100);
    });

    it('should paginate SCAN until cursor returns 0', async () => {
      const key1 = `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:5`;
      const key2 = `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:60`;

      mockRedis.scan.mockResolvedValueOnce(['42', [key1]]).mockResolvedValueOnce(['0', [key2]]);

      await cache.invalidate(TEST_WORKSPACE_ID);

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.scan).toHaveBeenNthCalledWith(
        2,
        '42',
        'MATCH',
        `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:*`,
        'COUNT',
        100
      );
      expect(mockRedis.del).toHaveBeenCalledWith(key1, key2);
    });

    it('should not throw when Redis SCAN fails (graceful degradation)', async () => {
      mockRedis.scan.mockRejectedValue(new Error('Redis SCAN error'));

      await expect(cache.invalidate(TEST_WORKSPACE_ID)).resolves.toBeUndefined();
    });

    it('should not throw when Redis DEL fails (graceful degradation)', async () => {
      const key1 = `${KEY_PREFIX}:${TEST_WORKSPACE_ID}:5`;
      mockRedis.scan.mockResolvedValue(['0', [key1]]);
      mockRedis.del.mockRejectedValue(new Error('Redis DEL error'));

      await expect(cache.invalidate(TEST_WORKSPACE_ID)).resolves.toBeUndefined();
    });
  });

  // Grupo 4: Consistência serialização / desserialização (round-trip)
  describe('serialization round-trip', () => {
    it('should preserve all metric fields through set -> get cycle', async () => {
      const original = Metric.reconstitute({
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/data',
        method: 'POST',
        latencyMs: 234.5,
        statusCode: 201,
        payloadSizeBytes: 1024,
        requestId: TEST_REQUEST_ID,
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        timestamp: new Date('2026-01-01T12:00:00Z'),
      });

      await cache.setRecent(TEST_WORKSPACE_ID, 5, [original]);
      const serializedArg = mockRedis.setex.mock.calls[0][2] as string;

      mockRedis.get.mockResolvedValue(serializedArg);

      const result = await cache.getRecent(TEST_WORKSPACE_ID, 5);

      const restored = result![0];

      expect(restored.workspaceId).toBe(original.workspaceId);
      expect(restored.apiKeyId).toBe(original.apiKeyId);
      expect(restored.endpoint).toBe(original.endpoint);
      expect(restored.method).toBe(original.method);
      expect(restored.latencyMs).toBe(original.latencyMs);
      expect(restored.statusCode).toBe(original.statusCode);
      expect(restored.payloadSizeBytes).toBe(original.payloadSizeBytes);
      expect(restored.requestId).toBe(original.requestId);
      expect(restored.userAgent).toBe(original.userAgent);
      expect(restored.ipAddress).toBe(original.ipAddress);
      expect(restored.timestamp.getTime()).toBe(original.timestamp.getTime());
    });

    it('should preserve null optional fields through round-trip', async () => {
      const original = Metric.reconstitute({
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/test',
        method: 'GET',
        latencyMs: 100,
        statusCode: 200,
        requestId: TEST_REQUEST_ID,
        timestamp: new Date(),
      });

      await cache.setRecent(TEST_WORKSPACE_ID, 5, [original]);
      const serializedArg = mockRedis.setex.mock.calls[0][2] as string;

      mockRedis.get.mockResolvedValue(serializedArg);

      const result = await cache.getRecent(TEST_WORKSPACE_ID, 5);

      const restored = result![0];

      expect(restored.userAgent == null).toBe(true);
      expect(restored.ipAddress == null).toBe(true);
      expect(restored.payloadSizeBytes == null).toBe(true);
    });

    it('should support domain methods after deserialization', async () => {
      const errorMetric = Metric.reconstitute({
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/data',
        method: 'GET',
        latencyMs: 600,
        statusCode: 500,
        requestId: TEST_REQUEST_ID,
        timestamp: new Date(),
      });

      await cache.setRecent(TEST_WORKSPACE_ID, 5, [errorMetric]);
      const serializedArg = mockRedis.setex.mock.calls[0][2] as string;

      mockRedis.get.mockResolvedValue(serializedArg);

      const result = await cache.getRecent(TEST_WORKSPACE_ID, 5);

      expect(result![0].isError()).toBe(true);
      expect(result![0].isSlow(500)).toBe(true);
      expect(result![0].isServerError()).toBe(true);
    });
  });
});
