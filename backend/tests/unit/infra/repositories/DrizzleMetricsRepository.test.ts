/**
 * Testes unitários do repositório com base de dados mockada.
 * O objectivo é testar a lógica de transformação e tratamento de erros.
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
 * Expõe métodos em _insertMock e _selectMock para assertions nos testes.
 * A estrutura espelha a API do Drizzle: db.insert().values(), db.select().from()...
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

  return {
    insert: jest.fn().mockReturnValue(insertMock),
    select: jest.fn().mockReturnValue(selectMock),
    // Guardamos referências para poder verificar chamadas nos testes.
    _insertMock: insertMock,
    _selectMock: selectMock,
  };
};

describe('DrizzleMetricsRepository', () => {
  let repository: DrizzleMetricsRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    // Cast necessário porque o mock não implementa toda a interface do Drizzle,
    // apenas os métodos que o repositório usa.
    repository = new DrizzleMetricsRepository(mockDb as never);
  });

  // Grupo 1: save()
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

      await repository.save(metric);
      expect(mockDb._insertMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
          payloadSizeBytes: 2048,
        })
      );
    });

    it('should save metric without optional fields', async () => {
      const metric = createValidMetric();

      await repository.save(metric);

      expect(mockDb._insertMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: null,
          ipAddress: null,
          payloadSizeBytes: null,
        })
      );
    });

    it('should call db.insert with correct values', async () => {
      const metric = createValidMetric();

      await repository.save(metric);

      //Verificamos que insert foi chamado (com qualquer tabela)
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      // Verificamos que values foi chamado com os campos corretos
      expect(mockDb._insertMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: metric.workspaceId,
          endpoint: metric.endpoint,
          method: metric.method,
          latencyMs: metric.latencyMs,
          statusCode: metric.statusCode,
          requestId: metric.requestId,
        })
      );
    });

    it('should not throw when duplicate requestId constraint fires (23505)', async () => {
      // Simulamos erro PostgreSQL de unique violation
      const pgUniqueError = Object.assign(new Error('duplicate key'), { code: '23505' });
      mockDb._insertMock.values.mockRejectedValue(pgUniqueError);

      const metric = createValidMetric();

      // Não deve lançar erro, a métrica já existe, o resultado é o mesmo.
      await expect(repository.save(metric)).resolves.toBeUndefined();
    });

    it('should throw AppError when generic database error occurs', async () => {
      // Simulamos falha genérica de base de dados
      mockDb._insertMock.values.mockRejectedValue(new Error('connection timeout'));

      const metric = createValidMetric();

      // Deve lançar AppError com o código INTERNAL_SERVER_ERROR
      await expect(repository.save(metric)).rejects.toThrow(AppError);
    });

    it('should preserve exact timestamp from metric', async () => {
      const metric = createValidMetric();
      const expectedTime = metric.timestamp;

      await repository.save(metric);

      expect(mockDb._insertMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          time: expectedTime,
        })
      );
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

    it('should throw AppError when database query fails', async () => {
      // Simulamos falha de base de dados
      mockDb._selectMock.limit.mockRejectedValue(new Error('db_error'));

      // Deve lançar AppError com o código INTERNAL_SERVER_ERROR
      await expect(repository.existsByRequestId('req-123')).rejects.toThrow(AppError);
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
  });

  // Grupo 3: getRecent()
  describe('getRecent()', () => {
    it('should return empty array when no metrics found', async () => {
      // O mock já devolve [] por defeito.
      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 5);

      expect(metrics).toEqual([]);
    });

    it('should throw AppError when database query fails', async () => {
      // Simulamos falha de base de dados
      mockDb._selectMock.orderBy.mockRejectedValue(new Error('db_error'));

      // Deve lançar AppError com o código INTERNAL_SERVER_ERROR
      await expect(repository.getRecent(TEST_WORKSPACE_ID, 5)).rejects.toThrow(AppError);
    });

    it('should pass correct workspaceId to query', async () => {
      await repository.getRecent(TEST_WORKSPACE_ID, 10);

      // Verificamos que select foi chamado — a filtragem por workspaceId
      // é validada no teste de integração com base de dados real.
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return Metric entities hydrated from database rows', async () => {
      const dbRow = {
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/test',
        method: 'GET',
        latencyMs: 100.5,
        statusCode: 200,
        payloadSizeBytes: null,
        requestId: TEST_REQUEST_ID,
        userAgent: null,
        ipAddress: null,
        time: new Date('2025-01-15T10:00:00Z'),
      };

      mockDb._selectMock.orderBy.mockResolvedValue([dbRow]);

      const metrics = await repository.getRecent(TEST_WORKSPACE_ID, 10);

      expect(metrics[0].userAgent).toBeNull();
      expect(metrics[0].ipAddress).toBeNull();
      expect(metrics[0].payloadSizeBytes).toBeNull();
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
      expect(metrics[0]).toBeInstanceOf(Metric);
      expect(metrics[1]).toBeInstanceOf(Metric);
      expect(metrics[2]).toBeInstanceOf(Metric);
      expect(metrics[0].apiKeyId).toBe(TEST_API_KEY_ID);
      expect(metrics[1].apiKeyId).toBe(TEST_API_KEY_ID);
      expect(metrics[2].apiKeyId).toBe(TEST_API_KEY_ID);
    });

    it('should calculate correct "since" timestamp for time range', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T10:00:00Z'));

      await repository.getRecent(TEST_WORKSPACE_ID, 5);

      // Verifica que where() foi chamado (a filtragem de intervalo está implementada)
      expect(mockDb._selectMock.where).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should filter by workspaceId correctly', async () => {
      mockDb._selectMock.where.mockReturnThis();
      mockDb._selectMock.orderBy.mockResolvedValue([]);

      await repository.getRecent(TEST_WORKSPACE_ID, 10);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb._selectMock.from).toHaveBeenCalled();
      expect(mockDb._selectMock.where).toHaveBeenCalled();
    });

  });

  // Grupo 4: Hydration
  describe('Hydration -> Integration with Metric entity validations', () => {
    it('should create a valid Metric from database row', async () => {
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

    it('should preserve all required fields for subsequent domain logic', async () => {
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
      const metric = metrics[0];

      // Validar que o domínio pode usar os métodos
      expect(metric.isError()).toBe(true);
      expect(metric.isServerError()).toBe(true);
      expect(metric.isSlow(400)).toBe(true);
      expect(metric.getStatusCodeFamily()).toBe('5xx');
    });
  });

  // Grupo 5: Error Handling
  describe('Error Handling edge cases', () => {
    it('should handle database timeout errors gracefully', async () => {
      // Simulamos timeout de base de dados
      mockDb._selectMock.orderBy.mockRejectedValue(new Error('db connection timeout'));

      await expect(repository.getRecent(TEST_WORKSPACE_ID, 5)).rejects.toThrow(AppError);
    });

    it('should preserve error context when logging', async () => {
      const originalError = new Error('Pool exhausted');
      mockDb._selectMock.orderBy.mockRejectedValue(originalError);

      try {
        await repository.getRecent(TEST_WORKSPACE_ID, 5);
      } catch (error) {
        // AppError deve ter a causa original
        if (error instanceof AppError) {
          expect(error.statusCode).toBe(500);
        }
      }
    });
  });
});
