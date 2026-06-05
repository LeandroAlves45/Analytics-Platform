/**
 * Buffer em memória para acumulação de métricas.
 *
 * Acumula métricas e emite o evento 'flush' em duas condições:
 *   1. O número de métricas atinge o limite máximo (flush por volume)
 *   2. O intervalo de tempo configurado expira (flush periódico)
 *
 * Não sabe como as métricas são enviadas, emite o evento e passa
 * os dados. Quem subscreve decide o que fazer com eles.
 */

import { EventEmitter } from 'events';
import { MetricPayload } from './HttpSender';

/**
 * Configuração do MetricsBuffer.
 */
export interface MetricsBufferConfig {
  // Número máximo de métricas antes de forçar o flush (default: 100)
  maxSize?: number;

  // Intervalo em ms entre flushes periódicos (default: 10000ms = 10s)
  flushIntervalMs?: number;
}

/**
 * Eventos emitidos pelo MetricsBuffer.
 * Declaração explícita de tipos para TypeScript reconhecer os eventos.
 */
export interface MetricsBufferEvents {
  // Emitido quando o buffer deve ser esvaziado.
  // O array contém as métricas a enviar -> pode ter entre 1 e maxSize itens.
  flush: (metrics: MetricPayload[]) => void;
}

/**
 * Buffer tipado que estende EventEmitter com os eventos definidos.
 * A extensão de EventEmitter permite tipagem correcta dos eventos
 * sem depender de bibliotecas externas.
 */
export class MetricsBuffer extends EventEmitter {
  on<K extends keyof MetricsBufferEvents>(event: K, listener: MetricsBufferEvents[K]): this;
  on(event: string | symbol, listener: (...args: unknown[]) => void): this;
  on(
    event: string | symbol,
    listener: MetricsBufferEvents[keyof MetricsBufferEvents] | ((...args: unknown[]) => void)
  ): this {
    return super.on(event, listener);
  }

  emit<K extends keyof MetricsBufferEvents>(
    event: K,
    ...args: Parameters<MetricsBufferEvents[K]>
  ): boolean;
  emit(event: string | symbol, ...args: unknown[]): boolean;
  emit(event: string | symbol, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  private readonly maxSize: number;
  private readonly flushIntervalMs: number;

  // Array interno que acumula as métricas.
  // Privado e só modificável pelos métodos desta classe.
  private buffer: MetricPayload[] = [];

  // Referência ao timer periódico para poder cancelá-lo no destroy().
  // NodeJS.Timeout é o tipo correcto para o retorno de setInterval.
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: MetricsBufferConfig = {}) {
    // super() obrigatório antes de qualquer acesso a this em classes que estendem.
    super();

    this.maxSize = config.maxSize ?? 100;
    this.flushIntervalMs = config.flushIntervalMs ?? 10000;

    // Inicia o timer periódico imediatamente na construção.
    // Garante que métricas não ficam em buffer indefinidamente em
    // períodos de baixo tráfego onde o limite de volume nunca é atingido.
    this.startFlushTimer();
  }

  /**
   * Adiciona uma métrica ao buffer.
   * Se o buffer atingir o limite máximo após a adição, emite flush imediatamente.
   *
   * Este método é síncrono e retorna instantaneamente.
   * O flush (envio HTTP) acontece de forma assíncrona após o evento ser emitido.
   *
   * @param metric - Métrica a adicionar ao buffer.
   */
  add(metric: MetricPayload): void {
    this.buffer.push(metric);

    // Verifica o limite após a adição.
    // Se atingiu o máximo, faz flush imediato independentemente do timer.
    if (this.buffer.length >= this.maxSize) {
      this.flush();
    }
  }

  /**
   * Esvazia o buffer e retorna as métricas acumuladas.
   * Útil para casos em que se quer processar as métricas antes de enviar.
   * @returns Métricas acumuladas no buffer.
   */
  drain(): MetricPayload[] {
    const metrics = this.buffer.slice();
    this.buffer = [];
    return metrics;
  }

  /**
   * Esvazia o buffer e emite o evento 'flush' com as métricas acumuladas.
   * Pode ser chamado manualmente (ex: shutdown da aplicação) ou automaticamente
   * pelo timer periódico ou pelo limite de volume.
   *
   * Se o buffer estiver vazio, não emite nenhum evento.
   */
  flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    // Copia o buffer atual e limpa o original atomicamente.
    // Usar slice() cria um novo array com os mesmos elementos.
    // Limpar imediatamente evita que métricas adicionadas durante o envio
    // sejam incluídas no batch actual ou perdidas.
    const metricsToSend = this.buffer.slice();
    this.buffer = [];

    // Emite o evento com as métricas para quem estiver a subscrever.
    // O MetricsClient vai receber este evento e delegá-lo ao HttpSender.
    this.emit('flush', metricsToSend);
  }

  /**
   * Devolve o número atual de métricas no buffer.
   * Útil para testes e para monitorização interna do SDK.
   */
  get size(): number {
    return this.buffer.length;
  }

  /**
   * Liberta recursos do buffer.
   * Deve ser chamado quando o SDK é destruído ou a aplicação termina.
   * Sem isto, o setInterval mantém o processo Node.js vivo indefinidamente.
   */
  destroy(): void {
    // Faz um flush final antes de destruir para não perder métricas pendentes.
    this.flush();
    this.stopFlushTimer();
    // Remove todos os listeners para libertar memória.
    this.removeAllListeners();
  }

  /**
   * Inicia o timer periódico de flush.
   * Usa setInterval para executar flush a cada flushIntervalMs milissegundos.
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);

    // unref() evita que o timer impeça o processo de terminar naturalmente.
    // Sem isto, uma aplicação que terminou a sua lógica ficaria viva
    // apenas por causa do setInterval do SDK.
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /**
   * Para o timer periódico de flush.
   */
  private stopFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
