/**
 * Contrato para envio de notificações de alerta.
 * Implementações: SlackWebhookGateway, NodemailerEmailService, NoOpNotificationGateway.
 */

export interface AlertNotificationPayload {
  ruleName: string;
  message: string;
  observedValue: number;
  threshold: number;
  condition: string;
  workspaceId: string;
  slackWebhookUrl?: string | null;
  emailAddresses?: string[];
}

export interface AlertNotificationResult {
  slackSent: boolean;
  emailSent: boolean;
}

export interface NotificationGateway {
  sendAlert(payload: AlertNotificationPayload): Promise<AlertNotificationResult>;
}
