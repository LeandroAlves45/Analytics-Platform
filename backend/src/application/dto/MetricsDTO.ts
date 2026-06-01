// MetricsDTO.ts
//
// DTOs (Data Transfer Objects) definem a forma dos dados que entram
// e saem dos use cases.

// Dados que chegam ao use case vindos do controller.
export interface RecordMetricInputDTO {
  // ID do workspace, extraído do JWT ou da API key validada.
  workspaceId: string;

  // ID da API Key usada neste request.
  apiKeyId: string;

  // Endpoint da API chamada.
  endpoint: string;

  // Método HTTP usado.
  method: string;

  // Latência da requisição em milissegundos.
  latencyMs: number;

  // Código de status HTTP retornado.
  statusCode: number;

  // Tamanho do payload da requisição em bytes. (opcional)
  payloadSizeBytes?: number;

  // ID do request, usado para evitar duplicação.
  requestId: string;

  // User-Agent do cliente. (opcional)
  userAgent?: string;

  // Endereço IP do cliente. (opcional)
  ipAddress?: string;
}

// Dados que o use case devolve ao controller após processar a métrica.
// Mantemos a resposta simples — o cliente só precisa de saber que foi aceite.
export interface RecordMetricOutputDTO {
  // ID gerado para esta métrica.
  metricId: string;
  // Timestamp da métrica.
  recordedAt: Date;
}
