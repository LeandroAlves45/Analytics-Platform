/**
 * Componente KpiCard —> apresentacional, sem lógica de dados.
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * AccentColor define qual gradiente aparece no topo do card.
 * Mapeado para as classes CSS em src/index.css (@layer utilities).
 */
type AccentColor = 'purple' | 'blue' | 'orange' | 'green';

/**
 * Lookup explícito de classes para evitar construção dinâmica de strings
 * ("accent-line-" + accent) que quebraria o purge do Tailwind.
 */
const ACCENT_LINE: Record<AccentColor, string> = {
  purple: 'accent-line-purple',
  blue: 'accent-line-blue',
  orange: 'accent-line-orange',
  green: 'accent-line-green',
};

/**
 * Delta props -> tendência comparativa (primeira metade vs segundo metade do período)
 */
interface DeltaProps {
  text: string;
  direction: 'up' | 'down' | 'neutral';
  // isPositiveWhenUp: define a semântica da direcção para esta métrica.
  isPositiveWhenUp: boolean;
}

export interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  accent: AccentColor;
  delta?: DeltaProps;
  isLoading?: boolean;
}

/**
 *  Determina a classe de cor do delta com base na direcção e na semântica da métrica.
 *  Separa "direcção do valor" de "se essa direcção é boa ou má".
 */
function getDeltaColorClass(direction: DeltaProps['direction'], isPositiveWhenUp: boolean): string {
  if (direction === 'neutral') return 'text-meta';
  const isGood = direction === 'up' ? isPositiveWhenUp : !isPositiveWhenUp;
  return isGood ? 'text-success' : 'text-orange';
}

export function KpiCard({ label, value, unit, accent, delta, isLoading = false }: KpiCardProps) {
  return (
    <Card className={ACCENT_LINE[accent]}>
      <CardContent className="p-3.5">
        {isLoading ? (
          // Skeleton de carregamento —> mostrado apenas no primeiro fetch
          // Após o primeiro fetch, o React Query mantém os dados em cache
          // e o polling subsequente não mostra skeleton (isFetching, não isLoading)
          <div className="space-y-2.5" aria-hidden="true">
            <div className="h-2.5 w-16 rounded bg-surface-card-hover animate-pulse" />
            <div className="h-7 w-24 rounded bg-surface-card-hover animate-pulse" />
            <div className="h-2 w-12 rounded bg-surface-card-hover animate-pulse" />
          </div>
        ) : (
          <>
            {/* Label da métrica — uppercase, tracking largo, hierarquia visual mínima */}
            <p className="text-2xs font-semibold uppercase tracking-widest text-meta mb-2 leading-none">
              {label}
            </p>

            {/* Valor principal em DM Mono + unidade opcional em tamanho menor */}
            <div className="flex items-baseline gap-1 mb-2">
              <span className="font-mono text-kpi font-semibold text-copy leading-none tracking-tight">
                {value}
              </span>
              {unit && (
                <span className="font-mono text-xs text-meta font-normal leading-none">{unit}</span>
              )}
            </div>

            {/* Delta de tendência — só renderiza se o delta existir */}
            {delta && (
              <div
                className={cn(
                  'flex items-center gap-1 text-[10px] font-medium',
                  getDeltaColorClass(delta.direction, delta.isPositiveWhenUp)
                )}
              >
                {delta.direction === 'up' && <TrendingUp size={10} strokeWidth={2.5} aria-hidden />}
                {delta.direction === 'down' && (
                  <TrendingDown size={10} strokeWidth={2.5} aria-hidden />
                )}
                {delta.direction === 'neutral' && (
                  <Minus size={10} strokeWidth={2.5} className="text-meta" aria-hidden />
                )}
                <span>{delta.text}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
