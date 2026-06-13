/**
 * Página principal do dashboard —> placeholder temporário.
 */

export function DashboardPage() {
  return (
    <div className="p-[18px] flex flex-col gap-[14px]">
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-copy tracking-tight">Dashboard</h1>
        <p className="text-xs text-faint">KPI cards e gráficos — próximo passo</p>
      </div>

      {/* Placeholder visual que confirma o layout está funcional */}
      <div className="rounded-card border border-border-default bg-surface-card p-8 flex items-center justify-center">
        <p className="text-sm text-label">Layout funcional. KPI cards no próximo passo.</p>
      </div>
    </div>
  );
}
