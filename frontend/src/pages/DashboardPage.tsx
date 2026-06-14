/**
 * Página principal do dashboard
 *
 * Hierarquia de dados (sem prop drilling):
 *   KpiRow          → useAggregatedMetrics
 *   LatencyChart    → useAggregatedMetrics  ─┐ mesmo queryKey →
 *   StatusDonut     → useAggregatedMetrics   ├ React Query deduplica
 *   ThroughputChart → useAggregatedMetrics   ┘ num único fetch HTTP
 *   EndpointsTable  → useAggregatedMetrics
 *   EndpointFilter  → useActiveEndpoints (query separada, polling 60s)
 *
 * O DashboardPage não lê nenhum hook directamente.
 * É um organizador de layout: sabe o quê e onde, não o como.
 */

import { KpiRow } from '@/components/dashboard/KpiRow';
import { LatencyChart } from '@/components/dashboard/LatencyChart';
import { StatusDonut } from '@/components/dashboard/StatusDonut';
import { ThroughputChart } from '@/components/dashboard/ThroughputChart';
import { EndpointsTable } from '@/components/dashboard/EndpointsTable';
import { EndpointFilter } from '@/components/dashboard/EndpointFilter';

export function DashboardPage() {
  return (
    <div className="p-[18px] flex flex-col gap-[14px] min-h-full">
      {/* ── Cabeçalho da página ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-copy tracking-tight">Dashboard</h1>
        {/* Filtros de endpoint e método — ligados ao Zustand store */}
        <EndpointFilter />
      </div>

      {/* ── Row 1: KPI cards ── */}
      <KpiRow />

      {/* ── Row 2: Latência (maior) + Donut de status (menor) ── */}
      <div className="grid gap-[10px]" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <LatencyChart />
        <StatusDonut />
      </div>

      {/* ── Row 3: Tabela de endpoints + Throughput (50% / 50%) ── */}
      <div className="grid grid-cols-2 gap-[10px]">
        <EndpointsTable />
        <ThroughputChart />
      </div>
    </div>
  );
}
