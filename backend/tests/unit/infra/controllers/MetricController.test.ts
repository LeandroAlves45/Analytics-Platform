/**
 * Testes unitários para o MetricsController.
 * Testamos o controller isolado: sem servidor HTTP real, sem base de dados,
 * Uso de mocks di Request, Response e NextFunction do Express.
 */

import { Request, Response, NextFunction } from 'express';
import { MetricsController, AuthenticatedRequest } from '@infra/controllers/MetricsController';
import { RecordMetricUseCase } from '@application/usecases/metrics/RecordMetricUseCase';
import { ValidationError, AppError } from '@shared/errors';
import { isValidUuid } from '@shared/validation/uuid';
import {
  TEST_REQUEST_ID,
  TEST_WORKSPACE_ID,
  TEST_API_KEY_ID,
} from '../../../../tests/fixtures/metrics';

// Criar o mock do Express Request com os campos minimos necessários.
// Tipado como AuthenticatedRequest para permitir simular workspaceId/apiKeyId
// injectados pelo (futuro) AuthMiddleware.
const createMockRequest = (
  overrides: Partial<AuthenticatedRequest> = {}
): Partial<AuthenticatedRequest> => ({
  body: {
    endpoint: '/api/users',
    method: 'GET',
    latencyMs: 150,
    statusCode: 200,
    requestId: TEST_REQUEST_ID,
  },
  headers: { 'user-agent': 'TestAgent/1.0' },
  ip: '127.0.0.1',
  ...overrides,
});

/**
 * Cria um mock do Express Response com os métodos que o controller usa.
 * status() devolve o próprio objeto para permitir encadeamento de métodos.
 */
const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock do use case. Controlamos o comportamento em cada teste.
 */
const createMockUseCase = (): jest.Mocked<Pick<RecordMetricUseCase, 'execute'>> => ({
  execute: jest.fn().mockResolvedValue({
    metricId: 'metric-123',
    recordedAt: new Date('2025-01-15T10:00:00.000Z'),
  }),
});

describe('MetricsController', () => {
  let controller: MetricsController;
  let mockUseCase: jest.Mocked<Pick<RecordMetricUseCase, 'execute'>>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockUseCase = createMockUseCase();
    // Cast necessário porque usamos Pick<> para mockar apenas o método execute.
    controller = new MetricsController(mockUseCase as unknown as RecordMetricUseCase);
    mockNext = jest.fn();
  });

  // Grupo 1: happy path.
  describe('ingest -> valid request', () => {
    it('should respond 202 when use case succeeds', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metricId: 'metric-123',
          }),
        })
      );
    });

    it('should call use case with correct data', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(mockUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/api/users',
          method: 'GET',
          latencyMs: 150,
          statusCode: 200,
          requestId: TEST_REQUEST_ID,
        })
      );
    });

    it('should normalise method to uppercase', async () => {
      // O schema Zod faz transform para maiúsculas.
      const req = createMockRequest({
        body: {
          endpoint: '/api/users',
          method: 'get',
          latencyMs: 150,
          statusCode: 200,
          requestId: TEST_REQUEST_ID,
        },
      });
      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(mockUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    test('should use user-agent from headers when not in body', async () => {
      const req = createMockRequest({
        headers: { 'user-agent': 'SDK/1.0' },
      });
      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(mockUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'SDK/1.0',
        })
      );
    });
  });

  // Grupo 2: validação Zod.
  describe('ingest -> Zod validation failures', () => {
    it('should respond 422 when endpoint is missing', async () => {
      const req = createMockRequest({
        body: {
          method: 'GET',
          latencyMs: 150,
          statusCode: 200,
          requestId: TEST_REQUEST_ID,
        },
      });
      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should respond 422 when latencyMs is negative', async () => {
      const req = createMockRequest({
        body: {
          endpoint: '/api/users',
          method: 'GET',
          latencyMs: -100,
          statusCode: 200,
          requestId: TEST_REQUEST_ID,
        },
      });

      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    it('should respond 422 when requestId is missing', async () => {
      const req = createMockRequest({
        body: {
          endpoint: '/api/users',
          method: 'GET',
          latencyMs: 150,
          statusCode: 200,
        },
      });

      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    it('should include field details in 422 response', async () => {
      const req = createMockRequest({ body: {} });
      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
      const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.error.details).toBeInstanceOf(Array);
      expect(jsonCall.error.details.length).toBeGreaterThan(0);
    });

    it('should not call use case when Zod validation fails', async () => {
      const req = createMockRequest({ body: {} });
      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(mockUseCase.execute).not.toHaveBeenCalled();
    });
  });

  // Grupo 3: erros do use case delegados ao next().
  describe('ingest -> use case errors', () => {
    it('should call next() with ValidationError from use case', async () => {
      const validationError = new ValidationError('Invalid metric data');
      mockUseCase.execute.mockRejectedValue(validationError);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(validationError);
    });

    it('should call next() with AppError 409 on duplicate requestId', async () => {
      const conflictError = new AppError(
        'Metric with this requestId already exists',
        'CONFLICT',
        409
      );
      mockUseCase.execute.mockRejectedValue(conflictError);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(conflictError);
    });

    it('should call next() with unexpected errors', async () => {
      const unexpectedError = new Error('DB connection lost');
      mockUseCase.execute.mockRejectedValue(unexpectedError);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.ingest(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(unexpectedError);
    });
  });

  // Grupo 4: derivação de workspaceId/apiKeyId (contexto de tenant).
  // O cliente nunca indica o seu próprio workspace no body — vem sempre
  // do contexto de autenticação (req.workspaceId/req.apiKeyId), injectado
  // pelo AuthMiddleware (sprint 6).
  describe('ingest -> tenant context (workspaceId/apiKeyId)', () => {
    it('should call use case with workspaceId/apiKeyId from authenticated request', async () => {
      const req = createMockRequest({
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
      });
      const res = createMockResponse();

      await controller.ingest(req as AuthenticatedRequest, res as Response, mockNext);

      expect(mockUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: TEST_WORKSPACE_ID,
          apiKeyId: TEST_API_KEY_ID,
        })
      );
    });

    it('should fall back to a valid UUID when request has no authenticated workspaceId/apiKeyId', async () => {
      // Sem AuthMiddleware, req.workspaceId/req.apiKeyId chegam undefined.
      // O fallback do controller TEM de ser um UUID válido — a entidade Metric
      // rejeita formatos não-UUID (ex: 'dev-workspace-id'), o que faria o
      // endpoint devolver sempre 422 enquanto o AuthMiddleware não existir.
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.ingest(req as AuthenticatedRequest, res as Response, mockNext);

      const [callArgs] = mockUseCase.execute.mock.calls[0] as [
        { workspaceId: string; apiKeyId: string },
      ];
      expect(isValidUuid(callArgs.workspaceId)).toBe(true);
      expect(isValidUuid(callArgs.apiKeyId)).toBe(true);
    });
  });
});
