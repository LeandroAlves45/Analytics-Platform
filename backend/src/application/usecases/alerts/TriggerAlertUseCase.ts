/**
 * Use case para disparar um alerta.
 *
 * Garantias de ordem:
 *  1. Evento criado na BD com slackSent=false / emailSent=false ANTES de enviar notificação.
 *     → Se sendAlert falhar, o evento existe e o cooldown impede duplicados no próximo ciclo.
 *  2. Após envio bem-sucedido, updateNotificationStatus corrige os flags no evento.
 *     → Auditoria reflecte o estado real da entrega da notificação.
 *
 * Optimização de batch:
 *  Quando o chamador (EvaluateAlertsUseCase) já verificou eventos abertos via
 *  findOpenEventsBatch, passa knownOpenEvent para evitar query redundante.
 *  - undefined → TriggerAlertUseCase consulta findOpenEvent internamente.
 *  - null      → chamador confirmou ausência de evento aberto; skip da query.
 *  - DTO       → evento aberto encontrado; retorna imediatamente (cooldown).
 */

import type { AlertRepository } from '@application/contracts/repositories';
import type { NotificationGateway } from '@application/contracts/gateways';
import type { TriggerAlertInputDTO, TriggerAlertOutputDTO } from '@application/dto/AlertsDTO';
import { logger } from '@infra/frameworks/logging';

export class TriggerAlertUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly notificationGateway: NotificationGateway
  ) {}

  async execute(input: TriggerAlertInputDTO): Promise<TriggerAlertOutputDTO> {
    // Determinar se existe evento aberto — usa o valor pré-carregado pelo chamador
    // quando disponível (knownOpenEvent !== undefined) para evitar query extra.
    const openEvent =
      input.knownOpenEvent !== undefined
        ? input.knownOpenEvent
        : await this.alertRepository.findOpenEvent(input.rule.id);

    if (openEvent) {
      logger.info('alert_trigger_skipped_open_event', {
        alertRuleId: input.rule.id,
        openEventId: openEvent.id,
      });

      return {
        eventId: openEvent.id,
        slackSent: openEvent.slackSent,
        emailSent: openEvent.emailSent,
      };
    }

    // Criar o evento primeiro — activa o cooldown mesmo que a notificação falhe.
    const event = await this.alertRepository.createEvent({
      alertRuleId: input.rule.id,
      ruleName: input.rule.name,
      workspaceId: input.rule.workspaceId,
      value: input.observedValue,
      message: input.message,
      slackSent: false,
      emailSent: false,
    });

    let slackSent = false;
    let emailSent = false;

    try {
      const result = await this.notificationGateway.sendAlert({
        ruleName: input.rule.name,
        message: input.message,
        observedValue: input.observedValue,
        threshold: input.rule.threshold,
        condition: input.rule.condition,
        workspaceId: input.rule.workspaceId,
        slackWebhookUrl: input.rule.slackWebhookUrl,
        emailAddresses: input.rule.emailAddresses,
      });
      slackSent = result.slackSent;
      emailSent = result.emailSent;

      // Actualizar o evento com o resultado real da notificação.
      await this.alertRepository.updateNotificationStatus(event.id, slackSent, emailSent);
    } catch (error) {
      logger.error('alert_notification_failed', {
        alertRuleId: input.rule.id,
        eventId: event.id,
        error,
      });
    }

    logger.info('alert_triggered', {
      alertRuleId: input.rule.id,
      eventId: event.id,
      slackSent,
      emailSent,
    });

    return {
      eventId: event.id,
      slackSent,
      emailSent,
    };
  }
}
