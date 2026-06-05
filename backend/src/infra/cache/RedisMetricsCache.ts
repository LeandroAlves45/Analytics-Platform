/**
 * Implementação concreta do contrato MetricsCacheService usando Redis (ioredis).
 *
 * Esta classe é o único sítio em todo o sistema que sabe:
 * - Que o cache é Redis
 * - Como as chaves são estruturadas
 * - Qual o TTL de cada entrada
 * - Como serializar e desserializar Metric entities
 *
 * Estratégia de cache: Cache-Aside (Lazy Loading)
 * - O repositório verifica o cache antes de ir à BD (getRecent)
 * - O repositório popula o cache após leitura da BD (setRecent)
 * - O repositório invalida o cache após escrita (invalidate)
 */

import type Redis from 'ioredis';
import { Metric, type HttpMethod } from '@domain/entities/Metric';
import type { MetricsCacheService } from '@application/contracts/cache';
import { logger } from '@infra/frameworks/logging';

/**
 * TTL em segundos para entradas de cache de métricas recentes.
 * 5 minutos é o equilíbrio entre frescura dos dados e redução de carga na BD.
 * Dashboards com polling de 10s verão dados com no máximo 5 min de desfasamento.
 */
const RECENT_METRICS_TTL_SECONDS = parseInt(process.env['METRICS_CACHE_TTL_SECONDS'] ?? '300', 10);

/**
 * Prefixo de todas as chaves de cache deste serviço.
 * Facilita namespace isolation se partilharmos a instância Redis com outros serviços.
 */
const KEY_PREFIX = 'metrics:recent';

export class RedisMetricsCache implements MetricsCacheService {
  // Recebemos o cliente ioredis por injecção de dependências.
  // O bootstrap é responsável por criar e injectar esta instância.
  constructor(private readonly redis: Redis) {}

  /**
   * Tenta ler métricas do cache para um workspace e janela de tempo.
   *
   * Fluxo:
   * 1. Constrói a chave composta para este workspace+minutes
   * 2. Executa GET no Redis
   * 3. Se null: cache miss -> devolve null para o repositório ir à BD
   * 4. Se string: desserializa JSON e reidrata as Metric entities
   *
   * Falhas de cache são silenciosas: devolvemos null para que o repositório
   * continue a funcionar normalmente via BD, em vez de propagar o erro.
   */
  async getRecent(workspaceId: string, minutes: number): Promise<Metric[] | null> {
    const key = this.buildKey(workspaceId, minutes);

    try {
      const cached = await this.redis.get(key);

      // Cache miss: não há entrada para este workspace+minutes
      if (cached === null) {
        return null;
      }

      // Cache hit: desserializa e reidrata as Metric entities
      const rawData = JSON.parse(cached) as Array<Record<string, unknown>>;
      const metrics = rawData.map((item) => this.deserializeMetric(item));

      logger.debug('metrics_cache_hit', {
        workspaceId: workspaceId,
        minutes,
        count: metrics.length,
      });

      return metrics;
    } catch (error) {
      // Falha de cache não deve quebrar o fluxo de ingestão.
      // Fazemos log e devolvemos null para o repositório usar a BD como fallback.
      logger.warn('metrics_cache_get_failed', {
        workspaceId,
        minutes,
        error: error instanceof Error ? error.message : 'unknown',
      });

      return null;
    }
  }

  /**
   * Guarda métricas no cache após leitura da BD.
   *
   * Usa SETEX (SET + EXPIRE atómica) para garantir que a entrada
   * expira automaticamente ao fim de RECENT_METRICS_TTL_SECONDS.
   *
   * Falhas de escrita no cache são silenciosas: a métrica já foi
   * guardada na BD com sucesso, o cache é apenas optimização.
   */
  async setRecent(workspaceId: string, minutes: number, metrics: Metric[]): Promise<void> {
    const key = this.buildKey(workspaceId, minutes);

    try {
      // Serializar array de Metric entities para JSON
      const serialized = JSON.stringify(metrics.map((metric) => this.serializeMetric(metric)));

      // SETEX é atómico: SET + EXPIRE define valor e TTL ao mesmo tempo
      await this.redis.setex(key, RECENT_METRICS_TTL_SECONDS, serialized);

      logger.debug('metrics_cache_set', {
        workspaceId,
        minutes,
        count: metrics.length,
        ttl_seconds: RECENT_METRICS_TTL_SECONDS,
      });
    } catch (error) {
      // Falha de cache não deve quebrar o fluxo, apenas log.
      logger.warn('metrics_cache_set_failed', {
        workspaceId,
        minutes,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  /**
   * Invalida todas as entradas de cache para um workspace.
   *
   * Chamado após inserção de nova métrica via save().
   * Garante que a próxima leitura de getRecent() vai à BD
   * e obtém dados que incluem a métrica recém-inserida.
   *
   * Usa SCAN em vez de KEYS para não bloquear o event loop do Redis.
   * KEYS é O(N) e bloqueia todas as operações durante a execução.
   * SCAN itera por cursor, devolvendo resultados em batches sem bloqueio.
   */
  async invalidate(workspaceId: string): Promise<void> {
    const pattern = `${KEY_PREFIX}:${workspaceId}:*`;

    try {
      // Recolher todas as chaves que correspondem ao padrão usando SCAN
      const keysToDelete = await this.scanKeys(pattern);

      if (keysToDelete.length === 0) {
        // Não havia entradas de cache para este tipo de workspace
        return;
      }

      // DEL aceita múltiplas chaves numa operação
      await this.redis.del(...keysToDelete);

      logger.debug('metrics_cache_invalidated', {
        workspaceId,
        keys_deleted: keysToDelete.length,
      });
    } catch (error) {
      // Falha de invalidação é silenciosa: a métrica já foi guardada na BD com sucesso,
      logger.warn('metrics_cache_invalidate_failed', {
        workspaceId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  /**
   * Constrói a chave Redis composta para um workspace e janela de tempo.
   *
   * Formato: metrics:recent:{workspaceId}:{minutes}
   * @example: metrics:recent:550e8400-e29b-41d4-a716-446655440000:5
   *
   * O workspaceId no path permite que o padrão de SCAN
   * `metrics:recent:{workspaceId}:*` apanhe todas as janelas de tempo
   * deste workspace de forma eficiente.
   */
  private buildKey(workspaceId: string, minutes: number): string {
    return `${KEY_PREFIX}:${workspaceId}:${minutes}`;
  }

  /**
   * Serializa uma Metric entity para um objecto simples guardável em JSON.
   *
   * Não guardamos a instância directamente porque JSON.stringify em classes
   * perde métodos e prototype. Guardamos apenas os dados primitivos necessários
   * para reconstituir a entidade via Metric.reconstitute().
   */
  private serializeMetric(metric: Metric): Record<string, unknown> {
    return {
      workspaceId: metric.workspaceId,
      apiKeyId: metric.apiKeyId,
      endpoint: metric.endpoint,
      method: metric.method,
      latencyMs: metric.latencyMs,
      statusCode: metric.statusCode,
      payloadSizeBytes: metric.payloadSizeBytes,
      requestId: metric.requestId,
      userAgent: metric.userAgent,
      ipAddress: metric.ipAddress,
      timestamp: metric.timestamp.toISOString(),
    };
  }

  /**
   * Desserializa um objecto JSON para uma Metric entity válida.
   *
   * Usa Metric.reconstitute() para preservar o timestamp original,
   * exactamente como o DrizzleMetricsRepository faz ao ler da BD.
   * Isto garante consistência entre dados em cache e dados da BD.
   */
  private deserializeMetric(data: Record<string, unknown>): Metric {
    return Metric.reconstitute({
      workspaceId: data.workspaceId as string,
      apiKeyId: data.apiKeyId as string,
      endpoint: data.endpoint as string,
      method: data.method as HttpMethod,
      latencyMs: data.latencyMs as number,
      statusCode: data.statusCode as number,
      payloadSizeBytes: (data.payloadSizeBytes as number | null) ?? undefined,
      requestId: data.requestId as string,
      userAgent: (data.userAgent as string | null) ?? undefined,
      ipAddress: (data.ipAddress as string | null) ?? undefined,
      timestamp: new Date(data.timestamp as string),
    });
  }

  /**
   * Itera sobre todas as chaves Redis que correspondem a um padrão usando SCAN.
   *
   * SCAN vs KEYS:
   * - KEYS bloqueia o Redis durante toda a execução (perigoso em produção)
   * - SCAN itera por cursor em batches, sem bloqueio (correcto para produção)
   *
   * O count:100 é uma sugestão ao Redis sobre o tamanho do batch por iteração.
   * Redis pode devolver mais ou menos, mas garante que eventualmente itera tudo.
   *
   * @param pattern - Padrão glob Redis, ex: "metrics:recent:uuid:*"
   * @returns Array com todas as chaves encontradas
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      // SCAN devolve [próximo_cursor, chaves_encontradas[]]
      const [nextCursor, foundKeys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);

      keys.push(...foundKeys);
      cursor = nextCursor;
      // Quando cursor voltar a '0', completámos uma iteração completa
    } while (cursor !== '0');

    return keys;
  }
}
