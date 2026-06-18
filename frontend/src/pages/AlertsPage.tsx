/**
 * Página de gestão de regras de alerta — listagem + CRUD inline.
 * Mutations invalidam cache via hooks; erros de rede usam QueryErrorPanel.
 *
 * FormMode controla qual secção é visível:
 *   'closed' → apenas tabela de regras.
 *   'create' → formulário vazio acima da tabela.
 *   'edit'   → formulário pré-preenchido com editingRule acima da tabela.
 *
 * isMutating bloqueia todas as acções inline enquanto qualquer mutation corre —
 * evita duplos cliques e race conditions entre create/update/delete paralelos.
 *
 * window.confirm para delete: aceitável em MVP. Substituir por Dialog shadcn/ui em Sprint 7.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertRuleForm } from '@/components/alerts/AlertRuleForm';
import { AlertRuleRow } from '@/components/alerts/AlertRuleRow';
import { QueryErrorPanel } from '@/components/dashboard/QueryErrorPanel';
import { useAlertRules } from '@/hooks/useAlertRules';
import { useCreateAlertRule } from '@/hooks/useCreateAlertRule';
import { useUpdateAlertRule } from '@/hooks/useUpdateAlertRule';
import { useDeleteAlertRule } from '@/hooks/useDeleteAlertRule';
import type { AlertRule, CreateAlertRuleInput } from '@/types/alerts';

type FormMode = 'closed' | 'create' | 'edit';

export function AlertsPage() {
  const { data, isLoading, isError, error, refetch } = useAlertRules();
  const createMutation = useCreateAlertRule();
  const updateMutation = useUpdateAlertRule();
  const deleteMutation = useDeleteAlertRule();

  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [editingRule, setEditingRule] = useState<AlertRule | undefined>();

  const rules = data?.rules ?? [];
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  function openCreateForm() {
    setEditingRule(undefined);
    setFormMode('create');
  }

  function openEditForm(rule: AlertRule) {
    setEditingRule(rule);
    setFormMode('edit');
  }

  function closeForm() {
    setEditingRule(undefined);
    setFormMode('closed');
  }

  function handleCreate(input: CreateAlertRuleInput) {
    createMutation.mutate(input, {
      onSuccess: () => closeForm(),
    });
  }

  function handleUpdate(input: CreateAlertRuleInput) {
    if (!editingRule) {
      return;
    }
    updateMutation.mutate(
      {
        id: editingRule.id,
        input,
      },
      {
        onSuccess: () => closeForm(),
      }
    );
  }

  function handleTogglePause(rule: AlertRule) {
    const nextStatus = rule.status === 'active' ? 'inactive' : 'active';
    updateMutation.mutate({ id: rule.id, input: { status: nextStatus } });
  }

  function handleDelete(rule: AlertRule) {
    const confirmed = window.confirm(`Eliminar a regra "${rule.name}"?`);
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(rule.id);
  }

  return (
    <div className="p-[18px] flex flex-col gap-[14px] min-h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-copy tracking-tight">Alertas</h1>
          <p className="text-xs text-faint mt-1">
            Define regras de threshold e recebe notificações Slack ou email.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/alerts/events">Ver eventos</Link>
          </Button>
          <Button size="sm" onClick={openCreateForm} disabled={formMode !== 'closed'}>
            <Plus size={14} />
            Nova regra
          </Button>
        </div>
      </div>

      {formMode === 'create' && (
        <AlertRuleForm
          submitLabel="Criar regra"
          isSubmitting={createMutation.isPending}
          onSubmit={handleCreate}
          onCancel={closeForm}
        />
      )}

      {formMode === 'edit' && editingRule && (
        <AlertRuleForm
          initialRule={editingRule}
          submitLabel="Atualizar regra"
          isSubmitting={updateMutation.isPending}
          onSubmit={handleUpdate}
          onCancel={closeForm}
        />
      )}

      {isError ? (
        <div className="rounded-card border border-border-default bg-surface-card">
          <QueryErrorPanel
            message={error?.message ?? 'Erro ao carregar regras'}
            onRetry={() => void refetch()}
          />
        </div>
      ) : (
        <div className="rounded-card border border-border-default bg-surface-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-default bg-app/40">
                <th className="py-2 px-3 text-2xs font-semibold uppercase tracking-widest text-meta">
                  Nome
                </th>
                <th className="py-2 px-3 text-2xs font-semibold uppercase tracking-widest text-meta">
                  Condição
                </th>
                <th className="py-2 px-3 text-2xs font-semibold uppercase tracking-widest text-meta">
                  Janela
                </th>
                <th className="py-2 px-3 text-2xs font-semibold uppercase tracking-widest text-meta">
                  Estado
                </th>
                <th className="py-2 px-3 text-2xs font-semibold uppercase tracking-widest text-meta text-right">
                  Acções
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-faint">
                    A carregar regras...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-faint">
                    Nenhuma regra configurada. Cria a primeira com "Nova regra".
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <AlertRuleRow
                    key={rule.id}
                    rule={rule}
                    onEdit={openEditForm}
                    onTogglePause={handleTogglePause}
                    onDelete={handleDelete}
                    isBusy={isMutating}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
