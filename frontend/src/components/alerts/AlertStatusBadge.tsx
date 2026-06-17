/**
 * Badge de estado para regras (activa/pausada) e eventos (aberto/resolvido).
 * Reutiliza variantes do Badge existente.
 */

import { Badge } from '@/components/ui/badge';
import type { AlertRuleStatus } from '@/types/alerts';
import { formatRuleStatusLabel, isAlertEventOpen } from '@/lib/alert_formatters';

interface AlertRuleStatusBadgeProps {
  status: AlertRuleStatus;
}

export function AlertRuleStatusBadge({ status }: AlertRuleStatusBadgeProps) {
  const variant = status === 'active' ? 'success' : 'warning';

  return (
    <Badge variant={variant} aria-label={`Estado: ${formatRuleStatusLabel(status)}`}>
      {formatRuleStatusLabel(status)}
    </Badge>
  );
}

interface AlertEventStatusBadgeProps {
  resolvedAt: string | null;
}

export function AlertEventStatusBadge({ resolvedAt }: AlertEventStatusBadgeProps) {
  const isOpen = isAlertEventOpen(resolvedAt);

  return (
    <Badge variant={isOpen ? 'danger' : 'success'} aria-label={isOpen ? 'Aberto' : 'Resolvido'}>
      {isOpen ? 'Aberto' : 'Resolvido'}
    </Badge>
  );
}
