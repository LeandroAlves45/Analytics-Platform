/**
 * Testes unitários do HttpSender.
 *
 * O fetch é mockado globalmente para controlar respostas sem HTTP real.
 * Cada teste define o comportamento do fetch para o seu cenário específico.
 */

import { HttpSender } from '../../src/HttpSender';
import {
  TEST_SERVER_URL,
  TEST_API_KEY,
  makeMetricPayload,
  makeHttpSenderConfig,
} from '../fixtures/metrics';

// Helper; cria Response mock com o status indicado.
const mockResponse = (status: number): Response => ({ status }) as Response;

describe('HttpSender', () => {
  // Guarda a referência original do fetch antes de cada mock.
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    // Restaura o fetch original após cada teste para não afetar outros testes.
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // Grupo 1: casos de sucesso.
  describe('send -> success', () => {
    it('should returns accepted:0 and sucess:true when metrics is empty', async () => {
      const sender = new HttpSender(makeHttpSenderConfig());

      // Não mocamos o fetch potque não deve ser chamado com array vazio.
      const result = await sender.send([]);

      expect(result).toEqual({ success: true, accepted: 0 });
    });

    it('should returns accepted:1 when the server responds with 202', async () => {
      // Mockamos fetch para retornar 202 imediatamente.
      global.fetch = jest.fn().mockResolvedValue(mockResponse(202));

      const sender = new HttpSender(makeHttpSenderConfig());

      const result = await sender.send([makeMetricPayload()]);

      expect(result.success).toBe(true);
      expect(result.accepted).toBe(1);
    });

    it('should returns accepted:3 when we send 3 metrics and all received 202', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(202));

      const sender = new HttpSender(makeHttpSenderConfig());

      const metrics = [makeMetricPayload(), makeMetricPayload(), makeMetricPayload()];
      const result = await sender.send(metrics);

      expect(result.success).toBe(true);
      expect(result.accepted).toBe(3);
      // Confirma que fetch foi chamado uma vez para cada métrica.
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should send Authorization header with the correct API key', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(202));

      const sender = new HttpSender(makeHttpSenderConfig());

      await sender.send([makeMetricPayload()]);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(TEST_SERVER_URL),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${TEST_API_KEY}`,
          }),
        })
      );
    });

    it('should remove trailing slash from server URL before building the endpoint URL', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(202));

      const sender = new HttpSender(makeHttpSenderConfig({ serverUrl: TEST_SERVER_URL + '/' }));

      await sender.send([makeMetricPayload()]);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(TEST_SERVER_URL),
        expect.anything()
      );
    });
  });

  // Grupo 2: erros não recupereáveis (sem retry).
  describe('send -> non-retryable errors', () => {
    it('should returns success:false immediately when the server responds with 422', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(422));

      const sender = new HttpSender(makeHttpSenderConfig());

      const result = await sender.send([makeMetricPayload()]);

      expect(result.success).toBe(false);
      expect(result.accepted).toBe(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should returns success:false immediately when the server responds with 409', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(409));

      const sender = new HttpSender(makeHttpSenderConfig());

      const result = await sender.send([makeMetricPayload()]);

      expect(result.success).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return success:false immediately for other 4xx errors like 401', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(401));

      const sender = new HttpSender(makeHttpSenderConfig());

      const result = await sender.send([makeMetricPayload()]);

      expect(result.success).toBe(false);
      expect(result.accepted).toBe(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // Grupo 4: validação do payload HTTP enviado.
  describe('send -> request payload', () => {
    it('should serialize the metric as JSON in the request body', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(202));

      const sender = new HttpSender(makeHttpSenderConfig());
      const metric = makeMetricPayload();

      await sender.send([metric]);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ body: JSON.stringify(metric) })
      );
    });

    it('should call fetch with the exact /api/metrics path', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(202));

      const sender = new HttpSender(makeHttpSenderConfig());

      await sender.send([makeMetricPayload()]);

      expect(global.fetch).toHaveBeenCalledWith(
        `${TEST_SERVER_URL}/api/metrics`,
        expect.anything()
      );
    });
  });

  // Grupo 3: erros recupereáveis (com retry).
  describe('send -> retryable errors with backoff', () => {
    beforeEach(() => {
      // Substitui sleep por uma função que não espera tempo real.
      jest
        .spyOn(HttpSender.prototype as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
        .mockResolvedValue(undefined);
    });

    it('should retry after 500 and return success when give 202 after the second attempt', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(mockResponse(500))
        .mockResolvedValueOnce(mockResponse(202));

      const sender = new HttpSender(makeHttpSenderConfig({ maxRetries: 3 }));

      const result = await sender.send([makeMetricPayload()]);

      expect(result.success).toBe(true);
      expect(result.accepted).toBe(1);
      // fetch deve ter sido chamado duas vezes.
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should give up after maxRetries and return success:false', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(500));

      const sender = new HttpSender(makeHttpSenderConfig({ maxRetries: 3 }));

      const result = await sender.send([makeMetricPayload()]);

      expect(result.success).toBe(false);
      // maxRetries: 3 significa 3 tentativas no total
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result.error).toContain('Failed after 3 attempts');
    });

    it('should returns success:false when fetch throws connection error', async () => {
      // fetch rejeita a promise -> simula falha de rede.
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const sender = new HttpSender(makeHttpSenderConfig({ maxRetries: 2 }));

      const result = await sender.send([makeMetricPayload()]);

      expect(result.success).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
