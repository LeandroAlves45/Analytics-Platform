import type { AggregationInterval } from '@/types/metrics';

const WINDOW_MS: Record<AggregationInterval, number> = {
  '5m': 60 * 60 * 1000,
  '1h': 24 * 60 * 60 * 1000,
  '1d': 30 * 24 * 60 * 60 * 1000,
};

/**
 * Janela temporal deslizante para pedidos à Read API.
 * Recalculada em cada fetch para manter o tamanho da janela constante durante o polling.
 */
export function computeMetricsWindow(
  interval: AggregationInterval,
  now: Date = new Date()
): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - WINDOW_MS[interval]).toISOString(),
    to: now.toISOString(),
  };
}

export function getWindowDurationMs(interval: AggregationInterval): number {
  return WINDOW_MS[interval];
}
