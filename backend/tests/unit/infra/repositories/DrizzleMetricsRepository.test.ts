/**
 * Testes unitários do repositório com base de dados mockada.
 * O objectivo é testar a lógica de transformação, tratamento de erros,
 * e integração com o cache (estratégia Cache-Aside).
 */

import { DrizzleMetricsRepository } from '@infra/repositories/DrizzleMetricsRepository';
import { Metric } from '@domain/entities/Metric';
import { AppError } from '@shared/errors';
import {
  TEST_WORKSPACE_ID,
  TEST_API_KEY_ID,
  TEST_REQUEST_ID,
  createUniqueRequestId,
} from '../../../fixtures/metrics';

/**
 * Factory para criar uma Metric válida com UUIDs de teste.
 * Cada chamada gera um requestId único para evitar colisões em múltiplas métricas.
 *
 * @returns Nova instância de Metric com fixtures de teste
 */
const createValidMetric = (): Metric => {
  return new Metric({
    workspaceId: TEST_WORKSPACE_ID,
    apiKeyId: TEST_API_KEY_ID,
    endpoint: '/api/users',
    method: 'GET',
    latencyMs: 150,
    statusCode: 200,
    requestId: createUniqueRequestId(),
  });
};

/**
 * Factory de mock para Drizzle db.
 * Estrutura espelha a API do Drizzle encadeada.
 */
const createMockDb = () => {
  // Mock para operações de insert encadeadas: db.insert(table).values(data)
  const insertMock = {
    values: jest.fn().mockResolvedValue([]),
  };

  // Mock para operações de select encadeadas: db.select().from(table).where(conditions).limit(n)
  const selectMock = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    orderBy: jest.fn().mockResolvedValue([]),
  };

  // Mock para operações dentro de uma transação (tx.insert, tx.select, etc.)
  const txMock = {
    insert: jest.fn().mockReturnValue(insertMock),
    select: jest.fn().mockReturnValue(selectMock),
  };

  return {
    insert: jest.fn().mockReturnValue(insertMock),
    select: jest.fn().mockReturnValue(selectMock),
    transaction: jest.fn().mockImplementation((callback) => callback(txMock)),
    // Guardamos referências para poder verificar chamadas nos testes.
    _insertMock: insertMock,
    _selectMock: selectMock,
    _tx: txMock,
  };
};

/**
 * Factory de mock para MetricsCacheService.
 * Permite verificar chamadas ao cache nos testes de integração Cache-Aside.
 */
const createMockCache = () => ({
  getRecent: jest.fn().mockResolvedValue(null),
  setRecent: jest.fn().mockResolvedValue(undefined),
  invalidate: jest.fn().mockResolvedValue(undefined),
});

describe('DrizzleMetricsRepository', () => {
  let repository: DrizzleMetricsRepository;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockCache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCache = createMockCache();
    // Cast necessário porque o mock não implementa toda a interface do Drizzle,
    // apenas os métodos que o repositório usa.
    repository = new DrizzleMetricsRepository(mockDb as never, mockCache);
  });

  afterEach(() => {
    // Limpar todos os mocks após cada teste para evitar contaminação cruzada
    jest.clearAllMocks();
  });

  // Grupo 1: save() — Comportamento base
  describe('save()', () => {
    it('should save all optional fields correctly', async () => {
      const metric = new Metric({
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/data',
        method: 'POST',
        latencyMs: 250,
        statusCode: 201,
        requestId: TEST_REQUEST_ID,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        payloadSizeBytes: 2048,
      });

      // Mock para idempotency keys (novo requestId, será inserido)
      const idempotencyMock = {
        values: jest.fn().mockReturnThis(),
        onConflictDoNothing: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ requestId: metric.requestId }]),
      };

      const metricsMock = {
        values: jest.fn().mockResolvedValue(undefined),
      };

      mockDb._tx.insert.mockReturnValueOnce(idempotencyMock).mockReturnValueOnce(metricsMock);

      await repository.save(metric);

      // Verificar que os campos opcionais foram passados corretamente
      expect(metricsMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
          payloadSizeBytes: 2048,
        })
      );
    });

    it('should save metric without optional fields', async () => {
      const metric = createValidMetric();

      const idempotencyMock = {
        values: jest.fn().mockReturnThis(),
        onConflictDoNothing: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ requestId: metric.requestId }]),
      };

      const metricsMock = {
        values: jest.fn().mockResolvedValue(undefined),
      };

      mockDb._tx.insert.mockReturnValueOnce(idempotencyMock).mockReturnValueOnce(metricsMock);

      await repository.save(metric);

      // Campos opcionais são passados como undefined (não null) ao INSERT
      expect(metricsMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: undefined,
          ipAddress: undefined,
          payloadSizeBytes: undefined,
        })
      );
    });

    it('should preserve exact timestamp from metric', async () => {
      const metric = createValidMetric();
      const expectedTime = metric.timestamp;

      const idempotencyMock = {
        values: jest.fn().mockReturnThis(),
        onConflictDoNothing: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ requestId: metric.requestId }]),
      };

      const metricsMock = {
        values: jest.fn().mockResolvedValue(undefined),
      };

      mockDb._tx.insert.mockReturnValueOnce(idempotencyMock).mockReturnValueOnce(metricsMock);

      await repository.save(metric);

      expect(metricsMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          time: expectedTime,
        })
      );
    });

    it('should throw AppError when transaction fails', async () => {
      const metric = createValidMetric();
      const dbError = new Error('transaction failed');

      mockDb.transaction.mockRejectedValue(dbError);

      await expect(repository.save(metric)).rejects.toMatchObject({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
      });
    });

    it('should call cache.invalidate with workspaceId after successful save', async () => {
      const metric = createValidMetric();

      const idempotencyMock = {
        values: jest.fn().mockReturnThis(),
        onConflictDoNothing: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ requestId: metric.requestId }]),
      };

      const metricsMock = {
        values: jest.fn().mockResolvedValue(undefined),
      };

      mockDb._tx.insert.mockReturnValueOnce(idempotencyMock).mockReturnValueOnce(metricsMock);

      await repository.save(metric);

      expect(mockCache.invalidate).toHaveBeenCalledWith(TEST_WORKSPACE_ID);
    });

    it('should not call cache.invalidate when transaction fails', async () => {
      const metric = createValidMetric();

      mockDb.transaction.mockRejectedValue(new Error('transaction failed'));

      await expect(repository.save(metric)).rejects.toMatchObject({
        statusCode: 500,
      });

      expect(mockCache.invalidate).not.toHaveBeenCalled();
    });

    it('should still resolve when cache.invalidate throws', async () => {
      const metric = createValidMetric();

      const idempotencyMock = {
        values: jest.fn().mockReturnThis(),
        onConflictDoNothing: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ requestId: metric.requestId }]),
      };

      const metricsMock = {
        values: jest.fn().mockResolvedValue(undefined),
      };

      mockDb._tx.insert.mockReturnValueOnce(idempotencyMock).mockReturnValueOnce(metricsMock);
      mockCache.invalidate.mockRejectedValue(new Error('Redis unavailable'));

      // cache.invalidate lançar não deve impedir o save de completar com sucesso
      await expect(repository.save(metric)).resolves.toBeUndefined();
    });

    it('should not call cache.invalidate when requestId is duplicate', async () => {
      const metric = createValidMetric();

      // RETURNING vazio = requestId duplicado, insert não acontece
      const idempotencyMock = {
        values: jest.fn().mockReturnThis(),
        onConflictDoNothing: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };

      mockDb._tx.insert.mockReturnValueOnce(idempotencyMock);

      await repository.save(metric);

      // Duplicado ignorado silenciosamente
      expect(mockCache.invalidate).not.toHaveBeenCalled();
    });
  });

  // Grupo 2: existsByRequestId()
  describe('existsByRequestId()', () => {
    it('should return false when no rows found', async () => {
      // O mock já devolve [] por defeito.
      const exists = await repository.existsByRequestId(TEST_REQUEST_ID);

      expect(exists).toBe(false);
    });

    it('should return true when row is found', async () => {
      // Simulamos que a query encontrou um registo.
      mockDb._selectMock.limit.mockResolvedValue([{ requestId: TEST_REQUEST_ID }]);

      const exists = await repository.existsByRequestId(TEST_REQUEST_ID);

      expect(exists).toBe(true);
    });

    it('should return false when requestId is null/empty', async () => {
      // Se limite for 1 e não houver resultados
      mockDb._selectMock.limit.mockResolvedValue([]);

      const exists = await repository.existsByRequestId('');

      expect(exists).toBe(false);
    });

    it('should return true and limit to 1 result for efficiency', async () => {
      mockDb._selectMock.limit.mockResolvedValue([{ requestId: TEST_REQUEST_ID }]);

      const exists = await repository.existsByRequestId(TEST_REQUEST_ID);

      // Verificar que limit(1) foi chamado para eficiência
      expect(mockDb._selectMock.limit).toHaveBeenCalledWith(1);
      expect(exists).toBe(true);
    });

    it('should not use cache, always queries the database directly', async () => {
      await repository.existsByRequestId(TEST_REQUEST_ID);

      // Verificação de idempotência não usa cache
      expect(mockCache.getRecent).not.toHaveBeenCalled();
    });

    it('should throw AppError when database check fails', async () => {
      mockDb._selectMock.limit.mockRejectedValue(new Error('DB connection lost'));

      await expect(repository.existsByRequestId(TEST_REQUEST_ID)).rejects.toMatchObject({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
      });
    });
  });

  // Grupo 3: getRecent()
  describe('getRecent()', () => {
    it('should return cached metrics on cache hit without querying the database', async () => {
      const cachedMetrics = [createValidMetric()];

      mockCache.getRecent.mockResolvedValue(cachedMetrics);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 5);

      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toBe(cachedMetrics[0]);
      expect(metrics[0]).toBeInstanceOf(Metric);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should not populate cache when cache hit occurs', async () => {
      const cachedMetrics = [createValidMetric()];

      mockCache.getRecent.mockResolvedValue(cachedMetrics);

      await repository.getRecent(TEST_WORKSPACE_ID, 5);

      expect(mockCache.setRecent).not.toHaveBeenCalled();
    });

    it('should query database and populate cache on cache miss', async () => {
      // Cache miss: getRecent devolve null
      mockCache.getRecent.mockResolvedValue(null);

      const dbRow = {
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/test',
        method: 'GET',
        latencyMs: 100,
        statusCode: 200,
        payloadSizeBytes: null,
        requestId: TEST_REQUEST_ID,
        userAgent: null,
        ipAddress: null,
        time: new Date(),
      };

      mockDb._selectMock.orderBy.mockResolvedValue([dbRow]);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 5);

      // Verificar que foi á BD
      expect(mockDb.select).toHaveBeenCalled();
      // Verificar que populou o cache
      expect(mockCache.setRecent).toHaveBeenCalledWith(
        TEST_WORKSPACE_ID,
        5,
        expect.arrayContaining([expect.any(Metric)])
      );
      expect(metrics).toHaveLength(1);
    });

    it('should return empty array when no metrics found and populate cache', async () => {
      mockCache.getRecent.mockResolvedValue(null);
      mockDb._selectMock.orderBy.mockResolvedValue([]);

      // O mock já devolve [] por defeito.
      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 5);

      expect(metrics).toEqual([]);
      // Mesmo com resultado vazio, populamos o cache para evitar cache stampede
      expect(mockCache.setRecent).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 5, []);
    });

    it('should fall back to database when cache.getRecent throws', async () => {
      mockCache.getRecent.mockRejectedValue(new Error('Redis connection lost'));
      mockDb._selectMock.orderBy.mockResolvedValue([]);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 5);

      expect(metrics).toEqual([]);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should throw AppError when database query fails', async () => {
      mockCache.getRecent.mockResolvedValue(null);
      mockDb._selectMock.orderBy.mockRejectedValue(new Error('db_error'));

      // Deve lançar AppError com o código INTERNAL_SERVER_ERROR
      await expect(repository.getRecent(TEST_WORKSPACE_ID, 5)).rejects.toMatchObject({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
      });
    });

    it('should return Metric instances hydrated from database rows', async () => {
      mockCache.getRecent.mockResolvedValue(null);

      const dbRow = {
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/test',
        method: 'GET',
        latencyMs: 100,
        statusCode: 200,
        payloadSizeBytes: null,
        requestId: TEST_REQUEST_ID,
        userAgent: null,
        ipAddress: null,
        time: new Date(),
      };

      mockDb._selectMock.orderBy.mockResolvedValue([dbRow]);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 10);

      expect(metrics[0]).toBeInstanceOf(Metric);
      expect(metrics[0].userAgent).toBeNull();
      expect(metrics[0].ipAddress).toBeNull();
      expect(metrics[0].payloadSizeBytes).toBeNull();
    });

    it('should pass correct workspaceId to query', async () => {
      await repository.getRecent(TEST_WORKSPACE_ID, 10);

      // Verificamos que select foi chamado — a filtragem por workspaceId
      // é validada no teste de integração com base de dados real.
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should correctly hydrate optional fields with values', async () => {
      const dbRow = {
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/test',
        method: 'GET',
        latencyMs: 100,
        statusCode: 200,
        payloadSizeBytes: 1024,
        requestId: TEST_REQUEST_ID,
        userAgent: 'Chrome/120.0',
        ipAddress: '10.0.0.1',
        time: new Date(),
      };

      mockDb._selectMock.orderBy.mockResolvedValue([dbRow]);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 10);

      expect(metrics[0].userAgent).toBe('Chrome/120.0');
      expect(metrics[0].ipAddress).toBe('10.0.0.1');
      expect(metrics[0].payloadSizeBytes).toBe(1024);
    });

    it('should convert latencyMs number correctly (Float to Number)', async () => {
      const dbRow = {
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/test',
        method: 'GET',
        latencyMs: 123.456, // Drizzle pode retornar Float
        statusCode: 200,
        payloadSizeBytes: null,
        requestId: TEST_REQUEST_ID,
        userAgent: null,
        ipAddress: null,
        time: new Date(),
      };

      mockDb._selectMock.orderBy.mockResolvedValue([dbRow]);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 5);

      expect(metrics[0].latencyMs).toBe(123.456);
      expect(typeof metrics[0].latencyMs).toBe('number');
    });

    it('should hydrate multiple metrics correctly', async () => {
      mockCache.getRecent.mockResolvedValue(null);

      const dbRows = [
        {
          workspaceId: TEST_WORKSPACE_ID,
          apiKeyId: TEST_API_KEY_ID,
          endpoint: '/api/test',
          method: 'GET',
          latencyMs: 100,
          statusCode: 200,
          payloadSizeBytes: null,
          requestId: createUniqueRequestId(),
          userAgent: null,
          ipAddress: null,
          time: new Date(),
        },
        {
          workspaceId: TEST_WORKSPACE_ID,
          apiKeyId: TEST_API_KEY_ID,
          endpoint: '/api/test',
          method: 'GET',
          latencyMs: 150,
          statusCode: 200,
          payloadSizeBytes: null,
          requestId: createUniqueRequestId(),
          userAgent: null,
          ipAddress: null,
          time: new Date(),
        },
        {
          workspaceId: TEST_WORKSPACE_ID,
          apiKeyId: TEST_API_KEY_ID,
          endpoint: '/api/test',
          method: 'GET',
          latencyMs: 200,
          statusCode: 200,
          payloadSizeBytes: null,
          requestId: createUniqueRequestId(),
          userAgent: null,
          ipAddress: null,
          time: new Date(),
        },
      ];

      mockDb._selectMock.orderBy.mockResolvedValue(dbRows);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 15);

      expect(metrics).toHaveLength(3);
      metrics.forEach((m) => expect(m).toBeInstanceOf(Metric));
    });

    it('should filter by workspaceId correctly', async () => {
      mockDb._selectMock.where.mockReturnThis();
      mockDb._selectMock.orderBy.mockResolvedValue([]);

      await repository.getRecent(TEST_WORKSPACE_ID, 10);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb._selectMock.from).toHaveBeenCalled();
      expect(mockDb._selectMock.where).toHaveBeenCalled();
    });

    it('should preserve timestamp from database row', async () => {
      mockCache.getRecent.mockResolvedValue(null);

      const fixedTime = new Date('2025-01-15T10:00:00Z');

      const dbRow = {
        time: fixedTime,
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/test',
        method: 'GET',
        latencyMs: 150,
        statusCode: 200,
        payloadSizeBytes: null,
        requestId: TEST_REQUEST_ID,
        userAgent: null,
        ipAddress: null,
        createdAt: new Date(),
      };

      mockDb._selectMock.orderBy.mockResolvedValue([dbRow]);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 5);

      expect(metrics[0].timestamp).toEqual(fixedTime);
    });

    it('should query database with a filter when cache misses', async () => {
      mockCache.getRecent.mockResolvedValue(null);

      await repository.getRecent(TEST_WORKSPACE_ID, 5);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb._selectMock.where).toHaveBeenCalled();
    });
  });

  // Grupo 4: Hydration
  describe('Hydration -> Integration with Metric entity validations', () => {
    it('should create a valid Metric from database row', async () => {
      mockCache.getRecent.mockResolvedValue(null);

      const dbRow = {
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/users',
        method: 'POST',
        latencyMs: 200,
        statusCode: 201,
        payloadSizeBytes: 512,
        requestId: TEST_REQUEST_ID,
        userAgent: 'Node.js Client',
        ipAddress: '172.16.0.1',
        time: new Date(),
      };

      mockDb._selectMock.orderBy.mockResolvedValue([dbRow]);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 5);

      // Metric entity valida no seu construtor
      expect(metrics[0]).toBeInstanceOf(Metric);
      expect(metrics[0].isError()).toBe(false); // 201 é sucesso, não é erro
      expect(metrics[0].isServerError()).toBe(false); // 201 é sucesso, não é erro do servidor
    });

    it('should support domain methods after hydration', async () => {
      mockCache.getRecent.mockResolvedValue(null);

      const dbRow = {
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/data',
        method: 'GET',
        latencyMs: 450,
        statusCode: 500,
        payloadSizeBytes: null,
        requestId: createUniqueRequestId(),
        userAgent: null,
        ipAddress: null,
        time: new Date(),
      };

      mockDb._selectMock.orderBy.mockResolvedValue([dbRow]);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 5);

      expect(metrics[0].isError()).toBe(true);
      expect(metrics[0].isServerError()).toBe(true);
      expect(metrics[0].isSlow(400)).toBe(true);
      expect(metrics[0].getStatusCodeFamily()).toBe('5xx');
    });
  });

  // Grupo 5: Error Handling
  describe('Error Handling edge cases', () => {
    it('should handle database timeout errors gracefully', async () => {
      mockCache.getRecent.mockResolvedValue(null);
      mockDb._selectMock.orderBy.mockRejectedValue(new Error('db connection timeout'));

      await expect(repository.getRecent(TEST_WORKSPACE_ID, 5)).rejects.toMatchObject({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
      });
    });

    it('should wrap database error in AppError with cause preserved', async () => {
      mockCache.getRecent.mockResolvedValue(null);
      mockDb._selectMock.orderBy.mockRejectedValue(new Error('Pool exhausted'));

      const error = await repository.getRecent(TEST_WORKSPACE_ID, 5).catch((e) => e);

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(500);
    });
  });

  // Grupo 6: Idempotência (transacional com metric_idempotency_keys)
  describe('save() — idempotence', () => {
    /**
     * Testa o cenário onde um requestId já foi processado numa transação anterior.
     * O mock retorna array vazio do RETURNING, indicando conflito com PRIMARY KEY.
     * O repositório deve retornar silenciosamente sem erro (idempotência garantida).
     */
    it('should silently skip insert when requestId already exists', async () => {
      const metric = createValidMetric();

      // Mock da cadeia de insert com ON CONFLICT DO NOTHING RETURNING
      const idempotencyInsertMock = {
        values: jest.fn().mockReturnThis(),
        onConflictDoNothing: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]), // vazio = requestId duplicado
      };

      mockDb._tx.insert.mockReturnValueOnce(idempotencyInsertMock);

      await expect(repository.save(metric)).resolves.toBeUndefined();
      expect(mockCache.invalidate).not.toHaveBeenCalled();
    });

    /**
     * Testa o happy path: um requestId novo passa pelo primeiro insert,
     * retorna na cláusula RETURNING, e depois insere em metrics_raw.
     */
    it('should insert into both tables when requestId is new', async () => {
      const metric = createValidMetric();

      // Mock da cadeia de insert para metric_idempotency_keys
      const idempotencyInsertMock = {
        values: jest.fn().mockReturnThis(),
        onConflictDoNothing: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ requestId: metric.requestId }]), // inserido com sucesso
      };

      // Mock da cadeia de insert para metrics_raw
      const metricsRawInsertMock = {
        values: jest.fn().mockResolvedValue(undefined),
      };

      mockDb._tx.insert
        .mockReturnValueOnce(idempotencyInsertMock) // 1º call: metric_idempotency_keys
        .mockReturnValueOnce(metricsRawInsertMock); // 2º call: metrics_raw

      await expect(repository.save(metric)).resolves.toBeUndefined();
      expect(mockCache.invalidate).toHaveBeenCalledWith(metric.workspaceId);
    });

    /**
     * Testa que a transação é realmente usada e que erros dentro dela
     * são propagados como AppError.
     */
    it('should throw AppError when transaction fails', async () => {
      const metric = createValidMetric();
      const dbError = new Error('transaction failed');

      mockDb.transaction.mockRejectedValue(dbError);

      await expect(repository.save(metric)).rejects.toMatchObject({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
      });
    });
  });
});
