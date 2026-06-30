/**
 * Definições — billing, plano, logout.
 */

import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useBillingInfo } from '@/hooks/useBillingInfo';
import { useCheckout } from '@/hooks/useCheckout';
import { UsageMeter } from '@/components/billing/UsageMeter';
import { QueryErrorPanel } from '@/components/dashboard/QueryErrorPanel';

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutStatus = searchParams.get('checkout');

  const user = useAuthStore((state) => state.user);
  const workspace = useAuthStore((state) => state.workspace);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const { data: billing, isLoading, isError, error, refetch } = useBillingInfo();
  const checkoutMutation = useCheckout();

  useEffect(() => {
    if (checkoutStatus) {
      setSearchParams({}, { replace: true });
    }
  }, [checkoutStatus, setSearchParams]);

  return (
    <div className="p-[18px] flex flex-col gap-[14px] min-h-full max-w-lg">
      <h1 className="text-primary text-base font-semibold">Definições</h1>

      {checkoutStatus === 'success' && (
        <p className="text-success text-xs">Subscrição ativada com sucesso!</p>
      )}
      {checkoutStatus === 'cancel' && <p className="text-muted text-xs">Checkout cancelado.</p>}

      <section className="flex flex-col gap-1">
        <span className="text-muted text-[10px] uppercase">Conta</span>
        <p className="text-primary text-sm">{user?.name ?? user?.email}</p>
        <p className="text-muted text-xs">{workspace?.name}</p>
      </section>

      {isError && <QueryErrorPanel message={(error as Error).message} onRetry={() => refetch()} />}

      {isLoading && <p className="text-muted text-xs">A carregar billing...</p>}

      {billing && <UsageMeter billing={billing} />}

      {billing && billing.plan === 'free' && (
        <div className="flex gap-2">
          <button
            onClick={() => checkoutMutation.mutate('pro')}
            disabled={checkoutMutation.isPending}
            className="text-xs bg-purple/15 text-purple px-4 py-2 rounded hover:bg-purple/25"
          >
            Upgrade Pro — $49/mês
          </button>
          <button
            onClick={() => checkoutMutation.mutate('business')}
            disabled={checkoutMutation.isPending}
            className="text-xs bg-blue/15 text-blue px-4 py-2 rounded hover:bg-blue/25"
          >
            Upgrade Business — $199/mês
          </button>
        </div>
      )}

      <button
        onClick={() => {
          clearAuth();
          window.location.href = '/login';
        }}
        className="text-xs text-danger mt-4 self-start hover:underline"
      >
        Terminar sessão
      </button>
    </div>
  );
}
