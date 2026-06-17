/**
 * Tabela reutilizável de eventos — usada na AlertEventsPage.
 * Aceita dados via props para manter o fetch no pai (filtro de status).
 */

import { AlertEventStatusBadge } from './AlertStatusBadge';
import { formatRelativeTime, isAlertEventOpen } from '@/lib/alert_formatters';
import type { AlertEvent } from '@/types/alerts';

export interface AlertEventsTableProps {
  events: AlertEvent[];
  isLoading?: boolean;
}

export function AlertEventsTable({ events, isLoading = false }: AlertEventsTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-card border border-border-default bg-surface-card p-4 space-y-2">
        <div className="h-6 rounded bg-surface-card-hover animate-pulse" />
        <div className="h-6 rounded bg-surface-card-hover animate-pulse" />
        <div className="h-6 rounded bg-surface-card-hover animate-pulse" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-card border border-border-default bg-surface-card py-12 text-center">
        <p className="text-xs text-faint">Nenhum evento encontrado</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border-default bg-surface-card overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border-default bg-app/40">
            <th className="py-2 px-3 text-2xs font-semibold uppercase tracking-widest text-meta">
              Regra
            </th>
            <th className="py-2 px-3 text-2xs font-semibold uppercase tracking-widest text-meta">
              Valor
            </th>
            <th className="py-2 px-3 text-2xs font-semibold uppercase tracking-widest text-meta">
              Disparo
            </th>
            <th className="py-2 px-3 text-2xs font-semibold uppercase tracking-widest text-meta">
              Estado
            </th>
            <th className="py-2 px-3 text-2xs font-semibold uppercase tracking-widest text-meta">
              Notificações
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.id}
              className="border-b border-border-default last:border-b-0 hover:bg-surface-card-hover/50"
            >
              <td className="py-2.5 px-3 text-xs text-copy">{event.ruleName}</td>
              <td className="py-2.5 px-3 font-mono text-[11px] text-orange">
                {/* AlertEvent não tem campo condition — usar message (sempre definido pelo backend) */}
                {event.message ?? String(event.value)}
              </td>
              <td className="py-2.5 px-3 text-[11px] text-faint">
                {formatRelativeTime(event.triggeredAt)}
              </td>
              <td className="py-2.5 px-3">
                <AlertEventStatusBadge resolvedAt={event.resolvedAt} />
              </td>
              <td className="py-2.5 px-3 text-[10px] text-meta">
                {event.slackSent && <span className="mr-2">Slack ✓</span>}
                {event.emailSent && <span>Email ✓</span>}
                {!event.slackSent && !event.emailSent && '—'}
                {!isAlertEventOpen(event.resolvedAt) && event.resolvedAt && (
                  <span className="block text-faint mt-0.5">
                    resolvido {formatRelativeTime(event.resolvedAt)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
