/**
 * Gateway de email via SMTP (nodemailer).
 * Complementa SlackWebhookGateway — ambos podem ser compostos no bootstrap.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import type {
  AlertNotificationPayload,
  AlertNotificationResult,
  NotificationGateway,
} from '@application/contracts/gateways';
import { loadConfig } from '@infra/frameworks/config';
import { logger } from '@infra/frameworks/logging';

export class NodemailerEmailService implements NotificationGateway {
  private readonly config = loadConfig();
  private transporter: Transporter | null = null;

  private esc(value: string | number): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Envia um email de alerta via SMTP.
   * Devolve emailSent=false sem lançar erro se: não houver destinatários, SMTP não configurado, ou envio falhar.
   */
  async sendAlert(payload: AlertNotificationPayload): Promise<AlertNotificationResult> {
    const recipients = payload.emailAddresses ?? [];

    if (recipients.length === 0) {
      return {
        slackSent: false,
        emailSent: false,
      };
    }

    if (!this.config.SMTP_HOST || !this.config.SMTP_FROM) {
      logger.warn('smtp_not_configured', {
        workspaceId: payload.workspaceId,
      });

      return {
        slackSent: false,
        emailSent: false,
      };
    }

    try {
      const transporter = this.getTransporter();

      await transporter.sendMail({
        from: this.config.SMTP_FROM,
        to: recipients.join(','),
        subject: `[Alert] ${payload.ruleName}`,
        text: payload.message,
        html: `<p><strong>${this.esc(payload.ruleName)}</strong></p><p>${this.esc(payload.message)}</p><p>Observed: ${this.esc(payload.observedValue)} | Threshold: ${this.esc(payload.threshold)}</p>`,
      });

      logger.info('email_alert_sent', {
        workspaceId: payload.workspaceId,
        recipientCount: recipients.length,
      });

      return {
        slackSent: false,
        emailSent: true,
      };
    } catch (error) {
      logger.error('email_alert_failed', {
        workspaceId: payload.workspaceId,
        error: error instanceof Error ? error.message : 'unknown',
      });

      return {
        slackSent: false,
        emailSent: false,
      };
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.SMTP_HOST,
      port: this.config.SMTP_PORT ?? 587,
      secure: (this.config.SMTP_PORT ?? 587) === 465,
      auth:
        this.config.SMTP_USER && this.config.SMTP_PASSWORD
          ? {
              user: this.config.SMTP_USER,
              pass: this.config.SMTP_PASSWORD,
            }
          : undefined,
    });

    return this.transporter;
  }
}
