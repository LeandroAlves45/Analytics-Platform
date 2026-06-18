/**
 * Histórico de eventos de alerta com filtro open / resolved / all.
 * O filtro altera queryKey do useAlertEvents — React Query refetch automático.
 *
 * O estado local `status` determina o queryKey — mudar o filtro não causa flash de lista vazia
 * porque o React Query mantém os dados anteriores (previousData) enquanto o novo pedido corre.
 *
 * aria-pressed nos botões de filtro comunica estado ao screen reader sem necessitar de
 * elementos role="radio" — padrão adequado para toggle group simples.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertEventsTable } from '@/components/alerts/AlertEventsTable';
import { QueryErrorPanel } from '@/components/dashboard/QueryErrorPanel';
import { useAlertEvents } from '@/hooks/useAlertEvents';
import type { AlertEventStatusFilter } from '@/types/alerts';
import { cn } from '@/lib/utils';

const STATUS_FILTERS: { value: AlertEventStatusFilter; label: string }[] = [
  { value: 'open', label: 'Abertos' },
  { value: 'resolved', label: 'Resolvidos' },
  { value: 'all', label: 'Todos' },
];

export function AlertEventsPage() {
  const [status, setStatus] = useState<AlertEventStatusFilter>('open');
  const { data, isLoading, isError, error, refetch } = useAlertEvents({
    limit: 20,
    status,
  });

  const events = data?.events ?? [];

  return (
    <div className="p-[18px] flex flex-col gap-[14px] min-h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5" asChild>
            <Link to="/alerts" aria-label="Voltar às regras">
              <ArrowLeft size={16} />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-copy tracking-tight">Histórico de alertas</h1>
            <p className="text-xs text-faint mt-1">
              Eventos disparados pelas regras activas nos últimos períodos.
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-1 rounded-sm border border-border-default p-0.5"
          role="group"
          aria-label="Filtrar por estado"
        >
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatus(filter.value)}
              aria-pressed={status === filter.value}
              className={cn(
                'px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors',
                status === filter.value
                  ? 'bg-purple/15 text-purple'
                  : 'text-faint hover:text-label hover:bg-surface-card-hover'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="rounded-card border border-border-default bg-surface-card">
          <QueryErrorPanel
            message={error?.message ?? 'Erro ao carregar eventos'}
            onRetry={() => void refetch()}
          />
        </div>
      ) : (
        <AlertEventsTable events={events} isLoading={isLoading} />
      )}
    </div>
  );
}
