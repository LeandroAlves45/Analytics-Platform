/**
 * Testes unitários do NodemailerEmailService.
 * Cobrem destinatários ausentes, SMTP não configurado, envio e falha downstream.
 */

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn().mockReturnValue({
  sendMail: mockSendMail,
});

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: mockCreateTransport,
  },
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
import { NodemailerEmailService } from '@infra/gateways/NodemailerEmailService';

const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

describe('NodemailerEmailService', () => {
  beforeEach(() => {
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
    mockLoadConfig.mockReturnValue({
      SMTP_HOST: 'smtp.test.local',
      SMTP_PORT: 587,
      SMTP_FROM: 'alerts@test.local',
      SMTP_USER: 'user',
      SMTP_PASSWORD: 'pass',
    } as ReturnType<typeof loadConfig>);
  });

  it('should return emailSent false when there are no recipients', async () => {
    const service = new NodemailerEmailService();

    const result = await service.sendAlert({
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
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('should return emailSent false when SMTP is not configured', async () => {
    mockLoadConfig.mockReturnValue({
      SMTP_HOST: undefined,
      SMTP_FROM: undefined,
    } as ReturnType<typeof loadConfig>);
    const service = new NodemailerEmailService();

    const result = await service.sendAlert({
      workspaceId: 'ws-1',
      ruleName: 'High latency',
      message: 'p95 exceeded',
      observedValue: 600,
      threshold: 500,
      condition: 'latency_p95',
      slackWebhookUrl: null,
      emailAddresses: ['ops@test.local'],
    });

    expect(result).toEqual({ slackSent: false, emailSent: false });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('should send email and return emailSent true on success', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-1' });
    const service = new NodemailerEmailService();

    const result = await service.sendAlert({
      workspaceId: 'ws-1',
      ruleName: 'High latency',
      message: 'p95 exceeded',
      observedValue: 600,
      threshold: 500,
      condition: 'latency_p95',
      slackWebhookUrl: null,
      emailAddresses: ['ops@test.local', 'oncall@test.local'],
    });

    expect(result).toEqual({ slackSent: false, emailSent: true });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'alerts@test.local',
        to: 'ops@test.local,oncall@test.local',
        subject: '[Alert] High latency',
      })
    );
  });

  it('should escape HTML special characters in email body', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-2' });
    const service = new NodemailerEmailService();

    await service.sendAlert({
      workspaceId: 'ws-1',
      ruleName: 'Rule <script>',
      message: 'Value "bad" & worse',
      observedValue: 600,
      threshold: 500,
      condition: 'latency_p95',
      slackWebhookUrl: null,
      emailAddresses: ['ops@test.local'],
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Rule &lt;script&gt;'),
      })
    );
  });

  it('should return emailSent false when SMTP send fails', async () => {
    mockSendMail.mockRejectedValue(new Error('connection timeout'));
    const service = new NodemailerEmailService();

    const result = await service.sendAlert({
      workspaceId: 'ws-1',
      ruleName: 'High latency',
      message: 'p95 exceeded',
      observedValue: 600,
      threshold: 500,
      condition: 'latency_p95',
      slackWebhookUrl: null,
      emailAddresses: ['ops@test.local'],
    });

    expect(result).toEqual({ slackSent: false, emailSent: false });
  });
});
