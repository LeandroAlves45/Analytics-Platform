/**
 * Responsável pelo envio HTTP de métricas ao servidor e pela lógica
 * de retry com backoff exponencial em caso de falha recuperável.
 *
 * Dois tipos de falha têm comportamento diferente:
 *   - Recuperável (rede, 5xx, 429): tenta novamente com delay crescente
 *   - Não recuperável (422, 409):   descarta imediatamente, não faz retry
 */

/**
 * Estrutura de uma métrica pronta a ser enviada ao servidor.
 * Espelha o schema Zod do MetricsController no backend.
 */
export interface MetricPayload {
  endpoint: string;
  method: string;
  latencyMs: number;
  statusCode: number;
  requestId: string;
  payloadSizeBytes?: number;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Configuração do HttpSender.
 * Os campos têm defaults sensatos definidos em HttpSender.
 */
export interface HttpSenderConfig {
  // URL base do servidor de ingestão(ex: 'https://api.analytics-saas.com')
  serverUrl: string;

  // API key para autenticação (enviada no header de Authorization)
  apiKey: string;

  // Número máximo de tentativas antes de desistir (default: 3)
  maxRetries?: number;

  // Delay base em ms para backoff exponencial (default: 1000ms)
  retryBaseDelayMs?: number;

  // Timeout de cada pedido HTTP em ms (default: 5000ms)
  timeoutMs?: number;
}

/**
 * Resultado do envio de um batch em métricas.
 */
export interface SendResult {
  // true se o servidor aceitou as métricas, false se falhou após todos os retries
  success: boolean;

  // Número de métricas aceites (pode ser 0 em caso de falha)
  accepted: number;

  // Mensagem de erro se sucess === false
  error?: string;
}

/**
 * Envia métricas ao servidor com retry automático e backoff exponencial.
 */
export class HttpSender {
  private readonly serverUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly timeoutMs: number;

  constructor(config: HttpSenderConfig) {
    this.serverUrl = config.serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 1000;
    this.timeoutMs = config.timeoutMs ?? 5000;
  }

  /**
   * Envia um array de métricas ao servidor.
   * Tenta até maxRetries vezes em caso de falha recuperável.
   *
   * @param metrics - Array de métricas a enviar.
   * @returns SendResult com o resultado do envio.
   */
  async send(metrics: MetricPayload[]): Promise<SendResult> {
    if (metrics.length === 0) {
      return { success: true, accepted: 0 };
    }

    let lastError: string = '';

    // Loop de retry: tenta no máximo maxRetries vezes.
    // Começa com 1 para facilitar o cálculo do delay.
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.sendOnce(metrics);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        // Erros não recuperáveis: não vale a pena tentar novamente.
        // O servidor rejeitou por razão semântica (payload inválido, duplicado).
        if (error instanceof NonRetryableError) {
          return {
            success: false,
            accepted: 0,
            error: lastError,
          };
        }

        // Se ainda há tentativas disponíveis, espera antes de tentar novamente.
        const isLastAttempt = attempt === this.maxRetries;
        if (!isLastAttempt) {
          const delayMs = this.calculateBackoffDelay(attempt);
          await this.sleep(delayMs);
        }
      }
    }

    return {
      success: false,
      accepted: 0,
      error: `Failed after ${this.maxRetries} attempts. Last error: ${lastError}`,
    };
  }

  /**
   * Faz um único pedido HTTP ao servidor.
   * Lança NonRetryableError para falhas semânticas (422, 409).
   * Lança Error genérico para falhas de rede ou 5xx (recuperáveis).
   *
   * @param metrics - Array de métricas a enviar.
   * @returns SendResult em caso de sucesso.
   */
  private async sendOnce(metrics: MetricPayload[]): Promise<SendResult> {
    // AbortController permite cancelar o fetch após o timeout.
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Enviamos cada métrica individualmente para manter compatibilidade
      // com o endpoint POST /api/metrics que aceita uma métrica por request.
      const results = await Promise.allSettled(
        metrics.map((metric) =>
          fetch(`${this.serverUrl}/api/metrics`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
              'User-Agent': 'analytics-saas-sdk/1.0.0',
            },
            body: JSON.stringify(metric),
            signal: controller.signal,
          })
        )
      );

      // Verifica o resultado de cada envio individual.
      let accepted = 0;
      for (const result of results) {
        if (result.status === 'rejected') {
          throw new Error(`Network error: ${String(result.reason)}`);
        }

        const response = result.value;
        if (response.status === 202) {
          // 202 Accepted: métrica recebida com sucesso.
          accepted++;
        } else if (response.status >= 400 && response.status < 500) {
          // Qualquer 4xx: erro do cliente, tentar novamente não vai resolver.
          throw new NonRetryableError(`Server rejected metric with status ${response.status}`);
        } else if (response.status >= 500) {
          // 5xx: erro do servidor -> pode ser temporário, tenta novamente.
          throw new Error(`Server error: ${response.status}`);
        }
      }

      return { success: true, accepted };
    } finally {
      // Limpa o timeout independentemente do resultado.
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Calcula o delay de backoff exponencial para uma tentativa.
   *
   * Fórmula: baseDelay * 2^(attempt - 1)
   * Tentativa 1: 1000ms, Tentativa 2: 2000ms, Tentativa 3: 4000ms
   *
   * Adicionamos jitter (variação aleatória de ±10%) para evitar que
   * múltiplos clientes tentem em simultâneo após uma falha global.
   *
   * @param attempt - Número da tentativa atual (começa em 1).
   * @returns Delay em milissegundos.
   */
  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);

    // Jitter: multiplica por um factor entre 0.9 e 1.1 para evitar colisões.
    const jitter = 0.9 + Math.random() * 0.2;

    return Math.round(baseDelay * jitter);
  }

  /**
   * Pausa a execução por um número de milissegundos.
   * Usado pelo loop de retry para aguardar entre tentativas.
   *
   * @param ms - Milissegundos a aguardar.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Erro lançado quando o servidor rejeita a métrica por razão semântica.
 * Indica que tentar novamente não vai resolver o problema.
 *
 * Exemplos: payload inválido (422), requestId duplicado (409).
 */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}
