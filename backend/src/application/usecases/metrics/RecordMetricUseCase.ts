/**
 * O use case orquestra o fluxo de negócio: recebe dados externos,
 * cria a entidade de domínio e coordena os serviços necessários.
 *
 * O que este use case faz, por ordem:
 * 1. Verifica se o request já foi processado (idempotência)
 * 2. Cria a entidade Metric (validações de domínio executadas aqui)
 * 3. Persiste a métrica
 * 4. Invalida cache do dashboard
 * 5. Agenda worker de agregação
 * 6. Devolve confirmação ao controller
 */

import { Metric } from '@domain/entities/Metric';
import { AppError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';
import {
  MetricsRepository,
  MetricsCacheService,
  AggregationQueueService,
} from '@application/contracts/repositories';
import { RecordMetricInputDTO, RecordMetricOutputDTO } from '@application/dto/MetricsDTO';

/**
 * Use case para registar uma métrica.
 */
export class RecordMetricUseCase {
  // Injecção de dependências pelo constructor.
  // O use case não cria repositórios -> recebe-os.
  // Isto permite substituir por mocks nos testes unitários.
  constructor(
    private readonly metricsRepository: MetricsRepository,
    private readonly cacheService: MetricsCacheService,
    private readonly aggregationQueue: AggregationQueueService
  ) {}

  async execute(input: RecordMetricInputDTO): Promise<RecordMetricOutputDTO> {
    // Passo 1: verificar idempotência.
    // Duplicado explícito detectado antes do save, retorna HTTP 409 CONFLICT ao chamador
    const alreadyExists = await this.metricsRepository.existsByRequestId(input.requestId);

    if (alreadyExists) {
      // Não é um erro — é um comportamento esperado em sistemas distribuídos.
      // Logamos como info para rastreabilidade, mas processamos normalmente.
      logger.info('metric_already_recorded', {
        requestId: input.requestId,
        workspaceId: input.workspaceId,
      });

      // Lançamos erro específico para o controller tratar com HTTP 409 Conflict.
      throw new AppError('Metric with this requestId was already recorded', 'CONFLICT', 409);
    }

    // Passo 2: criar a entidade.
    // O constructor da Metric valida todas as regras de negócio.
    // Se os dados forem inválidos, ValidationError é lançado aqui.
    const metric = new Metric({
      workspaceId: input.workspaceId,
      apiKeyId: input.apiKeyId,
      endpoint: input.endpoint,
      method: input.method,
      latencyMs: input.latencyMs,
      statusCode: input.statusCode,
      payloadSizeBytes: input.payloadSizeBytes,
      requestId: input.requestId,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    // Passo 3: persistir a métrica.
    // Fazemos wrap do erro de persistência para não expor detalhes da DB.
    try {
      await this.metricsRepository.save(metric);
    } catch (error) {
      logger.error('metric_save_failed', {
        requestId: input.requestId,
        workspaceId: input.workspaceId,
        error,
      });

      // Re-throw AppErrors sem embrulhar: preserva code, statusCode e referência original.
      // Erros genéricos (ex: falhas de rede inesperadas)
      // continuam a ser normalizados para 500.
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('Failed to record metric', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }

    // Passo 4: invalidar cache.
    // Não bloqueamos a resposta em caso de falha — cache é best-effort.
    // O dashboard simplesmente vai buscar dados à DB directamente.
    try {
      await this.cacheService.invalidate(input.workspaceId);
    } catch (error) {
      // Logger como warning para rastreabilidade, mas não bloqueamos a resposta.
      logger.warn('cache_invalidation_failed', {
        workspaceId: input.workspaceId,
        error,
      });
      // Não re-lançamos erro, métrica já foi guardada com sucesso.
    }

    // Passo 5: agendar agregação em background.
    // Também best-effort -> o worker de retry trata de falhas de fila.
    try {
      await this.aggregationQueue.scheduleAggregation(input.workspaceId, input.endpoint);
    } catch (error) {
      logger.warn('aggregation_scheduling_failed', {
        workspaceId: input.workspaceId,
        endpoint: input.endpoint,
        error,
      });
      // Não re-lançamos erro, métrica principal já foi guardada.
    }

    // Passo 6: log de sucesso e retorno.
    logger.info('metric_recorded', {
      metricId: metric.id,
      workspaceId: input.workspaceId,
      endpoint: input.endpoint,
      statusCode: input.statusCode,
      latencyMs: input.latencyMs,
    });

    return {
      metricId: metric.id,
      recordedAt: metric.timestamp,
    };
  }
}
