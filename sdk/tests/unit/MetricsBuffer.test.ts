/**
 * Testes unitários do MetricsBuffer.
 *
 * Usamos jest.useFakeTimers() para controlar o setInterval sem esperar
 * tempo real. jest.advanceTimersByTime(ms) avança o relógio virtualmente.
 */

import { MetricsBuffer } from '../../src/MetricsBuffer';
import { makeMetricPayload } from '../fixtures/metrics';

describe('MetricsBuffer', () => {
  // Ativa timers falsos antes de cada teste.
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Grupo 1: comportamento básico do buffer.
  describe('add and size', () => {
    it('should start with size 0', () => {
      const buffer = new MetricsBuffer();
      expect(buffer.size).toBe(0);
      buffer.destroy();
    });

    it('should increase size after each add', () => {
      const buffer = new MetricsBuffer({ maxSize: 10 });

      buffer.add(makeMetricPayload());
      expect(buffer.size).toBe(1);

      buffer.add(makeMetricPayload());
      expect(buffer.size).toBe(2);

      buffer.destroy();
    });

    it('should not emit flush when the volume is below maxSize', () => {
      const buffer = new MetricsBuffer({ maxSize: 5 });
      const flushSpy = jest.fn();
      buffer.on('flush', flushSpy);

      // Adiciona 4 métricas.
      for (let i = 0; i < 4; i++) {
        buffer.add(makeMetricPayload());
      }

      expect(flushSpy).not.toHaveBeenCalled();
      buffer.destroy();
    });
  });

  // Grupo 2: flush por volume.
  describe('flush by volume', () => {
    it('should emits flush when the volume is equal to maxSize', () => {
      const buffer = new MetricsBuffer({ maxSize: 3 });
      const flushSpy = jest.fn();
      buffer.on('flush', flushSpy);

      // Adiciona 3 métricas.
      for (let i = 0; i < 3; i++) {
        buffer.add(makeMetricPayload({ endpoint: `/api/users/${i}` }));
      }

      expect(flushSpy).toHaveBeenCalledTimes(1);
      // Confirma que recebeu exatamente 3 métricas.
      expect(flushSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ endpoint: '/api/users/0' }),
          expect.objectContaining({ endpoint: '/api/users/1' }),
          expect.objectContaining({ endpoint: '/api/users/2' }),
        ])
      );
      buffer.destroy();
    });

    it('should reset size to 0 after flush by volume', () => {
      const buffer = new MetricsBuffer({ maxSize: 2 });
      buffer.on('flush', jest.fn());

      // Adiciona 2 métricas.
      for (let i = 0; i < 2; i++) {
        buffer.add(makeMetricPayload());
      }

      // Após flush, o buffer deve estar vazio.
      expect(buffer.size).toBe(0);
      buffer.destroy();
    });

    it('should still accept new metrics after flush by volume', () => {
      const buffer = new MetricsBuffer({ maxSize: 2 });
      const flushSpy = jest.fn();
      buffer.on('flush', flushSpy);

      // Primeiro batch de 2 métricas.
      for (let i = 0; i < 2; i++) {
        buffer.add(makeMetricPayload({ endpoint: `/api/users/${i}` }));
      }

      // Segundo batch com mais duas métricas.
      for (let i = 2; i < 4; i++) {
        buffer.add(makeMetricPayload({ endpoint: `/api/users/${i}` }));
      }

      expect(flushSpy).toHaveBeenCalledTimes(2);
      buffer.destroy();
    });
  });

  // Grupo 3: flush periódico por tempo.
  describe('flush periodical', () => {
    it('should emits flush after time interval configured', () => {
      const buffer = new MetricsBuffer({ flushIntervalMs: 5000 });
      const flushSpy = jest.fn();
      buffer.on('flush', flushSpy);

      buffer.add(makeMetricPayload());

      expect(flushSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5000);

      expect(flushSpy).toHaveBeenCalledTimes(1);
      buffer.destroy();
    });

    it('should emit the correct metrics in the periodic flush event payload', () => {
      const buffer = new MetricsBuffer({ flushIntervalMs: 1000 });
      const flushSpy = jest.fn();
      buffer.on('flush', flushSpy);

      const metric = makeMetricPayload({ endpoint: '/api/periodic-flush' });
      buffer.add(metric);

      jest.advanceTimersByTime(1000);

      expect(flushSpy).toHaveBeenCalledWith([metric]);
      buffer.destroy();
    });

    it('should not emit periodical flush when the buffer is empty', () => {
      const buffer = new MetricsBuffer({ flushIntervalMs: 1000 });
      const flushSpy = jest.fn();
      buffer.on('flush', flushSpy);

      jest.advanceTimersByTime(5000);

      expect(flushSpy).not.toHaveBeenCalled();
      buffer.destroy();
    });
  });

  // Grupo 6: flush() direto (API pública).
  describe('flush() direct call', () => {
    it('should emit the correct metrics and clear the buffer when flush() is called directly', () => {
      const buffer = new MetricsBuffer({ maxSize: 100 });
      const flushSpy = jest.fn();
      buffer.on('flush', flushSpy);

      const metric = makeMetricPayload({ endpoint: '/api/direct-flush' });
      buffer.add(metric);
      buffer.flush();

      expect(flushSpy).toHaveBeenCalledWith([metric]);
      expect(buffer.size).toBe(0);
      buffer.destroy();
    });

    it('should not emit flush when buffer is empty on direct flush() call', () => {
      const buffer = new MetricsBuffer({ maxSize: 100 });
      const flushSpy = jest.fn();
      buffer.on('flush', flushSpy);

      buffer.flush();

      expect(flushSpy).not.toHaveBeenCalled();
      buffer.destroy();
    });
  });

  // Grupo 4: drain().
  describe('drain', () => {
    it('should return the buffer metrics and reset size to 0', () => {
      const buffer = new MetricsBuffer({ maxSize: 100 });

      // Adiciona 2 métricas.
      for (let i = 0; i < 2; i++) {
        buffer.add(makeMetricPayload({ endpoint: `/api/users/${i}` }));
      }

      const drained = buffer.drain();

      expect(drained).toHaveLength(2);
      expect(drained[0].endpoint).toBe('/api/users/0');
      expect(drained[1].endpoint).toBe('/api/users/1');
      expect(buffer.size).toBe(0);
      buffer.destroy();
    });

    it('should not emit flush event when drain() is called', () => {
      const buffer = new MetricsBuffer({ maxSize: 100 });
      const flushSpy = jest.fn();
      buffer.on('flush', flushSpy);

      buffer.add(makeMetricPayload());
      buffer.drain();

      expect(flushSpy).not.toHaveBeenCalled();
      buffer.destroy();
    });

    it('should return an empty array when the buffer is empty', () => {
      const buffer = new MetricsBuffer();
      const drained = buffer.drain();
      expect(drained).toEqual([]);
      buffer.destroy();
    });
  });

  // Grupo 5: destroy().
  describe('destroy', () => {
    it('should stop the periodic timer', () => {
      const buffer = new MetricsBuffer({ flushIntervalMs: 1000 });
      const flushSpy = jest.fn();
      buffer.on('flush', flushSpy);

      buffer.add(makeMetricPayload());
      buffer.destroy();

      // Avança o relógio -> o timer já foi parado, não deve disparar
      jest.advanceTimersByTime(5000);

      // destroy() chama flush() internamente antes de parar o timer,
      // por isso o spy pode ter sido chamado uma vez (o flush final).
      // O que garantimos é que não foi chamado APÓS o destroy().
      const callAfterDestroy = flushSpy.mock.calls.length;
      jest.advanceTimersByTime(10000);
      expect(flushSpy.mock.calls.length).toBe(callAfterDestroy);
    });
  });
});
