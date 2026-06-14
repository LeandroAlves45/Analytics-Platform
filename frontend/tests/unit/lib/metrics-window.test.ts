import { describe, expect, it } from 'vitest';
import { computeMetricsWindow, getWindowDurationMs } from '@/lib/metrics-window';

describe('computeMetricsWindow', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('should return a 1 hour window for interval 5m', () => {
    const window = computeMetricsWindow('5m', now);

    expect(window.to).toBe(now.toISOString());
    expect(new Date(window.from).getTime()).toBe(now.getTime() - getWindowDurationMs('5m'));
  });

  it('should return a 24 hour window for interval 1h', () => {
    const window = computeMetricsWindow('1h', now);

    expect(new Date(window.from).getTime()).toBe(now.getTime() - 24 * 60 * 60 * 1000);
  });

  it('should return a 30 day window for interval 1d', () => {
    const window = computeMetricsWindow('1d', now);

    expect(new Date(window.from).getTime()).toBe(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  });
});
