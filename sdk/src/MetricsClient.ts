/**
 * API pública do SDK de ingestão de métricas.
 *
 * É a única classe que o utilizador do SDK instancia directamente.
 * Toda a complexidade de buffer e envio HTTP está delegada a
 * MetricsBuffer e HttpSender respectivamente.
 *
 * @example
 * Uso básico:
 *
 *   const client = new MetricsClient({
 *     serverUrl: 'https://api.analytics-saas.com',
 *     apiKey: 'sk_live_...',
 *   });
 *
 *   client.record({
 *     endpoint: '/api/users',
 *     method: 'GET',
 *     latencyMs: 150,
 *     statusCode: 200,
 *   });
 *
 *   // No shutdown da aplicação:
 *   await client.destroy();
 */

import { randomUUID } from 'crypto';
import { MetricsBuffer, MetricsBufferConfig } from './MetricsBuffer';
import { HttpSender, HttpSenderConfig, MetricPayload } from './HttpSender';

/**
 * Input que o utilizador passa ao método record().
 * requestId é opcional — o SDK gera um automaticamente se não for fornecido.
 */
export interface RecordMetricInput {
  // Path do endpoint que foi chamado.
  endpoint: string;

  // HTTP method usado.
  method: string;

  // Latência em milissegundos.
  latencyMs: number;

  // HTTP status code retornado.
  statusCode: number;

  // Identificador único do request —> usado para idempotência no servidor.
  // Se não fornecido, o SDK gera um UUID automaticamente.
  requestId?: string;

  // Campos opcionais
  payloadSizeBytes?: number;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Configuração do MetricsClient.
 * Combina as configurações do HttpSender e do MetricsBuffer
 * numa única interface para simplificar o uso.
 */
export interface MetricsClientConfig extends HttpSenderConfig, MetricsBufferConfig {
  // serverUrl e apiKey são herdados de HttpSenderConfig (obrigatórios)
  // maxSize e flushIntervalMs são herdados de MetricsBufferConfig (opcionais)
}

/**
 * Cliente principal do SDK de métricas.
 * Liga MetricsBuffer ao HttpSender e expõe a API pública.
 */
export class MetricsClient {
  private readonly buffer: MetricsBuffer;
  private readonly sender: HttpSender;

  // Flag para evitar chamadas após destroy().
  // Protege contra uso incorrecto do SDK.
  private destroyed = false;

  constructor(config: MetricsClientConfig) {
    // Instancia o buffer com as configurações de volume e tempo.
    this.buffer = new MetricsBuffer({
      maxSize: config.maxSize,
      flushIntervalMs: config.flushIntervalMs,
    });

    // Instancia o sender com as configurações de HTTP e retry.
    this.sender = new HttpSender({
      serverUrl: config.serverUrl,
      apiKey: config.apiKey,
      maxRetries: config.maxRetries,
      retryBaseDelayMs: config.retryBaseDelayMs,
      timeoutMs: config.timeoutMs,
    });

    // Subscreve o evento flush do buffer.
    // Quando o buffer decide que é altura de enviar, chama este handler.
    // O handler é async mas o evento é fire-and-forget —> erros de envio
    // são logados mas não propagados para não afectar a aplicação cliente.
    this.buffer.on('flush', (metrics) => {
      // Void explícito: o resultado da promise é intencionalmente ignorado.
      // Falhas de envio não devem interromper a aplicação que usa o SDK.
      void this.handleFlush(metrics);
    });
  }

  /**
   * Regista uma métrica para envio assíncrono.
   *
   * Este método é síncrono e retorna imediatamente.
   * A métrica é adicionada ao buffer e enviada em background.
   *
   * @param input - Dados da métrica a registar.
   */
  record(input: RecordMetricInput): void {
    if (this.destroyed) {
      // Avisa em vez de lançar erro -> o SDK não deve afectar a aplicação cliente.
      console.warn('[analytics-saas-sdk] record() called after destroy()');
      return;
    }

    // Constrói o payload completo com o requestId gerado se necessário.
    const payload: MetricPayload = {
      endpoint: input.endpoint,
      method: input.method,
      latencyMs: input.latencyMs,
      statusCode: input.statusCode,
      // Se o cliente nnão passou o requestId, geramos um UUID v4.
      requestId: input.requestId ?? randomUUID(),
      payloadSizeBytes: input.payloadSizeBytes,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    };

    // Adiciona o payload ao buffer.
    this.buffer.add(payload);
  }

  /**
   * Envia imediatamente todas as métricas pendentes no buffer e aguarda conclusão.
   *
   * Deve ser chamado no shutdown da aplicação para garantir que
   * métricas acumuladas não são perdidas quando o processo termina.
   *
   * @example
   * Exemplo de uso com graceful shutdown:
   *
   *   process.on('SIGTERM', async () => {
   *     await client.destroy();
   *     process.exit(0);
   *   });
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    // drain() devolve métricas pendentes e limpa o buffer sem emitir evento
    const pendingMetrics = this.buffer.drain();

    // Para o timer mas NÃO chama flush via evento
    this.buffer.destroy();

    if (pendingMetrics.length > 0) {
      // Aguarda o ultimo envio para garantir que as métricas chegam ao servidor.
      await this.sender.send(pendingMetrics);
    }
  }

  /**
   * Handler interno chamado quando o buffer emite o evento flush.
   * Delega ao HttpSender e trata erros sem propagar para a aplicação.
   *
   * @param metrics - Métricas a enviar, vindas do buffer.
   */
  private async handleFlush(metrics: MetricPayload[]): Promise<void> {
    const result = await this.sender.send(metrics);

    if (!result.success) {
      console.error(
        `[analytics-saas-sdk] Failed to send ${metrics.length} metrics: ${result.error}`
      );
    }
  }
}
