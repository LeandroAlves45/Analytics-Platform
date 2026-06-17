/**
 * Compõe Slack + Email num único NotificationGateway.
 * Usado em produção no bootstrap.
 */

import type {
  AlertNotificationPayload,
  AlertNotificationResult,
  NotificationGateway,
} from '@application/contracts/gateways';

export class CompositeNotificationGateway implements NotificationGateway {
  constructor(private readonly gateways: NotificationGateway[]) {}

  /**
   * Envia o alerta para todos os gateways em paralelo.
   * O resultado é a união dos flags: slackSent=true se qualquer gateway Slack enviar,
   * emailSent=true se qualquer gateway Email enviar.
   * Falhas individuais são tratadas internamente por cada gateway — não propagam aqui.
   */
  async sendAlert(payload: AlertNotificationPayload): Promise<AlertNotificationResult> {
    const results = await Promise.all(this.gateways.map((gateway) => gateway.sendAlert(payload)));

    return {
      slackSent: results.some((result) => result.slackSent),
      emailSent: results.some((result) => result.emailSent),
    };
  }
}
