/**
 * Gateway noop para testes e desenvolvimento local.
 * Nunca envia notificações reais — descarta silenciosamente todos os alertas.
 */

import type {
  AlertNotificationPayload,
  AlertNotificationResult,
  NotificationGateway,
} from '@application/contracts/gateways';

export class NoOpNotificationGateway implements NotificationGateway {
  async sendAlert(_payload: AlertNotificationPayload): Promise<AlertNotificationResult> {
    return {
      slackSent: false,
      emailSent: false,
    };
  }
}
