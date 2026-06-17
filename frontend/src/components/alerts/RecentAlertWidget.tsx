/**
 * Widget do dashboard — últimos eventos abertos.
 * Polling via useRecentAlertEvents; link para histórico completo.
 */

import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryErrorPanel } from '@/components/dashboard/QueryErrorPanel';
import { AlertEventStatusBadge } from './AlertStatusBadge';
import { useRecentAlertEvents } from '@/hooks/useRecentAlertEvents';
import { formatRelativeTime } from '@/lib/alert_formatters';

export function RecentAlertWidget() {
  const { data, isLoading, isError, error, refetch } = useRecentAlertEvents();

  const events = data?.events ?? [];
  const openCount = events.length;

  return (
    <Card className="accent-line-orange">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3.5">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-orange" aria-hidden />
          <CardTitle className="text-xs">Alertas recentes</CardTitle>
        </div>
        {openCount > 0 && (
          <span className="font-mono text-[10px] text-danger bg-danger/12 rounded-badge px-1.5 py-0.5">
            {openCount} aberto{openCount !== 1 ? 's' : ''}
          </span>
        )}
      </CardHeader>

      <CardContent className="px-3.5 pb-3.5 pt-0">
        {isError ? (
          <QueryErrorPanel
            message={error?.message ?? 'Erro ao carregar alertas'}
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <div className="space-y-2" aria-hidden="true">
            <div className="h-8 rounded bg-surface-card-hover animate-pulse" />
            <div className="h-8 rounded bg-surface-card-hover animate-pulse" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-xs text-faint py-4 text-center">Nenhum alerta aberto</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-default">
            {events.map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-2 py-2 first:pt-0">
                <div className="min-w-0">
                  <p className="text-xs text-copy truncate">{event.ruleName}</p>
                  <p className="font-mono text-[10px] text-orange truncate">
                    {/* message é sempre definido pelo backend via buildTriggerMessage() — o fallback é defensivo */}
                    {event.message ?? String(event.value)}
                  </p>
                  <p className="text-[10px] text-faint mt-0.5">
                    {formatRelativeTime(event.triggeredAt)}
                  </p>
                </div>
                <AlertEventStatusBadge resolvedAt={event.resolvedAt} />
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/alerts/events"
          className="mt-3 inline-block text-[11px] text-purple hover:underline"
        >
          Ver histórico completo →
        </Link>
      </CardContent>
    </Card>
  );
}
