/**
 * Utilitários de formatação para valores numéricos do dashboard.
 * Centralizar aqui garante que "42ms" aparece sempre igual
 * nos KPI cards, tooltips dos gráficos e tabela de endpoints.
 */

/**
 * Formata a latência em milissegundos para "42ms"
 */
export function formatLatency(ms: number): string {
  if (ms >= 1000) {
    // Converte para segundos
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

/**
 * Formata um número de requests com sufixo de  magnitude
 * @example
 * 4800 -> "48k" | 1200000 -> "1.2M"
 */
export function formatCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

/**
 * Formata error rate com percentagem com 1 decimal
 * @example
 * 0.042 -> "4.2%"
 */
export function formatErrorRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Formata throughput em requests por segundo
 * @example
 * 2340 -> "2.3k/s"
 */
export function formatThroughput(rps: number): string {
  if (rps >= 1_000) {
    return `${(rps / 1_000).toFixed(1)}k/s`;
  }
  return `${Math.round(rps)}/s`;
}

/**
 * Formata uma data ISO 8601 para display no eixo x do gráfico
 * @example
 * 5m -> "14:30" | 1h -> "14:00" | 1d -> "12 Jun"
 */
export function formatAxisTime(isoTime: string, interval: '5m' | '1h' | '1d'): string {
  const date = new Date(isoTime);

  if (interval === '1d') {
    // Dia do mês + nome do mês abreviado
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // Para 5min e 1h, retorna hora:minuto
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Formata timestamp da última atualização para a polling bar
 * @example
 * "3s ago" | "1m ago" | "just now"
 */
export function formatLastUpdated(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

/**
 * Divide a latência em valor e unidade para display em separado no KPI card
 * P95 Latency: "118" + "ms" ou "1.02" + "s"
 */
export function formatLatencyParts(ms: number): { value: string; unit: string } {
  if (ms >= 1000) {
    return { value: (ms / 1000).toFixed(2), unit: 's' };
  }
  return { value: String(Math.round(ms)), unit: 'ms' };
}
