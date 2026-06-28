/**
 * Testes unitários do gateway composto de notificações.
 *
 * Cobrem: agregação de flags `slackSent`/`emailSent` entre múltiplos gateways,
 * comportamento quando todos falham e fan-out do mesmo payload para cada gateway.
 * Gateways individuais são mockados — sem Slack nem email real.
 */

import { CompositeNotificationGateway } from '@infra/gateways/CompositeNotificationGateway';
import type {
  AlertNotificationPayload,
  NotificationGateway,
} from '@application/contracts/gateways';

/** Payload de alerta reutilizado em todos os cenários de envio. */
const PAYLOAD: AlertNotificationPayload = {
  ruleName: 'High p95 latency',
  message: 'threshold exceeded',
  observedValue: 600,
  threshold: 500,
  condition: 'latency_p95',
  workspaceId: '11111111-1111-4111-8111-111111111111',
};

/**
 * Cria um mock de `NotificationGateway` com resultado fixo de envio.
 *
 * @param result - Flags `slackSent` e `emailSent` devolvidas por `sendAlert`.
 */
function makeGateway(result: {
  slackSent: boolean;
  emailSent: boolean;
}): jest.Mocked<NotificationGateway> {
  return { sendAlert: jest.fn().mockResolvedValue(result) };
}

describe('CompositeNotificationGateway', () => {
  it('should aggregate slackSent and emailSent from all gateways', async () => {
    const slack = makeGateway({ slackSent: true, emailSent: false });
    const email = makeGateway({ slackSent: false, emailSent: true });
    const composite = new CompositeNotificationGateway([slack, email]);

    const result = await composite.sendAlert(PAYLOAD);

    expect(result).toEqual({ slackSent: true, emailSent: true });
  });

  it('should return false for both flags when all gateways return false', async () => {
    const noop = makeGateway({ slackSent: false, emailSent: false });
    const composite = new CompositeNotificationGateway([noop, noop]);

    const result = await composite.sendAlert(PAYLOAD);

    expect(result).toEqual({ slackSent: false, emailSent: false });
  });

  it('should call sendAlert on every gateway with the same payload', async () => {
    const g1 = makeGateway({ slackSent: true, emailSent: false });
    const g2 = makeGateway({ slackSent: false, emailSent: true });
    const composite = new CompositeNotificationGateway([g1, g2]);

    await composite.sendAlert(PAYLOAD);

    expect(g1.sendAlert).toHaveBeenCalledWith(PAYLOAD);
    expect(g2.sendAlert).toHaveBeenCalledWith(PAYLOAD);
  });
});
