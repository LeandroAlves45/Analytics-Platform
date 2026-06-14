/**
 * Página principal do dashboard
 */

import { KpiRow } from '@/components/dashboard/KpiRow';
import { LatencyChart } from '@/components/dashboard/LatencyChart';
import { StatusDonut } from '@/components/dashboard/StatusDonut';
import { ThroughputChart } from '@/components/dashboard/ThroughputChart';
import { ErrorRateChart } from '@/components/dashboard/ErrorRateChart';
import { EndpointsTable } from '@/components/dashboard/EndpointsTable';
import { EndpointFilter } from '@/components/dashboard/EndpointFilter';

export function DashboardPage() {
  return (
    <div className="p-[18px] flex flex-col gap-[14px] min-h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-copy tracking-tight">Dashboard</h1>
        <EndpointFilter />
      </div>

      <KpiRow />

      <div className="grid gap-[10px] grid-cols-1 lg:grid-cols-[2fr_1fr]">
        <LatencyChart />
        <StatusDonut />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
        <ErrorRateChart />
        <ThroughputChart />
      </div>

      <EndpointsTable />
    </div>
  );
}
