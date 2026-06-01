// Metric.ts
//

import { randomUUID } from 'node:crypto';
import { ValidationError } from '@shared/errors';

// Lista de métodos HTTP válidos que o sistema aceita
// Definida aqui como constante de domínio porque é uma regra de negócio,
// não uma regra de HTTP framework.
const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] as const;

// Tipo derivado da constante acima. Permite que o TypeScript valide
// em tempo de compilação que apenas métodos válidos são usados.
type HttpMethod = (typeof VALID_HTTP_METHODS)[number];

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
   * @throws {ValidationError} Se qualquer validação falhar
   */
  constructor(input: CreateMetricInput) {
    // Validamos todos os campos antes de atribuir qualquer valor.
    // Se qualquer validação falhar, o objecto não é criado.
    Metric.validate(input);

    // Gerar um ID único para a métrica.
    this.id = randomUUID();
    this.workspaceId = input.workspaceId;
    this.apiKeyId = input.apiKeyId;
    this.endpoint = input.endpoint;
    // Cast seguro porque validate() já confirmou que é um método válido.
    this.method = input.method as HttpMethod;
    this.latencyMs = input.latencyMs;
    this.statusCode = input.statusCode;
    // Campos opcionais usam null em vez de undefined para serialização consistente
    this.payloadSizeBytes = input.payloadSizeBytes ?? null;
    this.requestId = input.requestId;
    this.userAgent = input.userAgent ?? null;
    this.ipAddress = input.ipAddress ?? null;
    this.timestamp = new Date();
  }

  // Método estático privado que orquestra todas as validações.
  // Separado do constructor para clareza e testabilidade individual.
  private static validate(input: CreateMetricInput): void {
    Metric.validateRequired(input);
    Metric.validateEndpoint(input.endpoint);
    Metric.validateHttpMethod(input.method);
    Metric.validateMetrics(input);
  }

  // Valida campos obrigatórios de string: workspaceId, apiKeyId, requestId
  private static validateRequired(input: CreateMetricInput): void {
    if (!input.workspaceId || input.workspaceId.trim() === '') {
      throw new ValidationError('Invalid metric data', [
        {
          field: 'workspaceId',
          value: input.workspaceId,
          message: 'Workspace ID is required',
        },
      ]);
    }

    if (!input.apiKeyId || input.apiKeyId.trim() === '') {
      throw new ValidationError('Invalid metric data', [
        {
          field: 'apiKeyId',
          value: input.apiKeyId,
          message: 'API Key ID is required',
        },
      ]);
    }

    if (!input.requestId || input.requestId.trim() === '') {
      throw new ValidationError('Invalid metric data', [
        {
          field: 'requestId',
          value: input.requestId,
          message: 'Request ID is required',
        },
      ]);
    }
  }

  // Valida endpoint: deve começar com "/" para garantir formato consistente
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

  // Valida method HTTP: deve ser um dos métodos válidos
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

  // Valida métricas numéricas: latencyMs, statusCode, e payloadSizeBytes opcional
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
