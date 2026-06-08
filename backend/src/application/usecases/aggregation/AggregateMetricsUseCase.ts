/**
 * Use case responsável por calcular agregações estatísticas
 * sobre métricas brutas de um workspace/endpoint numa janela de tempo.
 *
 * Invocado pelo AggregationWorker (infra layer) ao processar um job BullMQ.
 *
 * Fluxo:
 * 1. Ler métricas raw do repositório para a janela indicada
 * 2. Filtrar pelo par endpoint/método do job
 * 3. Calcular percentis de latência (p50, p75, p95, p99) e estatísticas (avg, min, max)
 * 4. Contar respostas por família de status code (2xx, 3xx, 4xx, 5xx)
 * 5. Devolver {@link AggregationResult} — union discriminada por `hasData`
 */

import { logger } from '@infra/frameworks/logging';
import type { MetricsRepository } from '@application/contracts/repositories';
import type { ScheduleAggregationInput, AggregationResult } from '@application/dto/AggregationDTO';

export class AggregateMetricsUseCase {
  constructor(private metricsRepository: MetricsRepository) {}

  /**
   * Processa um job de agregação e devolve o resultado tipado.
   *
   * @returns `hasData: false` se não houver métricas na janela;
   *          `hasData: true` com estatísticas completas caso contrário
   */
  async execute(input: ScheduleAggregationInput): Promise<AggregationResult> {
    // Lê as métricas raw da janela de tempo indicada pelo job.
    // getRecent() usa Cache-Aside internamente —> pode vir do Redis ou da BD.
    const metrics = await this.metricsRepository.getRecent(
      input.workspaceId,
      input.intervalMinutes
    );

    // Filtra apenas as métricas do endpoint e method deste job específico.
    // getRecent() devolve todas as métricas do workspace no intervalo,
    // precisamos isolar o par endpoint/method para calcular estatísticas correctas.
    const filtered = metrics.filter(
      (metric) => metric.endpoint === input.endpoint && metric.method === input.method
    );

    // Sem métricas na janela: devolve o ramo `hasData: false` da union.
    if (filtered.length === 0) {
      logger.info('aggregation_no_data', {
        workspaceId: input.workspaceId,
        endpoint: input.endpoint,
        method: input.method,
        intervalMinutes: input.intervalMinutes,
      });

      return {
        processedCount: 0,
        hasData: false,
        workspaceId: input.workspaceId,
        endpoint: input.endpoint,
        method: input.method,
        intervalMinutes: input.intervalMinutes,
      };
    }

    // Extrai os valores de latência para cálculo de percentis.
    // O array tem de estar ordenado de forma ascendente, pois é pré-requisito
    // do algoritmo de interpolação linear para percentis.
    const latencies = filtered.map((metric) => metric.latencyMs).sort((a, b) => a - b);

    // Calcula os percentis de latência ao usar a interpolação linear.
    const latencyP50 = calculatePercentile(latencies, 50);
    const latencyP75 = calculatePercentile(latencies, 75);
    const latencyP95 = calculatePercentile(latencies, 95);
    const latencyP99 = calculatePercentile(latencies, 99);

    // Calcula estatísticas básicas sobre o array já ordenado.
    const latencyMin = latencies[0];
    const latencyMax = latencies[latencies.length - 1];
    const latencyAvg = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;

    // Conta respostas por família de status code (2xx, 3xx, 4xx, 5xx).
    let status2xx = 0;
    let status3xx = 0;
    let status4xx = 0;
    let status5xx = 0;

    for (const metric of filtered) {
      const family = Math.floor(metric.statusCode / 100);

      if (family === 2) {
        status2xx++;
      } else if (family === 3) {
        status3xx++;
      } else if (family === 4) {
        status4xx++;
      } else if (family === 5) {
        status5xx++;
      }
    }

    logger.info('aggregation_calculated', {
      workspaceId: input.workspaceId,
      endpoint: input.endpoint,
      method: input.method,
      intervalMinutes: input.intervalMinutes,
      count: filtered.length,
      latencyP95,
      latencyP99,
    });

    // Com métricas: devolve o ramo `hasData: true` com AggregationStatistics.
    return {
      processedCount: filtered.length,
      hasData: true,
      workspaceId: input.workspaceId,
      endpoint: input.endpoint,
      method: input.method,
      intervalMinutes: input.intervalMinutes,
      latencyP50,
      latencyP75,
      latencyP95,
      latencyP99,
      latencyAvg,
      latencyMin,
      latencyMax,
      status2xxCount: status2xx,
      status3xxCount: status3xx,
      status4xxCount: status4xx,
      status5xxCount: status5xx,
    };
  }
}

/**
 * Calcula um percentil sobre um array de números ordenados ascendentemente.
 *
 * Usa interpolação linear, o mesmo algoritmo que o PostgreSQL percentile_cont().
 * Isto garante que os valores calculados aqui são consistentes com queries SQL
 * que possas vir a fazer directamente na BD para validação.
 *
 * Exemplo com [10, 20, 30, 40, 50] e percentil 75:
 *   index = 0.75 * (5 - 1) = 3.0
 *   lower = sorted[3] = 40, upper = sorted[4] = 50
 *   fraction = 0.0
 *   resultado = 40 + 0.0 * (50 - 40) = 40
 *
 * @param sorted - Array de números ordenados de forma ascendente
 * @param percentile - Percentil a calcular (0-100)
 * @returns Valor do percentil com interpolação linear
 */
function calculatePercentile(sorted: number[], percentile: number): number {
  // Caso singular: array com um único elemento.
  if (sorted.length === 1) {
    return sorted[0];
  }

  // Calcula o índice fraccionário na posição do percentil.
  const index = (percentile / 100) * (sorted.length - 1);

  // Índice inteiro inferior
  const lower = Math.floor(index);

  // Índice inteiro superior
  const upper = Math.ceil(index);

  // Fracção entre os dois índices (para interpolação)
  const fraction = index - lower;

  // Interpolação linear entre os dois valores.
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}
