/**
 * Linha da tabela de regras na AlertsPage — acções inline (editar, pausar, eliminar).
 */

import { Pencil, Pause, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertRuleStatusBadge } from './AlertStatusBadge';
import { formatConditionLabel } from '@/lib/alert_formatters';
import type { AlertRule } from '@/types/alerts';

export interface AlertRuleRowProps {
  rule: AlertRule;
  onEdit: (rule: AlertRule) => void;
  onTogglePause: (rule: AlertRule) => void;
  onDelete: (rule: AlertRule) => void;
  isBusy?: boolean;
}

export function AlertRuleRow({
  rule,
  onEdit,
  onTogglePause,
  onDelete,
  isBusy = false,
}: AlertRuleRowProps) {
  const isInactive = rule.status === 'inactive';

  return (
    <tr className="border-b border-border-default last:border-b-0 hover:bg-surface-card-hover/50">
      <td className="py-2.5 px-3 text-xs text-copy font-medium">{rule.name}</td>
      <td className="py-2.5 px-3 font-mono text-[11px] text-orange">
        {formatConditionLabel(rule.condition, rule.threshold)}
      </td>
      <td className="py-2.5 px-3 font-mono text-[11px] text-meta">{rule.windowMinutes}m</td>
      <td className="py-2.5 px-3">
        <AlertRuleStatusBadge status={rule.status} />
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isBusy}
            onClick={() => onEdit(rule)}
            aria-label={`Editar ${rule.name}`}
          >
            <Pencil size={13} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isBusy}
            onClick={() => onTogglePause(rule)}
            aria-label={isInactive ? `Activar ${rule.name}` : `Desactivar ${rule.name}`}
          >
            {isInactive ? <Play size={13} /> : <Pause size={13} />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-danger hover:text-danger"
            disabled={isBusy}
            onClick={() => onDelete(rule)}
            aria-label={`Eliminar ${rule.name}`}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </td>
    </tr>
  );
}
