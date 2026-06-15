/**
 * Testes unitários para a entidade AlertRule.
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
            threshold: 1.5,
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
  });

  describe('shouldTrigger()', () => {
    it('should return true when threshold exceeded with enough samples and no open event', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(rule.shouldTrigger(600, ALERT_MIN_SAMPLE_COUNT, false)).toBe(true);
    });

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
    it('should build a human-readable message', () => {
      const rule = new AlertRule(BASE_ALERT_RULE_INPUT);
      expect(rule.buildTriggerMessage(600)).toContain('Alert "High p95 latency"');
    });
  });
});
