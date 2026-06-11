/**
 * Testes unitários do use case.
 * Usamos mocks para todas as dependências sem base de dados, sem Redis, sem filas.
 * O objectivo é testar APENAS a lógica de orquestração do use case.
 */

import { RecordMetricUseCase } from '@application/usecases/metrics/RecordMetricUseCase';
import { MetricsRepository, AggregationQueueService } from '@application/contracts/repositories';
import { AppError, ValidationError } from '@shared/errors';
import { BASE_METRIC_INPUT } from '../../../fixtures/metrics';

const validInput = { ...BASE_METRIC_INPUT };

describe('RecordMetricUseCase', () => {
  let useCase: RecordMetricUseCase;
  let metricsRepository: jest.Mocked<MetricsRepository>;
  let aggregationQueue: jest.Mocked<AggregationQueueService>;

  beforeEach(() => {
    metricsRepository = {
      save: jest.fn().mockResolvedValue('saved'),
      existsByRequestId: jest.fn().mockResolvedValue(false),
      getRecent: jest.fn().mockResolvedValue([]),
      getActiveEndpoints: jest.fn().mockResolvedValue([]),
    };

    aggregationQueue = {
      scheduleAggregation: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new RecordMetricUseCase(metricsRepository, aggregationQueue);
  });

  // Grupo 1: fluxo principal (happy path)
  describe('execute -> happy path', () => {
    it('should save metric when input is valid', async () => {
      await useCase.execute(validInput);

      expect(metricsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: validInput.workspaceId,
          endpoint: validInput.endpoint,
        })
      );
    });

    it('should return metricId and recordedAt on success', async () => {
      const result = await useCase.execute(validInput);

      expect(result.metricId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(result.recordedAt).toBeInstanceOf(Date);
    });

    it('should schedule aggregation after saving metric', async () => {
      await useCase.execute(validInput);

      expect(aggregationQueue.scheduleAggregation).toHaveBeenCalledWith({
        workspaceId: validInput.workspaceId,
        endpoint: validInput.endpoint,
        method: validInput.method,
        intervalMinutes: 5,
      });
    });

    it('should pass optional fields through to the saved metric', async () => {
      const inputWithOptionalFields = {
        ...validInput,
        payloadSizeBytes: 1024,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      await useCase.execute(inputWithOptionalFields);

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
    it('should throw 409 when repository save returns duplicate', async () => {
      metricsRepository.save.mockResolvedValue('duplicate');

      await expect(useCase.execute(validInput)).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
      });
    });

    it('should not schedule aggregation when save returns duplicate', async () => {
      metricsRepository.save.mockResolvedValue('duplicate');

      await expect(useCase.execute(validInput)).rejects.toThrow(AppError);

      expect(aggregationQueue.scheduleAggregation).not.toHaveBeenCalled();
    });
  });

  // Grupo 3: validação de domínio
  describe('execute -> domain validation', () => {
    it('should throw ValidationError when latencyMs is negative', async () => {
      await expect(useCase.execute({ ...validInput, latencyMs: -100 })).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when statusCode is invalid', async () => {
      await expect(useCase.execute({ ...validInput, statusCode: 600 })).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when endpoint has no leading slash', async () => {
      await expect(useCase.execute({ ...validInput, endpoint: 'api/users' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should not save metric when validation fails', async () => {
      await expect(useCase.execute({ ...validInput, latencyMs: -1 })).rejects.toThrow(
        ValidationError
      );

      expect(metricsRepository.save).not.toHaveBeenCalled();
    });
  });

  // Grupo 4: resiliência a falhas parciais
  describe('execute -> partial failure', () => {
    it('should succeed even when aggregation queue fails', async () => {
      aggregationQueue.scheduleAggregation.mockRejectedValue(new Error('Queue connection lost'));

      const result = await useCase.execute(validInput);

      expect(result.metricId).toBeDefined();
    });

    it('should throw AppError when repository save fails', async () => {
      metricsRepository.save.mockRejectedValue(new Error('Database connection lost'));

      await expect(useCase.execute(validInput)).rejects.toThrow(AppError);
    });

    it('should throw AppError with statusCode 500 when repository save fails', async () => {
      metricsRepository.save.mockRejectedValue(new Error('Database connection lost'));

      await expect(useCase.execute(validInput)).rejects.toMatchObject({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
      });
    });

    it('should rethrow AppError from repository without wrapping', async () => {
      const repoError = new AppError('Failed to save metric', 'INTERNAL_SERVER_ERROR', 500);

      metricsRepository.save.mockRejectedValue(repoError);

      await expect(useCase.execute(validInput)).rejects.toThrow(repoError);
    });
  });
});
