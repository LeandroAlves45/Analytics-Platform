/**
 * Página de gestão de API keys — CRUD inline.
 *
 * FormMode: closed | create — padrão AlertsPage.
 * Após criar, mostra plaintextKey num banner copiável (única visualização).
 */

import { useState } from 'react';
import { useApiKeys } from '@/hooks/useApiKeys';
import { useCreateApiKey } from '@/hooks/useCreateApiKey';
import { useRevokeApiKey } from '@/hooks/useRevokeApiKey';
import { useAuthStore } from '@/stores/authStore';
import { QueryErrorPanel } from '@/components/dashboard/QueryErrorPanel';

type FormMode = 'closed' | 'create';

export function ApiKeysPage() {
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [name, setName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);

  const workspaceId = useAuthStore((state) => state.workspace?.id);
  const { data, isLoading, isError, error, refetch } = useApiKeys();
  const createMutation = useCreateApiKey();
  const revokeMutation = useRevokeApiKey();

  // Enquanto o workspace ainda não hidratou do localStorage, a query fica `enabled: false`
  // e isLoading é false (idle) — sem este OR a tabela mostra "vazio" antes de "a carregar".
  const isResolvingKeys = !workspaceId || isLoading;

  const isBusy = createMutation.isPending || revokeMutation.isPending;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createMutation.mutateAsync(name);
    setRevealedKey(result.plaintextKey);
    setFormMode('closed');
    setName('');
  };

  const handleCopy = () => {
    if (!revealedKey) {
      return;
    }
    navigator.clipboard.writeText(revealedKey).catch(() => {
      setCopyError(true);
    });
  };

  return (
    <div className="p-[18px] flex flex-col gap-[14px] min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-primary text-base font-semibold">API Keys</h1>
          <p className="text-muted text-xs">Chaves para o SDK enviar métricas</p>
        </div>
        {formMode === 'closed' && (
          <button
            onClick={() => setFormMode('create')}
            disabled={isBusy}
            className="text-xs bg-purple/15 text-purple px-3 py-1.5 rounded hover:bg-purple/25 disabled:opacity-50"
          >
            Nova chave
          </button>
        )}
      </div>

      {revealedKey && (
        <div className="bg-purple/10 border border-purple/30 rounded p-3 flex flex-col gap-2">
          <p className="text-xs text-warning">
            Copia esta chave agora, não será mostrada novamente.
          </p>
          <code className="font-mono text-xs text-primary break-all">{revealedKey}</code>
          <button onClick={handleCopy} className="text-xs text-purple self-start">
            Copiar
          </button>
          {copyError && (
            <p className="text-xs text-danger">
              Não foi possível copiar automaticamente. Seleciona o texto acima e copia manualmente.
            </p>
          )}
        </div>
      )}

      {formMode === 'create' && (
        <form onSubmit={handleCreate} className="flex gap-2 items-end">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da chave (ex: Production SDK)"
            className="flex-1 bg-surface-card border border-default rounded px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={isBusy}
            className="text-xs bg-purple/15 text-purple px-3 py-2 rounded"
          >
            Criar
          </button>
          <button
            type="button"
            onClick={() => setFormMode('closed')}
            className="text-xs text-muted px-2"
          >
            Cancelar
          </button>
        </form>
      )}

      {isError ? (
        <QueryErrorPanel message={(error as Error).message} onRetry={() => refetch()} />
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted border-b border-subtle">
              <th className="text-left py-2">Nome</th>
              <th className="text-left py-2">Preview</th>
              <th className="text-left py-2">Criada</th>
              <th className="text-right py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isResolvingKeys ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted">
                  A carregar...
                </td>
              </tr>
            ) : data?.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted">
                  Nenhuma API key criada
                </td>
              </tr>
            ) : (
              data?.map((key) => (
                <tr key={key.id} className="border-b border-subtle">
                  <td className="py-2 text-primary">{key.name}</td>
                  <td className="py-2 font-mono text-muted">...{key.keyPreview}</td>
                  <td className="py-2 text-muted">
                    {new Date(key.createdAt).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => {
                        if (window.confirm(`Revogar "${key.name}"?`)) {
                          revokeMutation.mutate(key.id);
                        }
                      }}
                      disabled={isBusy}
                      className="text-danger text-xs hover:underline disabled:opacity-50"
                    >
                      Revogar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
