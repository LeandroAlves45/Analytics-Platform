// Metric.test.ts
//
// Testes unitários para a entidade Metric.

import { Metric } from '@domain/entities/Metric';
import { ValidationError } from '@shared/errors';
import { BASE_METRIC_INPUT } from '../../../fixtures/metrics';

// Fixture reutilizável de fixtures para testes.
const validInput = { ...BASE_METRIC_INPUT };

// Testes
describe('Metric Entity', () => {
  // Grupo 1: criaçção bem sucedida
  describe('constructor - valid input', () => {
    it('should create a metric with all required fields', () => {
      const metric = new Metric(validInput);

      // Verificamos se cada campo foi atribuído corretamente
      expect(metric.workspaceId).toBe(validInput.workspaceId);
      expect(metric.apiKeyId).toBe(validInput.apiKeyId);
      expect(metric.endpoint).toBe(validInput.endpoint);
      expect(metric.method).toBe(validInput.method);
      expect(metric.latencyMs).toBe(validInput.latencyMs);
      expect(metric.statusCode).toBe(validInput.statusCode);
      expect(metric.requestId).toBe(validInput.requestId);
    });

    it('should generate a unique id on creation', () => {
      const metric1 = new Metric(validInput);
      const metric2 = new Metric({
        ...validInput,
        requestId: 'another-req-id',
      });

      // Dois objetos criados devem ter IDs diferentes
      expect(metric1.id).not.toBe(metric2.id);
      expect(metric1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should set timestamp to current date on creation', () => {
      const before = Date.now();
      const metric = new Metric(validInput);
      const after = Date.now();

      // O timestamp deve estar entre o momento antes e depois da criação
      expect(metric.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(metric.timestamp.getTime()).toBeLessThanOrEqual(after);
    });

    it('should set optional fields to null when not provided', () => {
      const metric = new Metric(validInput);

      expect(metric.payloadSizeBytes).toBeNull();
      expect(metric.userAgent).toBeNull();
      expect(metric.ipAddress).toBeNull();
    });

    it('should store optional fields when provided', () => {
      const metric = new Metric({
        ...validInput,
        payloadSizeBytes: 1024,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      });

      expect(metric.payloadSizeBytes).toBe(1024);
      expect(metric.userAgent).toBe('Mozilla/5.0');
      expect(metric.ipAddress).toBe('192.168.1.1');
    });
  });

  // Grupo 2: validações de campos obrigatórios
  describe('constructor - validation errors', () => {
    it('should throw ValidationError when workspaceId is empty', () => {
      expect(() => new Metric({ ...validInput, workspaceId: '' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when apiKeyId is empty', () => {
      expect(() => new Metric({ ...validInput, apiKeyId: '' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when endpoint does not start with /', () => {
      expect(() => new Metric({ ...validInput, endpoint: 'api/users' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when method is invalid', () => {
      expect(() => new Metric({ ...validInput, method: 'INVALID' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when latencyMs is zero or negative', () => {
      expect(() => new Metric({ ...validInput, latencyMs: -100 })).toThrow(ValidationError);
      expect(() => new Metric({ ...validInput, latencyMs: 0 })).toThrow(ValidationError);
    });

    it('should throw ValidationError when statusCode is below 100 or above 599', () => {
      expect(() => new Metric({ ...validInput, statusCode: 99 })).toThrow(ValidationError);
      expect(() => new Metric({ ...validInput, statusCode: 600 })).toThrow(ValidationError);
    });

    it('should throw ValidationError when requestId is empty', () => {
      expect(() => new Metric({ ...validInput, requestId: '' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when payloadSizeBytes is negative', () => {
      expect(() => new Metric({ ...validInput, payloadSizeBytes: -1 })).toThrow(ValidationError);
    });

    it('should throw ValidationError when payloadSizeBytes is zero', () => {
      expect(() => new Metric({ ...validInput, payloadSizeBytes: 0 })).toThrow(ValidationError);
    });

    it('should include field details in ValidationError message', () => {
      try {
        new Metric({ ...validInput, latencyMs: -100 });
        fail('Expected ValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        // Verificar que o erro contém detalhes utéis para o cliente da API
        expect(validationError.message).toContain('Invalid metric data');
      }
    });
  });

  // Grupo 3: métodos de domínio
  describe('isError()', () => {
    it('should return false for 2xx status codes', () => {
      const metric = new Metric({ ...validInput, statusCode: 200 });
      expect(metric.isError()).toBe(false);
    });

    it('should return false for 3xx status codes', () => {
      const metric = new Metric({ ...validInput, statusCode: 301 });
      expect(metric.isError()).toBe(false);
    });

    it('should return true for 4xx status codes', () => {
      const metric = new Metric({ ...validInput, statusCode: 404 });
      expect(metric.isError()).toBe(true);
    });

    it('should return true for 5xx status codes', () => {
      const metric = new Metric({ ...validInput, statusCode: 500 });
      expect(metric.isError()).toBe(true);
    });
  });

  describe('isSlow()', () => {
    it('should return false when latency below threshold', () => {
      const metric = new Metric({ ...validInput, latencyMs: 100 });
      expect(metric.isSlow(500)).toBe(false);
    });

    it('should return false when latency equals threshold', () => {
      const metric = new Metric({ ...validInput, latencyMs: 500 });
      expect(metric.isSlow(500)).toBe(false);
    });

    it('should return true when latency exceeds threshold', () => {
      const metric = new Metric({ ...validInput, latencyMs: 501 });
      expect(metric.isSlow(500)).toBe(true);
    });
  });

  describe('isServerError()', () => {
    it('should return false for 4xx', () => {
      const metric = new Metric({ ...validInput, statusCode: 400 });
      expect(metric.isServerError()).toBe(false);
    });

    it('should return true for 5xx', () => {
      const metric = new Metric({ ...validInput, statusCode: 503 });
      expect(metric.isServerError()).toBe(true);
    });
  });

  describe('getStatusCodeFamily()', () => {
    it('should return 2xx for 200', () => {
      const metric = new Metric({ ...validInput, statusCode: 200 });
      expect(metric.getStatusCodeFamily()).toBe('2xx');
    });

    it('should return 3xx for 301', () => {
      const metric = new Metric({ ...validInput, statusCode: 301 });
      expect(metric.getStatusCodeFamily()).toBe('3xx');
    });

    it('should return 4xx for 404', () => {
      const metric = new Metric({ ...validInput, statusCode: 404 });
      expect(metric.getStatusCodeFamily()).toBe('4xx');
    });

    it('should return 5xx for 500', () => {
      const metric = new Metric({ ...validInput, statusCode: 500 });
      expect(metric.getStatusCodeFamily()).toBe('5xx');
    });
  });
});
