/**
 * Testes unitários da entidade AlertRule.
 *
 * Cobrem: construção com input válido, reconstitution a partir da BD,
 * validações fail-fast, e toda a lógica pura de avaliação de alertas
 * (shouldTrigger, shouldAutoResolve, extractObservedValue).
 * Não há stubs de infraestrutura — a entidade não tem I/O.
 */

import { AlertRule, ALERT_MIN_SAMPLE_COUNT } from '@domain/entities/AlertRule';
import { ValidationError } from '@shared/errors';
import { BASE_ALERT_RULE_INPUT, BASE_ALERT_RULE_PERSISTED } from '../../../fixtures/alerts';

describe('AlertRule Entity', () => {
  describe('constructor - valid input', () => {
    it('should create an alert rule with required fields', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);

      expect(rule.workspaceId).toBe(BASE_ALERT_RULE_INPUT.workspaceId);
      expect(rule.name).toBe(BASE_ALERT_RULE_INPUT.name);
      expect(rule.condition).toBe('latency_p95');
      expect(rule.threshold).toBe(500);
      expect(rule.windowMinutes).toBe(5);
      expect(rule.status).toBe('active');
    });

    it('should generate a unique ID on creation', () => {
      const rule1 = new AlertRule(BASE_ALERT_RULE_INPUT);
      const rule2 = new AlertRule(BASE_ALERT_RULE_INPUT);

      expect(rule1.id).not.toBe(rule2.id);
    });

    it('should default optional fields', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);

      expect(rule.endpointId).toBeNull();
      expect(rule.description).toBeNull();
      expect(rule.emailAddresses).toEqual([]);
    });
  });

  describe('reconstitute', () => {
    // reconstitute deve preservar os valores da BD tal-e-qual — sem gerar novo id nem timestamps
    it('should preserve id and timestamps', () => {
      const rule = AlertRule.reconstitute(BASE_ALERT_RULE_PERSISTED);

      expect(rule.id).toBe(BASE_ALERT_RULE_PERSISTED.id);
      expect(rule.createdAt).toEqual(BASE_ALERT_RULE_PERSISTED.createdAt);
      expect(rule.updatedAt).toEqual(BASE_ALERT_RULE_PERSISTED.updatedAt);
    });
  });

  describe('validation errors', () => {
    it('should throw when workspaceId is invalid', () => {
      expect(() => new AlertRule({ ...BASE_ALERT_RULE_INPUT, workspaceId: 'invalid' })).toThrow(
        ValidationError
      );
    });

    it('should throw when condition is invalid', () => {
      expect(() => new AlertRule({ ...BASE_ALERT_RULE_INPUT, condition: 'unknown' })).toThrow(
        ValidationError
      );
    });

    it('should throw when error_rate threshold is out of range', () => {
      expect(
        () =>
          new AlertRule({
            ...BASE_ALERT_RULE_INPUT,
            condition: 'error_rate',
            threshold: 1.5, // error_rate aceita apenas ]0, 1]
          })
      ).toThrow(ValidationError);
    });

    it('should throw when no notification channel is configured', () => {
      expect(
        () =>
          new AlertRule({
            ...BASE_ALERT_RULE_INPUT,
            slackWebhookUrl: null,
            emailAddresses: [],
          })
      ).toThrow(ValidationError);
    });

    it('should throw when endpointId is invalid', () => {
      expect(() => new AlertRule({ ...BASE_ALERT_RULE_INPUT, endpointId: 'not-a-uuid' })).toThrow(
        ValidationError
      );
    });

    it('should throw when name is blank', () => {
      expect(() => new AlertRule({ ...BASE_ALERT_RULE_INPUT, name: '   ' })).toThrow(
        ValidationError
      );
    });

    it('should throw when threshold is not finite', () => {
      expect(() => new AlertRule({ ...BASE_ALERT_RULE_INPUT, threshold: Number.NaN })).toThrow(
        ValidationError
      );
    });

    it('should throw when latency threshold is not positive', () => {
      expect(() => new AlertRule({ ...BASE_ALERT_RULE_INPUT, threshold: 0 })).toThrow(
        ValidationError
      );
    });

    it('should throw when windowMinutes is not a positive integer', () => {
      expect(() => new AlertRule({ ...BASE_ALERT_RULE_INPUT, windowMinutes: 0 })).toThrow(
        ValidationError
      );
    });

    it('should throw when email address format is invalid', () => {
      expect(
        () =>
          new AlertRule({
            ...BASE_ALERT_RULE_INPUT,
            slackWebhookUrl: null,
            emailAddresses: ['not-an-email'],
          })
      ).toThrow(ValidationError);
    });

    it('should throw when status is invalid', () => {
      expect(() => new AlertRule({ ...BASE_ALERT_RULE_INPUT, status: 'paused' })).toThrow(
        ValidationError
      );
    });
  });

  describe('isActive', () => {
    it('should return true for active status', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);

      expect(rule.isActive()).toBe(true);
    });

    it('should return false for inactive status', () => {
      const rule = new AlertRule({ ...BASE_ALERT_RULE_INPUT, status: 'inactive' });

      expect(rule.isActive()).toBe(false);
    });
  });

  describe('extractObservedValue()', () => {
    it('should return latency_p95 for latency_p95 condition', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(
        rule.extractObservedValue({ latencyP95: 600, errorRate: 0.1, status5xxCount: 3 })
      ).toBe(600);
    });

    it('should return errorRate for error_rate condition', () => {
      const rule = new AlertRule({
        ...BASE_ALERT_RULE_INPUT,
        condition: 'error_rate',
        threshold: 0.05,
      });
      expect(
        rule.extractObservedValue({ latencyP95: 100, errorRate: 0.12, status5xxCount: 0 })
      ).toBe(0.12);
    });

    it('should return status5xxCount for status_5xx_count condition', () => {
      const rule = new AlertRule({
        ...BASE_ALERT_RULE_INPUT,
        condition: 'status_5xx_count',
        threshold: 5,
      });
      expect(
        rule.extractObservedValue({ latencyP95: 100, errorRate: 0.01, status5xxCount: 12 })
      ).toBe(12);
    });

    it('should reach exhaustive default when condition is corrupted at runtime', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      Object.defineProperty(rule, 'condition', { value: 'corrupted' });

      expect(rule.extractObservedValue({ latencyP95: 1, errorRate: 1, status5xxCount: 1 })).toBe(
        'corrupted'
      );
    });
  });

  describe('shouldTrigger()', () => {
    it('should return true when threshold exceeded with enough samples and no open event', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(rule.shouldTrigger(600, ALERT_MIN_SAMPLE_COUNT, false)).toBe(true);
    });

    // Cooldown: não deve disparar um segundo evento enquanto o anterior está aberto
    it('should return false when open event exists (cooldown)', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(rule.shouldTrigger(600, ALERT_MIN_SAMPLE_COUNT, true)).toBe(false);
    });

    it('should return false when sample count is below minimun', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(rule.shouldTrigger(600, ALERT_MIN_SAMPLE_COUNT - 1, false)).toBe(false);
    });

    it('should return false when rule is inactive', () => {
      const rule = new AlertRule({ ...BASE_ALERT_RULE_INPUT, status: 'inactive' });
      expect(rule.shouldTrigger(600, ALERT_MIN_SAMPLE_COUNT, false)).toBe(false);
    });
  });

  describe('shouldAutoResolve()', () => {
    it('should return true when value normalizes and open event exists', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(rule.shouldAutoResolve(400, true)).toBe(true);
    });

    // Sem evento aberto não há nada a resolver
    it('should return false when no open event exists', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(rule.shouldAutoResolve(400, false)).toBe(false);
    });

    it('should return false when threshold still exceeded', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(rule.shouldAutoResolve(600, true)).toBe(false);
    });
  });

  describe('buildTriggerMessage()', () => {
    it('should build a human-readable message for latency_p95', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(rule.buildTriggerMessage(600)).toContain('Alert "High p95 latency"');
    });

    it('should format error_rate message with percentage', () => {
      const rule = new AlertRule({
        ...BASE_ALERT_RULE_INPUT,
        condition: 'error_rate',
        threshold: 0.05,
      });
      expect(rule.buildTriggerMessage(0.12)).toContain('error rate');
    });

    it('should format status_5xx_count message with count', () => {
      const rule = new AlertRule({
        ...BASE_ALERT_RULE_INPUT,
        condition: 'status_5xx_count',
        threshold: 5,
      });
      expect(rule.buildTriggerMessage(12)).toContain('12 server errors');
    });

    it('should reach exhaustive default when condition is corrupted at runtime', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      Object.defineProperty(rule, 'condition', { value: 'corrupted' });

      expect(rule.buildTriggerMessage(12)).toBe('corrupted');
    });
  });

  describe('hasNotificationChannel()', () => {
    it('should return true when slackWebhookUrl is set', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(rule.hasNotificationChannel()).toBe(true);
    });

    it('should return true when emailAddresses is non-empty', () => {
      const rule = new AlertRule({
        ...BASE_ALERT_RULE_INPUT,
        slackWebhookUrl: null,
        emailAddresses: ['ops@example.com'],
      });
      expect(rule.hasNotificationChannel()).toBe(true);
    });
  });
});
