/**
 * KPI-style usage meter — barra de progresso do consumo mensal.
 */

import { cn } from '@/lib/utils';
import type { BillingInfo } from '@/types/billing';

interface UsageMeterProps {
  billing: BillingInfo;
}

export function UsageMeter({ billing }: UsageMeterProps) {
  const formattedUsed = billing.requestsTracked.toLocaleString('pt-PT');
  const formattedLimit = billing.requestsLimit.toLocaleString('pt-PT');

  // Cor da barra escala com a proximidade do limite — sinaliza risco antes de bloquear ingestão.
  const isAtLimit = billing.usagePercentage >= 100;
  const isNearLimit = billing.usagePercentage >= 80;

  return (
    <div className="bg-surface-card border border-default rounded p-4 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-muted text-[10px] uppercase font-semibold">Uso mensal</span>
        <span className="text-muted text-[10px] capitalize">{billing.plan}</span>
      </div>
      <div className="font-mono text-primary text-xl">
        {formattedUsed}
        <span className="text-muted text-xs ml-1">/ {formattedLimit}</span>
      </div>
      <div className="h-1.5 bg-surface-card-hover rounded overflow-hidden">
        <div
          className={cn(
            'h-full rounded',
            isAtLimit
              ? 'bg-danger'
              : isNearLimit
                ? 'bg-warning'
                : 'bg-gradient-to-r from-purple to-blue'
          )}
          style={{ width: `${billing.usagePercentage}%` }}
        />
      </div>
      <p className={cn('text-[10px]', isAtLimit ? 'text-danger' : 'text-muted')}>
        {billing.usagePercentage}% do limite mensal
        {isAtLimit && ' — limite atingido'}
      </p>
    </div>
  );
}
