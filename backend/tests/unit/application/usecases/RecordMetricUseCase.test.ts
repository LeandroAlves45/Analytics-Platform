// RecordMetricUseCase.test.ts
//
// Testes unitários do use case.
// Usamos mocks para todas as dependências — sem base de dados, sem Redis, sem filas.
// O objectivo é testar APENAS a lógica de orquestração do use case.

import { RecordMetricUseCase } from '@application/usecases/metrics/RecordMetricUseCase';
import {
  MetricsRepository,
  MetricsCacheService,
  AggregationQueueService,
} from '@application/contracts/repositories';
import { AppError, ValidationError } from '@shared/errors';
import { BASE_METRIC_INPUT } from '../../../fixtures/metrics';

// Fixture reutilizável de fixtures para testes.
const validInput = { ...BASE_METRIC_INPUT };

describe('RecordMetricUseCase', () => {
  // Declaração de mocks fora para reutilização em todos os testes.
  let useCase: RecordMetricUseCase;
  let metricsRepository: jest.Mocked<MetricsRepository>;
  let cacheService: jest.Mocked<MetricsCacheService>;
  let aggregationQueue: jest.Mocked<AggregationQueueService>;

  beforeEach(() => {
    // Criámos mocks fresh antes de cada teste para evitar estado partilhado.
    metricsRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      existsByRequestId: jest.fn().mockResolvedValue(false),
      getRecent: jest.fn().mockResolvedValue([]),
    };

    cacheService = {
      invalidate: jest.fn().mockResolvedValue(undefined),
    };

    aggregationQueue = {
      scheduleAggregation: jest.fn().mockResolvedValue(undefined),
    };

    // Instanciámos use case com os mocks injectados.
    useCase = new RecordMetricUseCase(metricsRepository, cacheService, aggregationQueue);
  });

  // Grupo 1: fluxo principal (happy path)
  describe('execute -> happy path', () => {
    it('should save metric when input is valid', async () => {
      // Arrange: input válido.
      await useCase.execute(validInput);

      // Assert: verificamos que o repositório foi chamado uma vez com uma Metric válida.
      expect(metricsRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should return metricId and recordedAt on success', async () => {
      // Arrange: input válido.
      const result = await useCase.execute(validInput);

      // Assert: o metricID deve ser um UUID válido.
      expect(result.metricId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(result.recordedAt).toBeInstanceOf(Date);
    });

    it('should invalidate cache after saving metric', async () => {
      // Arrange: input válido.
      await useCase.execute(validInput);

      // Assert: verificamos que o cache foi invalidado.
      expect(cacheService.invalidate).toHaveBeenCalledWith(validInput.workspaceId);
    });

    it('should schedule aggregation after saving metric', async () => {
      // Arrange: input válido.
      await useCase.execute(validInput);

      // Assert: verificamos que a agregação foi agendada.
      expect(aggregationQueue.scheduleAggregation).toHaveBeenCalledWith(
        validInput.workspaceId,
        validInput.endpoint
      );
    });

    it('should check for duplicate requestId before saving metric', async () => {
      // Arrange: input válido.
      await useCase.execute(validInput);

      // Assert: verificação de idempotência deve ocorrer antes do save.
      expect(metricsRepository.existsByRequestId).toHaveBeenCalledWith(validInput.requestId);
    });

    it('should pass optional fields through to the saved metric', async () => {
      // Arrange: input com todos os campos opcionais preenchidos.
      const inputWithOptionalFields = {
        ...validInput,
        payloadSizeBytes: 1024,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      // Act: executamos o useCase com o input com campos opcionais.
      await useCase.execute(inputWithOptionalFields);

      // Assert: verificamos que os campos opcionais foram passados para a métrica salva.
      expect(metricsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadSizeBytes: 1024,
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        })
      );
    });
  });

  // Grupo 2: idempotência
  describe('execute -> duplicate requestId', () => {
    it('should throw AppError with 409 when requestId already exists', async () => {
      // Arrange: simulamos que este requestId já foi processado.
      metricsRepository.existsByRequestId.mockResolvedValue(true);

      await expect(useCase.execute(validInput)).rejects.toThrow(AppError);
    });

    it('should not save metric when requestId already exists', async () => {
      // Arrange: simulamos que este requestId já foi processado.
      metricsRepository.existsByRequestId.mockResolvedValue(true);

      try {
        await useCase.execute(validInput);
      } catch (error) {
        // Ignoramos o erro -> só queremos verificar que não foi salvo.
      }

      // Assert: verificamos que o repositório não foi chamado.
      expect(metricsRepository.save).not.toHaveBeenCalled();
    });

    it('should throw AppError with statusCode 409', async () => {
      // Arrange: simulamos requestId já existente.
      metricsRepository.existsByRequestId.mockResolvedValue(true);

      try {
        await useCase.execute(validInput);
      } catch (error) {
        expect((error as AppError).statusCode).toBe(409);
      }
    });

    it('should throw AppError with CONFLICT code', async () => {
      // Arrange: simulamos requestId já existente.
      metricsRepository.existsByRequestId.mockResolvedValue(true);

      try {
        await useCase.execute(validInput);
      } catch (error) {
        expect((error as AppError).code).toBe('CONFLICT');
      }
    });
  });

  // Grupo 3: validação de domínio
  describe('execute -> domain validation', () => {
    it('should throw ValidationError when latencyMs is negative', async () => {
      // Arrange: input com latency negativo.
      await expect(useCase.execute({ ...validInput, latencyMs: -100 })).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when statusCode is invalid', async () => {
      // Arrange: input com statusCode inválido.
      await expect(useCase.execute({ ...validInput, statusCode: 600 })).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when endpoint has no leading slash', async () => {
      // Arrange: input com endpoint sem leading slash.
      await expect(useCase.execute({ ...validInput, endpoint: 'api/users' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should not save metric when domain validation fails', async () => {
      // Arrange: input com validações de domínio inválidas.
      try {
        await useCase.execute({ ...validInput, latencyMs: -1 });
      } catch {
        // ignoramos o erro
      }

      // Assert: verificamos que o repositório não foi chamado.
      expect(metricsRepository.save).not.toHaveBeenCalled();
    });
  });

  // Grupo 4: resiliência a falhas parciais
  describe('execute -> partial failure', () => {
    it('should succeed even when cache invalidation fails', async () => {
      // Arrange: simulamos falha no Redis.
      cacheService.invalidate.mockRejectedValue(new Error('Redis connection lost'));

      // O useCase deve continuar e devolver sucesso -> cache é best-effort.
      const result = await useCase.execute(validInput);

      expect(result.metricId).toBeDefined();
      expect(metricsRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should succeed even when aggregation queue fails', async () => {
      // Arrange: simulamos falha no BullMQ.
      aggregationQueue.scheduleAggregation.mockRejectedValue(new Error('Queue connection lost'));

      // O useCase deve continuar -> aggregation tem retry automático.
      const result = await useCase.execute(validInput);

      expect(result.metricId).toBeDefined();
    });

    it('should throw AppError when repository save fails', async () => {
      // Arrange: Falha na base de dados é crítica, não podemos perder a métrica.
      metricsRepository.save.mockRejectedValue(new Error('Database connection lost'));

      await expect(useCase.execute(validInput)).rejects.toThrow(AppError);
    });

    it('should throw AppError with statusCode 500 when repository save fails', async () => {
      metricsRepository.save.mockRejectedValue(new Error('Database connection lost'));

      try {
        await useCase.execute(validInput);
      } catch (error) {
        expect((error as AppError).statusCode).toBe(500);
      }
    });

    it('should throw AppError with INTERNAL_SERVER_ERROR code when repository save fails', async () => {
      metricsRepository.save.mockRejectedValue(new Error('Database connection lost'));

      try {
        await useCase.execute(validInput);
      } catch (error) {
        expect((error as AppError).code).toBe('INTERNAL_SERVER_ERROR');
      }
    });
  });
});
