import { randomUUID } from 'node:crypto';
import { ValidationError } from '@shared/errors';
import { isValidUuid } from '@shared/validation/uuid';

/**
 * Métodos HTTP válidos que o sistema aceita.
 * Definida como constante de domínio porque é uma regra de negócio,
 * não uma regra de HTTP framework.
 */
const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] as const;

/**
 * Tipo derivado de `VALID_HTTP_METHODS` para type-safety em tempo de compilação.
 * Garante que apenas métodos HTTP válidos são usados.
 */
export type HttpMethod = (typeof VALID_HTTP_METHODS)[number];

/**
 * Estrutura de dados necessária para criar uma Metric.
 * Todos os campos obrigatórios devem ser fornecidos;
 * campos opcionais podem ser omitidos.
 */
export interface CreateMetricInput {
  workspaceId: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  latencyMs: number;
  statusCode: number;
  payloadSizeBytes?: number;
  requestId: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Entidade Metric representa um único data point de API monitorizada.
 *
 * Responsabilidades:
 * - Validar todas as regras de negócio na construção (fail-fast)
 * - Manter imutabilidade (todas as propriedades readonly)
 * - Fornecer métodos de domínio para analisar saúde do request
 *
 * Regras de Negócio:
 * - workspaceId e apiKeyId: obrigatórios, não-vazios
 * - endpoint: obrigatório, deve começar com "/"
 * - method: deve ser um dos métodos HTTP válidos
 * - latencyMs: deve ser um número positivo
 * - statusCode: deve estar entre 100-599
 * - requestId: obrigatório (usado para idempotência)
 * - payloadSizeBytes: se fornecido, deve ser positivo
 *
 * A classe mais importante do sistema — tudo o que entra no sistema
 * começa por ser validado e modelado aqui.
 */
export class Metric {
  // Propriedades são readonly porque uma métrica, uma vez criada, é imutável.
  readonly id: string;
  readonly workspaceId: string;
  readonly apiKeyId: string;
  readonly endpoint: string;
  readonly method: HttpMethod;
  readonly latencyMs: number;
  readonly statusCode: number;
  readonly payloadSizeBytes: number | null;
  readonly requestId: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly timestamp: Date;

  /**
   * Cria uma nova instância de Metric após validar todas as regras de negócio.
   * Lança ValidationError se alguma regra for violada.
   * Todas as propriedades são atribuídas durante a construção e tornam-se imutáveis.
   *
   * @param input - Dados necessários para criar a métrica (deve ser válido)
   * @param overrideTimestamp - (interno) Timestamp a usar em vez do momento atual.
   *   Usado apenas por `reconstitute()` para preservar timestamps de BD.
   * @throws {ValidationError} Se qualquer validação falhar
   */
  constructor(input: CreateMetricInput, overrideTimestamp?: Date) {
    // Validamos todos os campos antes de atribuir qualquer valor.
    // Se qualquer validação falhar, o objecto não é criado (fail-fast).
    Metric.validate(input);

    // Gera um UUID único para rastreabilidade interna (não confundir com requestId).
    this.id = randomUUID();
    this.workspaceId = input.workspaceId;
    this.apiKeyId = input.apiKeyId;
    this.endpoint = input.endpoint;
    // Cast seguro: validate() já confirmou que é um método HTTP válido.
    this.method = input.method as HttpMethod;
    this.latencyMs = input.latencyMs;
    this.statusCode = input.statusCode;
    // Campos opcionais usam null em vez de undefined para serialização consistente.
    this.payloadSizeBytes = input.payloadSizeBytes ?? null;
    this.requestId = input.requestId;
    this.userAgent = input.userAgent ?? null;
    this.ipAddress = input.ipAddress ?? null;
    // Timestamp é gerado no momento, exceto se overrideTimestamp for fornecido.
    // Isto permite que reconstitute() preserve timestamps de BD sem type assertions.
    this.timestamp = overrideTimestamp ?? new Date();
  }

  /**
   * Reconstitui uma Metric a partir de dados persistidos em base de dados.
   *
   * Este método é a entrada autorizada para restaurar métricas do armazenamento persistente.
   * Diferencia-se do constructor pelo tratamento especial do timestamp: enquanto o constructor
   * gera um novo timestamp na ingestão (`new Date()`), reconstitute preserva o timestamp original
   * da BD, mantendo a rastreabilidade histórica da métrica.
   *
   * @param input - Dados da métrica incluindo timestamp original da BD
   * @param input.timestamp - O timestamp original quando a métrica foi gravada na BD
   * @returns Uma Metric válida com timestamp preservado da BD
   * @throws {ValidationError} Se qualquer validação de domínio falhar (via constructor)
   *
   * @remarks
   * A implementação passa o timestamp ao constructor via parâmetro privado `overrideTimestamp`,
   * eliminando a necessidade de type assertions sobre propriedades readonly.
   *
   * Fluxo de recomposição:
   * 1. Validar todos os campos via Metric.validate() (chamado no constructor)
   * 2. Gerar um UUID único como ID interno (nova instância no application)
   * 3. Usar o timestamp fornecido em vez de gerar um novo
   * 4. Retornar entidade com identidade nova, regras validadas, histórico preservado
   *
   * Este padrão é essential para garantir que:
   * - Métricas hidratadas da BD respeitam invariantes de domínio (não confiar na BD)
   * - Cada carregamento de BD cria uma nova instância de app (UUID único)
   * - Timestamps históricos são preservados para análise temporal
   *
   * @example
   * // Restaurar métrica que foi persistida
   * const row = await db.select().from(metricsRaw).where(eq(metricsRaw.requestId, id));
   * const metric = Metric.reconstitute({
   *   workspaceId: row.workspaceId,
   *   apiKeyId: row.apiKeyId,
   *   endpoint: row.endpoint,
   *   method: row.method as HttpMethod,
   *   latencyMs: row.latencyMs,
   *   statusCode: row.statusCode,
   *   requestId: row.requestId,
   *   timestamp: row.time,
   * });
   */
  static reconstitute(input: CreateMetricInput & { timestamp: Date }): Metric {
    return new Metric(input, input.timestamp);
  }

  /**
   * Orquestra todas as validações de negócio para uma nova Metric.
   * Separado do constructor para clareza e testabilidade individual.
   *
   * @param input - Dados da métrica a validar
   * @throws {ValidationError} Se qualquer validação falhar
   */
  private static validate(input: CreateMetricInput): void {
    Metric.validateRequired(input);
    Metric.validateEndpoint(input.endpoint);
    Metric.validateHttpMethod(input.method);
    Metric.validateMetrics(input);
  }

  /**
   * Valida os campos identificadores obrigatórios de uma Metric.
   *
   * Verifica dois critérios para cada campo (`workspaceId`, `apiKeyId`, `requestId`):
   * 1. Presença — o campo deve ser uma string não-vazia.
   * 2. Formato UUID — necessário pois a BD usa colunas `uuid()` que rejeitam outros formatos.
   *
   * @param input - Input cru de criação da métrica
   * @throws {ValidationError} Se algum campo estiver ausente ou com formato inválido.
   *   O erro inclui `{ field, value, message }` para facilitar o debug.
   */
  private static validateRequired(input: CreateMetricInput): void {
    const required = ['workspaceId', 'apiKeyId', 'requestId'] as const;

    for (const field of required) {
      if (!input[field] || typeof input[field] !== 'string') {
        throw new ValidationError('Invalid metric data', [
          {
            field,
            value: input[field],
            message: `${field} is required`,
          },
        ]);
      }

      if (!isValidUuid(input[field])) {
        throw new ValidationError('Invalid metric data', [
          {
            field,
            value: input[field],
            message: `${field} must be a valid UUID`,
          },
        ]);
      }
    }
  }

  /**
   * Valida que o endpoint tem formato correcto (começa com "/").
   * Garante consistência nas rotas armazenadas na BD.
   *
   * @param endpoint - Endpoint HTTP a validar (ex: "/api/users")
   * @throws {ValidationError} Se o endpoint não começar com "/" ou estiver vazio
   */
  private static validateEndpoint(endpoint: string): void {
    if (!endpoint || endpoint.trim() === '' || !endpoint.startsWith('/')) {
      throw new ValidationError('Invalid metric data', [
        {
          field: 'endpoint',
          value: endpoint,
          message: 'Endpoint must start with /',
        },
      ]);
    }
  }

  /**
   * Valida que o método HTTP é um dos métodos aceites.
   * Métodos válidos são definidos em `VALID_HTTP_METHODS`.
   *
   * @param method - Método HTTP a validar (ex: "GET", "POST")
   * @throws {ValidationError} Se o método não for um dos métodos válidos
   */
  private static validateHttpMethod(method: string): void {
    if (!VALID_HTTP_METHODS.includes(method as HttpMethod)) {
      throw new ValidationError('Invalid metric data', [
        {
          field: 'method',
          value: method,
          message: `Method must be one of: ${VALID_HTTP_METHODS.join(', ')}`,
        },
      ]);
    }
  }

  /**
   * Valida as métricas numéricas da requisição HTTP.
   * Verifica `latencyMs`, `statusCode` e `payloadSizeBytes` (opcional).
   *
   * @param input - Dados da métrica com campos numéricos
   * @throws {ValidationError} Se alguma métrica violar suas regras de validação
   */
  private static validateMetrics(input: CreateMetricInput): void {
    if (!Number.isFinite(input.latencyMs) || input.latencyMs <= 0) {
      throw new ValidationError('Invalid metric data', [
        {
          field: 'latencyMs',
          value: input.latencyMs,
          message: 'Latency must be positive',
        },
      ]);
    }

    if (!Number.isInteger(input.statusCode) || input.statusCode < 100 || input.statusCode > 599) {
      throw new ValidationError('Invalid metric data', [
        {
          field: 'statusCode',
          value: input.statusCode,
          message: 'Status code must be between 100 and 599',
        },
      ]);
    }

    if (
      input.payloadSizeBytes !== undefined &&
      (typeof input.payloadSizeBytes !== 'number' || input.payloadSizeBytes <= 0)
    ) {
      throw new ValidationError('Invalid metric data', [
        {
          field: 'payloadSizeBytes',
          value: input.payloadSizeBytes,
          message: 'Payload size must be positive',
        },
      ]);
    }
  }

  /**
   * Determina se este request resultou num erro (status 4xx ou 5xx).
   * Status codes 4xx indicam erro do cliente, 5xx indicam erro do servidor.
   * Esta lógica pertence ao domínio, é uma regra de negócio, não de HTTP framework.
   *
   * @returns true se o status code >= 400, false caso contrário
   */
  isError(): boolean {
    return this.statusCode >= 400;
  }

  /**
   * Determina se este request excedeu o limite de latência.
   * O threshold é passado como parâmetro porque é configurável por workspace
   * (cada cliente pode ter SLAs diferentes).
   *
   * @param threshold - Limite de latência em milissegundos
   * @returns true se latencyMs > threshold, false caso contrário
   */
  isSlow(threshold: number): boolean {
    return this.latencyMs > threshold;
  }

  /**
   * Determina se é um erro de servidor (status 5xx).
   * Útil para distinguir erros do cliente (4xx) de erros do nosso sistema (5xx).
   *
   * @returns true se o status code está entre 500-599, false caso contrário
   */
  isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600;
  }

  /**
   * Retorna a família do status code (2xx, 3xx, 4xx ou 5xx).
   * Utilizado nos workers de agregação para contar requests por família.
   *
   * @returns A família do status code ("2xx" | "3xx" | "4xx" | "5xx")
   */
  getStatusCodeFamily(): '2xx' | '3xx' | '4xx' | '5xx' {
    if (this.statusCode < 300) {
      return '2xx';
    }
    if (this.statusCode < 400) {
      return '3xx';
    }
    if (this.statusCode < 500) {
      return '4xx';
    }
    return '5xx';
  }
}
