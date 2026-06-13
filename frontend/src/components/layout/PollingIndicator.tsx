/**
 * Barra inferior de polling —> mostra o estado de atualização em tempo real.
 * Dois elementos: dot pulsante (dado vivo) + texto com tempo decorrido.
 *
 * Usa useQueryClient para ler directamente do cache do React Query
 * o timestamp da última atualização bem-sucedida.
 * Isto é mais preciso do que um timer local: só atualiza quando
 * os dados realmente chegam do servidor.
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AGGREGATED_METRICS_KEY } from '@/hooks/useAggregatedMetrics';
import { formatLastUpdated } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export function PollingIndicator() {
  const queryClient = useQueryClient();

  // Estado local para forçar re-render a cada segundo
  // Necessário porque o texto "Xs ago" precisa de actualizar
  // mesmo sem novos dados do servidor
  const [, setTick] = useState(0);

  useEffect(() => {
    // Timer incrementa um contador a cada segundo apenas para forçar re-render
    const timer = setInterval(() => {
      setTick((tick) => tick + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // isFetching: true enquanto qualquer query com a chave base está activa
  const isFetching =
    queryClient.isFetching({
      queryKey: [AGGREGATED_METRICS_KEY],
    }) > 0;

  // Prefix match: a key real inclui filtros (interval, from, to, …)
  const queries = queryClient.getQueryCache().findAll({
    queryKey: [AGGREGATED_METRICS_KEY],
  });

  const mostRecentUpdate = queries.reduce<number>(
    (latest, query) => Math.max(latest, query.state.dataUpdatedAt ?? 0),
    0
  );

  const lastUpdated = mostRecentUpdate > 0 ? new Date(mostRecentUpdate) : null;

  return (
    <div
      className="
        flex items-center gap-2
        h-6 px-5
        border-t border-border-subtle
      "
      aria-live="polite"
      aria-label="Estado de actualização automática"
    >
      {/* Dot pulsante — animação CSS definida no tailwind.config.ts */}
      {/* Muda de cor consoante o estado: purple (normal) ou blue (a fazer fetch) */}
      <span
        className={cn(
          'block h-[5px] w-[5px] rounded-full',
          isFetching ? 'animate-pulse bg-blue' : 'animate-pulse bg-purple'
        )}
      />

      <span className="text-[10px] text-faint">
        {isFetching
          ? 'Updating...'
          : lastUpdated
            ? `Auto-refresh every 10s — last updated ${formatLastUpdated(lastUpdated)}`
            : 'Auto-refresh every 10s'}
      </span>
    </div>
  );
}
