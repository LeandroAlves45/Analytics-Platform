/**
 * Testes unitários do SlackWebhookGateway.
 * Cobrem webhook ausente, envio bem-sucedido e falha downstream.
 */

const mockSend = jest.fn();

jest.mock('@slack/webhook', () => ({
  IncomingWebhook: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
}));

jest.mock('@infra/frameworks/config', () => ({
  loadConfig: jest.fn(),
}));

jest.mock('@infra/frameworks/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { loadConfig } from '@infra/frameworks/config';
import { SlackWebhookGateway } from '@infra/gateways/SlackWebhookGateway';

const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

describe('SlackWebhookGateway', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockLoadConfig.mockReturnValue({
      SLACK_WEBHOOK_URL: undefined,
    } as ReturnType<typeof loadConfig>);
  });

  it('should return slackSent false when no webhook url is configured', async () => {
    const gateway = new SlackWebhookGateway();

    const result = await gateway.sendAlert({
      workspaceId: 'ws-1',
      ruleName: 'High latency',
      message: 'p95 exceeded',
      observedValue: 600,
      threshold: 500,
      condition: 'latency_p95',
      slackWebhookUrl: null,
      emailAddresses: [],
    });

    expect(result).toEqual({ slackSent: false, emailSent: false });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should send alert via rule webhook url and return slackSent true', async () => {
    mockSend.mockResolvedValue(undefined);
    const gateway = new SlackWebhookGateway();

    const result = await gateway.sendAlert({
      workspaceId: 'ws-1',
      ruleName: 'High latency',
      message: 'p95 exceeded',
      observedValue: 600,
      threshold: 500,
      condition: 'latency_p95',
      slackWebhookUrl: 'https://hooks.slack.com/services/T/B/XXX',
      emailAddresses: [],
    });

    expect(result).toEqual({ slackSent: true, emailSent: false });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'p95 exceeded',
      })
    );
  });

  it('should fall back to global SLACK_WEBHOOK_URL when rule has none', async () => {
    mockLoadConfig.mockReturnValue({
      SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/global',
    } as ReturnType<typeof loadConfig>);
    mockSend.mockResolvedValue(undefined);
    const gateway = new SlackWebhookGateway();

    const result = await gateway.sendAlert({
      workspaceId: 'ws-1',
      ruleName: 'Error rate',
      message: 'rate high',
      observedValue: 0.1,
      threshold: 0.05,
      condition: 'error_rate',
      slackWebhookUrl: null,
      emailAddresses: [],
    });

    expect(result.slackSent).toBe(true);
    expect(mockSend).toHaveBeenCalled();
  });

  it('should return slackSent false when Slack API rejects the request', async () => {
    mockSend.mockRejectedValue(new Error('channel_not_found'));
    const gateway = new SlackWebhookGateway();

    const result = await gateway.sendAlert({
      workspaceId: 'ws-1',
      ruleName: 'High latency',
      message: 'p95 exceeded',
      observedValue: 600,
      threshold: 500,
      condition: 'latency_p95',
      slackWebhookUrl: 'https://hooks.slack.com/services/T/B/XXX',
      emailAddresses: [],
    });

    expect(result).toEqual({ slackSent: false, emailSent: false });
  });
});
