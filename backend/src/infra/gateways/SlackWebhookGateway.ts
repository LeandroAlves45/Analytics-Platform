/**
 * Gateway Slack via Incoming Webhook.
 * Usa @slack/webhook — retry interno do SDK.
 */

import { IncomingWebhook } from '@slack/webhook';

import type {
  AlertNotificationPayload,
  AlertNotificationResult,
  NotificationGateway,
} from '@application/contracts/gateways';
import { loadConfig } from '@infra/frameworks/config';
import { logger } from '@infra/frameworks/logging';

export class SlackWebhookGateway implements NotificationGateway {
  private readonly config = loadConfig();

  /**
   * Envia uma notificação Slack.
   * Usa o webhook da regra se presente; caso contrário usa o webhook global de SLACK_WEBHOOK_URL.
   * Devolve slackSent=false sem lançar erro se o envio falhar.
   */
  async sendAlert(payload: AlertNotificationPayload): Promise<AlertNotificationResult> {
    const webhookUrl = payload.slackWebhookUrl ?? this.config.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        slackSent: false,
        emailSent: false,
      };
    }

    try {
      const webhook = new IncomingWebhook(webhookUrl);

      await webhook.send({
        text: payload.message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${payload.ruleName}*\n${payload.message}\nObserved: \`${payload.observedValue}\` | Threshold: \`${payload.threshold}\``,
            },
          },
        ],
      });

      logger.info('slack_alert_sent', {
        workspaceId: payload.workspaceId,
        ruleName: payload.ruleName,
      });

      return {
        slackSent: true,
        emailSent: false,
      };
    } catch (error) {
      logger.error('slack_alert_failed', {
        workspaceId: payload.workspaceId,
        ruleName: payload.ruleName,
        error: error instanceof Error ? error.message : 'unknown',
      });

      return {
        slackSent: false,
        emailSent: false,
      };
    }
  }
}
