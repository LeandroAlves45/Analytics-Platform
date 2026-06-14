import { describe, expect, it } from 'vitest';
import { formatCount, formatErrorRate, formatLatency, formatThroughput } from '@/lib/formatters';

describe('formatters', () => {
  it('should format latency below 1000ms as rounded milliseconds', () => {
    expect(formatLatency(42)).toBe('42ms');
  });

  it('should format latency at or above 1000ms as seconds', () => {
    expect(formatLatency(1500)).toBe('1.50s');
  });

  it('should format counts with k suffix', () => {
    expect(formatCount(4800)).toBe('4.8k');
  });

  it('should format error rate as percentage with one decimal', () => {
    expect(formatErrorRate(0.042)).toBe('4.2%');
  });

  it('should format throughput below 1000 as requests per second', () => {
    expect(formatThroughput(234)).toBe('234/s');
  });
});
