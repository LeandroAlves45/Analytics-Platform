/**
 * Payload de um job de agregação colocado na queue.
 *
 * Cada job representa uma janela de tempo específica para um endpoint
 * de um workspace. O worker usa estes dados para:
 * 1. Ler as métricas raw correspondentes da base de dados
 * 2. Calcular os percentis e contagens de status code
 * 3. Persistir o resultado na tabela de agregação correcta
 */
export interface ScheduleAggregationInput {
  /** UUID do workspace */
  workspaceId: string;

  /** Caminho do endpoint (ex.: `/api/users`) */
  endpoint: string;

  /** Método HTTP (ex.: `GET`, `POST`) */
  method: string;

  /** Duração da janela de tempo em minutos */
  intervalMinutes: number;
}

/**
 * Metadados comuns a todos os resultados de agregação.
 *
 * Presentes quer existam métricas na janela quer não.
 */
interface AggregationResultBase {
  /** Número de métricas raw processadas nesta janela */
  processedCount: number;

  /** Discriminante da union — indica se as estatísticas foram calculadas */
  hasData: boolean;

  /** UUID do workspace processado */
  workspaceId: string;

  /** Endpoint processado */
  endpoint: string;

  /** Método HTTP processado */
  method: string;

  /** Duração da janela processada, em minutos */
  intervalMinutes: number;
}

/**
 * Estatísticas de latência e status code calculadas sobre métricas raw.
 *
 * Só presentes quando `hasData` é `true`. Os percentis usam interpolação
 * linear (equivalente ao `percentile_cont()` do PostgreSQL).
 */
interface AggregationStatistics {
  /** Percentil 50 de latência, em milissegundos */
  latencyP50: number;

  /** Percentil 75 de latência, em milissegundos */
  latencyP75: number;

  /** Percentil 95 de latência, em milissegundos */
  latencyP95: number;

  /** Percentil 99 de latência, em milissegundos */
  latencyP99: number;

  /** Latência média, em milissegundos */
  latencyAvg: number;

  /** Latência mínima observada, em milissegundos */
  latencyMin: number;

  /** Latência máxima observada, em milissegundos */
  latencyMax: number;

  /** Respostas com status 2xx */
  status2xxCount: number;

  /** Respostas com status 3xx */
  status3xxCount: number;

  /** Respostas com status 4xx */
  status4xxCount: number;

  /** Respostas com status 5xx */
  status5xxCount: number;
}

/**
 * Resultado devolvido pelo AggregateMetricsUseCase após processar um job.
 *
 * Union discriminada por `hasData`:
 * - `hasData: false` — sem métricas para o par endpoint/método na janela;
 *   contém apenas metadados (`processedCount` será 0).
 * - `hasData: true` — estatísticas completas de latência e contagens por
 *   família de status code, prontas para persistência na BD.
 *
 * O worker usa este tipo para logging e para gravar na tabela de agregação.
 */
export type AggregationResult =
  | (AggregationResultBase & { hasData: false })
  | (AggregationResultBase & { hasData: true } & AggregationStatistics);
