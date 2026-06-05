/**
 * Testes unitários do MetricsClient.
 *
 * O MetricsClient liga MetricsBuffer ao HttpSender.
 * Testamos esse comportamento de orquestração com mocks das duas dependências.
 *
 * Não testamos o comportamento interno do buffer nem do sender aqui —
 * isso está nos seus próprios ficheiros de teste.
 */

import { MetricsClient } from '../../src/MetricsClient';
import { MetricsBuffer } from '../../src/MetricsBuffer';
import { HttpSender } from '../../src/HttpSender';
import type { MetricPayload } from '../../src/HttpSender';
import {
  TEST_SERVER_URL,
  TEST_API_KEY,
  createUniqueRequestId,
  makeMetricPayload,
} from '../fixtures/metrics';

// Mocamos os módulos completos para substituir as implementações reais.
// Jest intercepta os imports e usa os mocks em vez das classes reais.
jest.mock('../../src/MetricsBuffer');
jest.mock('../../src/HttpSender');

// Tipos auxiliares para os mocks.
const MockedMetricsBuffer = MetricsBuffer as jest.MockedClass<typeof MetricsBuffer>;
const MockedHttpSender = HttpSender as jest.MockedClass<typeof HttpSender>;

describe('MetricsClient', () => {
  // Instâncias dos mocks.
  let mockBuffer: jest.Mocked<MetricsBuffer>;
  let mockSender: jest.Mocked<HttpSender>;

  beforeEach(() => {
    // Limpa o histórico de chamadas dos mocks.
    jest.clearAllMocks();

    // Configura o mock do buffer com todos os métodos necessários.
    mockBuffer = {
      add: jest.fn(),
      drain: jest.fn().mockReturnValue([]),
      flush: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      size: 0,
    } as unknown as jest.Mocked<MetricsBuffer>;

    // Configura o mock do sender.
    mockSender = {
      send: jest.fn().mockResolvedValue({ success: true, accepted: 0 }),
    } as unknown as jest.Mocked<HttpSender>;

    // Faz com que os construtores devolvam instâncias dos mocks.
    MockedMetricsBuffer.mockImplementation(() => mockBuffer);
    MockedHttpSender.mockImplementation(() => mockSender);
  });

  // Grupo 1: record()
  describe('record', () => {
    it('should add metric to buffer with the correct payload', () => {
      const client = new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      client.record({
        endpoint: '/api/users',
        method: 'GET',
        latencyMs: 150,
        statusCode: 200,
      });

      expect(mockBuffer.add).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/api/users',
          method: 'GET',
          latencyMs: 150,
          statusCode: 200,
        })
      );
    });

    it('should generate a requestId if not provided', () => {
      const client = new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      client.record({
        endpoint: '/api/users',
        method: 'GET',
        latencyMs: 150,
        statusCode: 200,
      });

      const addCall = mockBuffer.add.mock.calls[0][0] as MetricPayload;
      expect(typeof addCall.requestId).toBe('string');
      expect(addCall.requestId.length).toBeGreaterThan(0);
    });

    it('should use the provided requestId when provided', () => {
      const client = new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      const customRequestId = createUniqueRequestId();
      client.record({
        endpoint: '/api/users',
        method: 'GET',
        latencyMs: 150,
        statusCode: 200,
        requestId: customRequestId,
      });

      const addCall = mockBuffer.add.mock.calls[0][0] as MetricPayload;
      expect(addCall.requestId).toBe(customRequestId);
    });

    it('should forward optional fields to buffer.add()', () => {
      const client = new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      client.record({
        endpoint: '/api/users',
        method: 'POST',
        latencyMs: 200,
        statusCode: 201,
        payloadSizeBytes: 512,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      });

      expect(mockBuffer.add).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadSizeBytes: 512,
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        })
      );
    });

    it('should log console.warn when record() is called after destroy()', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const client = new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      await client.destroy();
      client.record({ endpoint: '/api/users', method: 'GET', latencyMs: 100, statusCode: 200 });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[analytics-saas-sdk]')
      );
      warnSpy.mockRestore();
    });

    it('should not call buffer.add() after destroy() is called', async () => {
      const client = new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      await client.destroy();

      // Limpa o histórico para contar apenas chamadas após destroy()
      mockBuffer.add.mockClear();

      client.record({
        endpoint: '/api/users',
        method: 'GET',
        latencyMs: 150,
        statusCode: 200,
      });

      expect(mockBuffer.add).not.toHaveBeenCalled();
    });
  });

  // Grupo 2: flush handler
  describe('handleFlush', () => {
    it('should call sender.send with the metrics when buffer emits flush', async () => {
      new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      // Capturar o listener registrado por MetricsClient no construtor.
      const onCall = mockBuffer.on.mock.calls.find(([event]) => event === 'flush');
      const flushHandler = onCall?.[1] as (metrics: MetricPayload[]) => void;

      const metrics = [makeMetricPayload()];
      flushHandler(metrics);

      // Permitir que a handleFlush assíncrona se complete.
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSender.send).toHaveBeenCalledWith(metrics);
    });

    it('should log an error but not throw when sender.send fails', async () => {
      mockSender.send.mockResolvedValue({ success: false, accepted: 0, error: 'Server error' });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      const onCall = mockBuffer.on.mock.calls.find(([event]) => event === 'flush');
      const flushHandler = onCall?.[1] as (metrics: MetricPayload[]) => void;

      flushHandler([makeMetricPayload()]);

      await Promise.resolve();
      await Promise.resolve();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // Grupo 3: destroy()
  describe('destroy', () => {
    it('should call buffer.drain() and buffer.destroy()', async () => {
      const client = new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      await client.destroy();

      expect(mockBuffer.drain).toHaveBeenCalled();
      expect(mockBuffer.destroy).toHaveBeenCalled();
    });

    it('should call sender.send with pending metrics returned by drain()', async () => {
      const pendingMetrics = [makeMetricPayload()];
      mockBuffer.drain.mockReturnValue(pendingMetrics);

      const client = new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      await client.destroy();

      expect(mockSender.send).toHaveBeenCalledWith(pendingMetrics);
    });

    it('should not call sender.send when there are no pending metrics', async () => {
      mockBuffer.drain.mockReturnValue([]);

      const client = new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      await client.destroy();

      expect(mockSender.send).not.toHaveBeenCalled();
    });

    it('should be idempotent - calling destroy twice does not send metrics twice', async () => {
      const pendingMetrics = [makeMetricPayload()];
      mockBuffer.drain.mockReturnValue(pendingMetrics);

      const client = new MetricsClient({
        serverUrl: TEST_SERVER_URL,
        apiKey: TEST_API_KEY,
      });

      await client.destroy();
      await client.destroy();

      expect(mockSender.send).toHaveBeenCalledTimes(1);
    });
  });
});
