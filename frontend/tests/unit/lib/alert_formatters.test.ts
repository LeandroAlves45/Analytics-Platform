/**
 * Testes unitários para alert_formatters.ts.
 */

import { describe, expect, it } from 'vitest';
import {
  formatAlertThreshold,
  formatConditionLabel,
  formatRelativeTime,
  formatRuleStatusLabel,
  isAlertEventOpen,
} from '@/lib/alert_formatters';

describe('formatAlertThreshold', () => {
  it('should format error_rate threshold as percentage', () => {
    expect(formatAlertThreshold('error_rate', 0.05)).toBe('5.0%');
  });
});

describe('formatConditionLabel', () => {
  it('should combine metric label and formatted threshold', () => {
    expect(formatConditionLabel('latency_p95', 500)).toBe('P95 Latency > 500ms');
  });
});

describe('formatRuleStatusLabel', () => {
  it('should return portuguese label for inactive status', () => {
    expect(formatRuleStatusLabel('inactive')).toBe('Inativa');
  });
});

describe('formatRelativeTime', () => {
  it('should return seconds ago for recent timestamps', () => {
    const now = new Date('2026-06-14T12:00:30.000Z');
    const iso = '2026-06-14T12:00:00.000Z';

    expect(formatRelativeTime(iso, now)).toBe('há 30s');
  });
});

describe('isAlertEventOpen', () => {
  it('should return true when resolvedAt is null', () => {
    expect(isAlertEventOpen(null)).toBe(true);
  });
});
