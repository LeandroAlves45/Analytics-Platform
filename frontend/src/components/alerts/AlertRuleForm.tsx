/**
 * Formulário de criação/edição de regra de alerta.
 * Controlado pelo pai (AlertsPage) — não faz fetch directo para manter
 * uma única fonte de verdade no modo create vs edit.
 *
 * Âmbito MVP: o formulário não expõe os campos `endpoint` e `method`.
 * Regras criadas pela UI são workspace-wide (avaliam todas as rotas).
 * Para regras por endpoint específico, editar directamente via API.
 * Campos `endpoint`/`method` existem em CreateAlertRuleInput para uso futuro.
 *
 * Validação client-side cobre: name obrigatório, threshold e windowMinutes numéricos.
 * O backend valida canal de notificação (slackWebhookUrl OU emailAddresses obrigatório)
 * e devolve 422 se ambos estiverem vazios — o QueryErrorPanel trata esse caso.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AlertConditionMetric, AlertRule, CreateAlertRuleInput } from '@/types/alerts';

const CONDITION_OPTIONS: { value: AlertConditionMetric; label: string }[] = [
  { value: 'latency_p95', label: 'P95 Latency (ms)' },
  { value: 'error_rate', label: 'Error Rate (0-1)' },
  { value: 'status_5xx_count', label: '5xx Count' },
];

const inputClassName =
  'w-full h-8 rounded-sm border border-border-default bg-app px-2.5 text-xs text-copy placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-purple/40';

export interface AlertRuleFormProps {
  initialRule?: AlertRule;
  isSubmitting?: boolean;
  submitLabel?: string;
  onSubmit: (input: CreateAlertRuleInput) => void;
  onCancel: () => void;
}

export function AlertRuleForm({
  initialRule,
  isSubmitting = false,
  submitLabel = 'Guardar',
  onSubmit,
  onCancel,
}: AlertRuleFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<AlertConditionMetric>('latency_p95');
  const [threshold, setThreshold] = useState('500');
  const [windowMinutes, setWindowMinutes] = useState('5');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [emailAddresses, setEmailAddresses] = useState('');

  useEffect(() => {
    if (!initialRule) {
      return;
    }

    setName(initialRule.name);
    setDescription(initialRule.description ?? '');
    setCondition(initialRule.condition);
    setThreshold(String(initialRule.threshold));
    setWindowMinutes(String(initialRule.windowMinutes));
    setSlackWebhookUrl(initialRule.slackWebhookUrl ?? '');
    setEmailAddresses(initialRule.emailAddresses.join(', '));
  }, [initialRule]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedThreshold = Number(threshold);
    const parsedWindow = Number(windowMinutes);

    if (!name.trim() || Number.isNaN(parsedThreshold) || Number.isNaN(parsedWindow)) {
      return;
    }

    const emails = emailAddresses
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      condition,
      threshold: parsedThreshold,
      windowMinutes: parsedWindow,
      slackWebhookUrl: slackWebhookUrl.trim() || null,
      emailAddresses: emails,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-border-default bg-surface-card p-4 flex flex-col gap-3"
      aria-label={initialRule ? 'Editar regra de alerta' : 'Nova regra de alerta'}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-2xs font-semibold uppercase tracking-widest text-meta">Nome</span>
          <input
            className={inputClassName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="High P95 on /api/users"
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-2xs font-semibold uppercase tracking-widest text-meta">
            Descrição
          </span>
          <input
            className={inputClassName}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-semibold uppercase tracking-widest text-meta">
            Condição
          </span>
          <Select value={condition} onValueChange={(v) => setCondition(v as AlertConditionMetric)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-semibold uppercase tracking-widest text-meta">
            Threshold
          </span>
          <input
            className={`${inputClassName} font-mono`}
            type="number"
            step="any"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-semibold uppercase tracking-widest text-meta">
            Janela (min)
          </span>
          <input
            className={`${inputClassName} font-mono`}
            type="number"
            min={1}
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-2xs font-semibold uppercase tracking-widest text-meta">
            Slack Webhook URL
          </span>
          <input
            className={inputClassName}
            value={slackWebhookUrl}
            onChange={(e) => setSlackWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/..."
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-2xs font-semibold uppercase tracking-widest text-meta">
            Emails (separados por vírgula)
          </span>
          <input
            className={inputClassName}
            value={emailAddresses}
            onChange={(e) => setEmailAddresses(e.target.value)}
            placeholder="dev@example.com, oncall@example.com"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'A guardar...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
