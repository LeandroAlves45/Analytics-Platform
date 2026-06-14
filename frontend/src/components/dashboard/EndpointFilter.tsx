/**
 * Filtro do dashboard: dropdown de endpoint + chips de método HTTP.
 * Ligado ao Zustand store — qualquer mudança dispara um novo fetch
 * via React Query (o queryKey inclui selectedEndpoint e selectedMethod).
 *
 * Arquitectura de filtros:
 *   - Dropdown: filtra por path de endpoint específico (ou "todos")
 *   - Chips de método: filtra por método HTTP transversalmente a todos os endpoints
 *   - Os dois filtros são independentes e podem ser combinados
 *
 * Fonte de dados do dropdown: useActiveEndpoints (lookback 24h)
 * Independente do período seleccionado nos KPI cards — a lista de endpoints
 * disponíveis não deve mudar ao trocar o intervalo de 5m para 1h.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useActiveEndpoints } from '@/hooks/useActiveEndpoints';
import { cn } from '@/lib/utils';

/**
 * Métodos disponíveis como filtro.
 * 'ALL' é um valor especial que limpa o filtro (setMethod(undefined)).
 */
const METHOD_OPTIONS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type MethodOption = (typeof METHOD_OPTIONS)[number];

// Valor sentinela para o Select quando nenhum endpoint está seleccionado.
// 'all' é uma string que nunca coincide com um path real de endpoint.
const ALL_ENDPOINTS_VALUE = 'all';

/**
 * Componente principal
 */
export function EndpointFilter() {
  const { selectedEndpoint, selectedMethod, setEndpoint, setMethod } = useDashboardStore();

  // Dados de endpoints activos para popular o dropdown.
  // Polling a 60s (definido no hook) — a lista não muda frequentemente.
  const { data: endpointsData } = useActiveEndpoints();

  // Paths únicos ordenados alfabeticamente.
  // Deduplicados porque o mesmo path pode ter múltiplos métodos na lista.
  const uniquePaths: string[] = endpointsData?.endpoints
    ? [...new Set(endpointsData.endpoints.map((e) => e.endpoint))].sort()
    : [];

  // Método ativo visualmente -> undefined no store equivale a 'ALL'.
  const activeMethod: MethodOption = (selectedMethod as MethodOption | undefined) ?? 'ALL';

  // Radix Select exige que `value` corresponda a um SelectItem existente.
  const endpointSelectValue =
    selectedEndpoint != null && uniquePaths.length > 0 && !uniquePaths.includes(selectedEndpoint)
      ? ALL_ENDPOINTS_VALUE
      : (selectedEndpoint ?? ALL_ENDPOINTS_VALUE);

  // Handler do Select de endpoint.
  // Valor 'all' (sentinela) → limpa o filtro (undefined no store).
  function handleEndpointChange(value: string) {
    setEndpoint(value === ALL_ENDPOINTS_VALUE ? undefined : value);
  }

  // Handler dos chips de método.
  // 'ALL' → limpa o filtro do método (undefined no store).
  function handleMethodClick(method: MethodOption) {
    setMethod(method === 'ALL' ? undefined : method);
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Filtros do dashboard">
      {/* ── Select de endpoint ── */}
      <Select value={endpointSelectValue} onValueChange={handleEndpointChange}>
        <SelectTrigger className="w-[172px] h-7" aria-label="Filtrar por endpoint">
          <SelectValue placeholder="All endpoints" />
        </SelectTrigger>

        <SelectContent>
          {/* Opção para limpar o filtro */}
          <SelectItem value={ALL_ENDPOINTS_VALUE}>All endpoints</SelectItem>

          {/* Paths únicos derivados de useActiveEndpoints */}
          {uniquePaths.map((path) => (
            <SelectItem key={path} value={path}>
              {path}
            </SelectItem>
          ))}

          {uniquePaths.length === 0 && !endpointsData && (
            <SelectItem value="__loading__" disabled>
              A carregar...
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {/* Separador visual entre os dois filtros */}
      <div className="w-px h-4 bg-border-default shrink-0" aria-hidden="true" />

      {/* ── Chips de método HTTP ── */}
      <div className="flex items-center" role="group" aria-label="Filtrar por método HTTP">
        {METHOD_OPTIONS.map((method) => (
          <button
            key={method}
            onClick={() => handleMethodClick(method)}
            aria-pressed={activeMethod === method}
            className={cn(
              // Base: dimensão e tipografia consistentes com os chips do Topbar
              'px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors duration-150',
              activeMethod === method
                ? // Activo: fundo purple subtil + texto purple
                  'bg-purple/15 text-purple'
                : // Inactivo: texto meta, hover suave
                  'text-meta hover:text-label hover:bg-surface-card-hover'
            )}
          >
            {method}
          </button>
        ))}
      </div>
    </div>
  );
}
