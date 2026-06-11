/**
 * Schema completo da base de dados definido em TypeScript via Drizzle ORM.
 * As migrations são geradas a partir deste ficheiro com: npm run db:generate
 *
 * Estrutura:
 *   - TIME-SERIES TABLES (4 hypertables TimescaleDB)
 *   - METADATA TABLES (5 tabelas relacionais)
 *   - IDEMPOTENCY TABLES (1 tabela)
 *   - ALERTING TABLES (2 tabelas)
 *   - BILLING TABLES (2 tabelas)
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const inet = customType<{ data: string; driverData: string }>({
  dataType: () => 'inet',
});

// =============================================================================
// TIME-SERIES TABLES
// Estas quatro tabelas (metrics_raw, metrics_5min, metrics_1h, metrics_1d)
// serão convertidas em hypertables TimescaleDB após a migration.
// =============================================================================

/**
 * Métricas brutas recebidas do SDK.
 *
 * Retenção: 7 dias.
 * Cada linha representa um único request HTTP rastreado.
 */
export const metricsRaw = pgTable(
  'metrics_raw',
  {
    // Dimensão temporal principal (TimescaleDB optimized)
    time: timestamp('time', { withTimezone: true }).notNull(),

    // Isolamento multitenant -> cada workspace só vê os seus dados
    workspaceId: uuid('workspace_id').notNull(),

    // Chave de API para identificar a origem da métrica
    apiKeyId: uuid('api_key_id').notNull(),

    // Identificação do endpoint rastreado
    endpoint: varchar('endpoint').notNull(),

    // Método HTTP usado
    method: varchar('method').notNull(),

    // Latência em milissegundos
    latencyMs: doublePrecision('latency_ms').notNull(),

    // Código de status HTTP
    statusCode: integer('status_code').notNull(),

    // Tamanho do payload em bytes
    payloadSizeBytes: integer('payload_size_bytes'),

    // ID único do request HTTP (unique com time — requisito TimescaleDB)
    requestId: uuid('request_id').notNull(),

    // User-Agent do cliente
    userAgent: varchar('user_agent'),

    // Endereço IP do cliente
    ipAddress: inet('ip_address'),

    // Timestamp de criação
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  // Índices para otimizar queries frequentes
  (table) => ({
    // Query principal do dashboard: métricas por workspace ordenadas por tempo
    workspaceTimeIdx: index('metrics_raw_workspace_time_idx').on(table.workspaceId, table.time),
    // Filtrar métricas por endpoint específico
    endpointTimeIdx: index('metrics_raw_endpoint_time_idx').on(table.endpoint, table.time),

    // Auditar uso por API Key
    apiKeyTimeIdx: index('metrics_raw_api_key_time_idx').on(table.apiKeyId, table.time),

    // Filtrar métricas por status code
    statusCodeTimeIdx: index('metrics_raw_status_code_time_idx').on(table.statusCode, table.time),

    // Idempotência: UNIQUE deve incluir a coluna de particionamento (time)
    requestIdTimeIdx: uniqueIndex('metrics_raw_request_id_time_idx').on(
      table.requestId,
      table.time
    ),
  })
);

/**
 * Tabela auxiliar de idempotência para métricas.
 *
 * Mapeia requestId → timestamp de gravação para garantir que a mesma
 * métrica não seja processada múltiplas vezes.
 */
export const metricIdempotencyKeys = pgTable('metric_idempotency_keys', {
  requestId: uuid('request_id').primaryKey(),
  recordedAt: timestamp('recorded_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

/**
 * Agregações de 5 minutos calculadas pelo AggregationWorker.
 *
 * Retenção: 90 dias.
 * Unique constraint em (time, workspaceId, endpoint, method) garante
 * idempotência do upsert: se o worker processar o mesmo job duas vezes,
 * a segunda execução atualiza a linha existente em vez de criar duplicado.
 */
export const metrics5min = pgTable(
  'metrics_5min',
  {
    // Inicío da janela de 5 minutos (TimescaleDB optimized)
    time: timestamp('time', { withTimezone: true }).notNull(),

    workspaceId: uuid('workspace_id').notNull(),

    endpoint: varchar('endpoint').notNull(),

    method: varchar('method').notNull(),

    // Total de requests nesta janela de 5min
    count: integer('count').notNull(),

    // Latência percentis
    latencyP50: doublePrecision('latency_p50'),
    latencyP75: doublePrecision('latency_p75'),
    latencyP95: doublePrecision('latency_p95'),
    latencyP99: doublePrecision('latency_p99'),

    // Estatísticas básicas de latência
    latencyAvg: doublePrecision('latency_avg'),
    latencyMax: doublePrecision('latency_max'),
    latencyMin: doublePrecision('latency_min'),

    // Contagem por família de status code
    status2xxCount: integer('status_2xx_count'),
    status3xxCount: integer('status_3xx_count'),
    status4xxCount: integer('status_4xx_count'),
    status5xxCount: integer('status_5xx_count'),

    // Timestamp de criação
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Query principal do dashboard: métricas por workspace ordenadas por tempo
    workspaceTimeIdx: index('metrics_5min_workspace_time_idx').on(table.workspaceId, table.time),
    endpointTimeIdx: index('metrics_5min_endpoint_time_idx').on(table.endpoint, table.time),
    // Constraint de idempotência para o upsert do AggregationWorker.
    uniqueWindowIdx: uniqueIndex('metrics_5min_unique_window_idx').on(
      table.time,
      table.workspaceId,
      table.endpoint,
      table.method
    ),
  })
);

/**
 * Agregações de 1 hora.
 *
 * Retenção: 1 ano.
 */
export const metrics1h = pgTable(
  'metrics_1h',
  {
    // Inicío da janela de 1 hora (TimescaleDB optimized)
    time: timestamp('time', { withTimezone: true }).notNull(),

    workspaceId: uuid('workspace_id').notNull(),

    endpoint: varchar('endpoint').notNull(),

    method: varchar('method').notNull(),

    count: integer('count').notNull(),

    latencyP50: doublePrecision('latency_p50'),
    latencyP75: doublePrecision('latency_p75'),
    latencyP95: doublePrecision('latency_p95'),
    latencyP99: doublePrecision('latency_p99'),

    latencyAvg: doublePrecision('latency_avg'),
    latencyMax: doublePrecision('latency_max'),
    latencyMin: doublePrecision('latency_min'),

    status2xxCount: integer('status_2xx_count'),
    status3xxCount: integer('status_3xx_count'),
    status4xxCount: integer('status_4xx_count'),
    status5xxCount: integer('status_5xx_count'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    workspaceTimeIdx: index('metrics_1h_workspace_time_idx').on(table.workspaceId, table.time),
    uniqueWindowIdx: uniqueIndex('metrics_1h_unique_window_idx').on(
      table.time,
      table.workspaceId,
      table.endpoint,
      table.method
    ),
  })
);

/**
 * Agregações diárias.
 *
 * Retenção: infinita.
 */
export const metrics1d = pgTable(
  'metrics_1d',
  {
    // Inicío da janela de 1 dia (TimescaleDB optimized)
    time: timestamp('time', { withTimezone: true }).notNull(),

    workspaceId: uuid('workspace_id').notNull(),

    endpoint: varchar('endpoint').notNull(),

    method: varchar('method').notNull(),

    count: integer('count').notNull(),

    latencyP50: doublePrecision('latency_p50'),
    latencyP75: doublePrecision('latency_p75'),
    latencyP95: doublePrecision('latency_p95'),
    latencyP99: doublePrecision('latency_p99'),

    latencyAvg: doublePrecision('latency_avg'),
    latencyMax: doublePrecision('latency_max'),
    latencyMin: doublePrecision('latency_min'),

    status2xxCount: integer('status_2xx_count'),
    status3xxCount: integer('status_3xx_count'),
    status4xxCount: integer('status_4xx_count'),
    status5xxCount: integer('status_5xx_count'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    workspaceTimeIdx: index('metrics_1d_workspace_time_idx').on(table.workspaceId, table.time),
    uniqueWindowIdx: uniqueIndex('metrics_1d_unique_window_idx').on(
      table.time,
      table.workspaceId,
      table.endpoint,
      table.method
    ),
  })
);

// =============================================================================
// METADATA TABLES
// Tabelas relacionais para entidades do sistema.
// =============================================================================

/**
 * Utilizadores da plataforma (quem faz login no dashboard).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    email: varchar('email').notNull().unique(),

    // Nunca se armazena a senha em plaintext
    passwordHash: varchar('password_hash').notNull(),

    // Nome de exibição
    name: varchar('name'),

    // Controlo de acesso do email
    emailVerified: boolean('email_verified').default(false).notNull(),

    // Estado do utilizador
    status: varchar('status').default('active').notNull(),

    // Configuração do utilizador (tema, timezone, etc.)
    settings: jsonb('settings').default({}).notNull(),

    // Timestamp de criação
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Lookup por emails durante o login
    emailIdx: index('users_email_idx').on(table.email),
  })
);

/**
 * Organização multi-tenant.
 *
 * Cada utilizador pode ter vários workspaces.
 * Um workspace isola completamente os dados de um cliente.
 */
export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Owner do workspace -> quando o utilizador é eliminado, o workspace é eliminado
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Nome do workspace
    name: varchar('name').notNull(),

    // Identificador URL-friendly para o workspace
    slug: varchar('slug').notNull().unique(),

    // Plano de billing: free, pro, business, enterprise
    plan: varchar('plan').default('free').notNull(),

    // Estado do workspace
    status: varchar('status').default('active').notNull(),

    // Configuração do workspace (tema, timezone, etc.)
    settings: jsonb('settings').default({}).notNull(),

    // Timestamp de criação
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Lookup por utilizador
    userIdIdx: index('workspaces_user_id_idx').on(table.userId),
    slugIdx: index('workspaces_slug_idx').on(table.slug),
  })
);

/**
 * Chaves de autenticação usadas pelo SDK para enviar métricas.
 *
 * NUNCA armazenamos a chave em plaintext — apenas o hash.
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Workspace associado
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Nome da chave
    name: varchar('name').notNull(),

    // Hash bcrypt da chave real -> o que é armazenado na base de dados
    keyHash: varchar('key_hash').notNull().unique(),

    // Últimos 6 caracteres da chave original - para o UI mostrar ao utilizador
    keyPreview: varchar('key_preview').notNull(),

    // Estado da chave
    status: varchar('status').default('active').notNull(),

    // Timestamp da última utilização
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Lookup por workspace
    workspaceIdIdx: index('api_keys_workspace_id_idx').on(table.workspaceId),
    // Index no hash para lookups rápidos
    keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
  })
);

/**
 * Metadata sobre os endpoints que estão a ser rastreados.
 *
 * Criado automaticamente quando uma métrica chega de um endpoint novo.
 */
export const endpoints = pgTable(
  'endpoints',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Workspace associado
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Endpoint rastreado
    endpoint: varchar('endpoint').notNull(),

    // Método HTTP usado
    method: varchar('method').notNull(),

    // Descrição do endpoint
    description: varchar('description'),

    // Permite desativar alertas para um determinado endpoint
    alertsEnabled: boolean('alerts_enabled').default(true).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Constraints únicas para evitar duplicação de endpoints por workspace
    workspaceEndpointMethodIdx: uniqueIndex('endpoints_workspace_endpoint_method_idx').on(
      table.workspaceId,
      table.endpoint,
      table.method
    ),
  })
);

/**
 * Tabela de junção many-to-many entre users e workspaces.
 *
 * Permite que múltiplos utilizadores acedam ao mesmo workspace com roles diferentes.
 */
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Permissões do membro: owner, admin, member, viewer
    role: varchar('role').default('member').notNull(),

    // Timestamp de quando o membro se juntou ao workspace
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Um utilizador só pode ser membro de um workspace uma vez
    workspaceUserIdIdx: uniqueIndex('workspace_members_workspace_user_id_idx').on(
      table.workspaceId,
      table.userId
    ),
    // Lookup de todos os workspaces de um utilizador
    userIdIdx: index('workspace_members_user_id_idx').on(table.userId),
  })
);

// =============================================================================
// ALERTING TABLES
// =============================================================================

/**
 * Regras definidas pelo utilizador para disparar alertas.
 *
 * @example
 * "Se p95 > 500ms durante 5 minutos, notifica no Slack"
 */
export const alertRules = pgTable(
  'alert_rules',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Opcional: regra ligada a um endpoint específico ou a todos
    endpointId: uuid('endpoint_id').references(() => endpoints.id, {
      onDelete: 'set null',
    }),

    name: varchar('name').notNull(),

    description: varchar('description'),

    // Condição em texto: "latency_p95", "error_rate", "status_5xx_count"
    condition: varchar('condition').notNull(),

    // Valor limite: 500 (ms), 0.05 (5%), 10 (requests)
    threshold: doublePrecision('threshold').notNull(),

    // Janela de tempo em minutos para avaliar a condição
    windowMinutes: integer('window_minutes').default(5).notNull(),

    // Destinos de notificação: Slack webhook ou emails
    slackWebhookUrl: varchar('slack_webhook_url'),

    // Array de emails - Drizzle representa como text[]
    emailAddresses: text('email_addresses').array(),

    // Estado da regra: active, inactive
    status: varchar('status').default('active').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Lookup por workspace
    workspaceIdIdx: index('alert_rules_workspace_id_idx').on(table.workspaceId),
    // Index para o worker de alertas buscar apenas regras ativas
    statusIdx: index('alert_rules_status_idx').on(table.status),
  })
);

/**
 * Log de cada vez que uma regra de alerta foi disparada.
 *
 * Permite ver histórico, duração e estado de resolução.
 */
export const alertEvents = pgTable(
  'alert_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    alertRuleId: uuid('alert_rule_id')
      .notNull()
      .references(() => alertRules.id, { onDelete: 'cascade' }),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Quando o alerta foi disparado
    triggeredAt: timestamp('triggered_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),

    // Quando o alerta foi resolvido
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),

    // Valor real da métrica no momento do disparo
    value: doublePrecision('value').notNull(),

    // Mensagem de notificação
    message: varchar('message'),

    // Tracking de notificação enviadas
    slackSent: boolean('slack_sent').default(false).notNull(),
    emailSent: boolean('email_sent').default(false).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Dashboard de alertas: eventos recentes do workspace
    workspaceTriggeredAtIdx: index('alert_events_workspace_triggered_at_idx').on(
      table.workspaceId,
      table.triggeredAt
    ),
    // Histórico de uma regra específica
    alertRuleTriggeredAtIdx: index('alert_events_alert_rule_triggered_at_idx').on(
      table.alertRuleId,
      table.triggeredAt
    ),
    // Encontrar alertas não resolvidos (resolvedAt IS NULL)
    resolvedAtIdx: index('alert_events_resolved_at_idx').on(table.resolvedAt),
  })
);

// =============================================================================
// BILLING TABLES
// =============================================================================

/**
 * Contagem mensal de requests rastreados por workspace.
 *
 * Usada para billing baseado em consumo.
 */
export const usageTracking = pgTable(
  'usage_tracking',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Primeiro dia do mês: ex: 2026-05-01
    month: date('month').notNull(),

    // Contador de requests rastreados neste mês
    requestsTracked: integer('requests_tracked').default(0).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Um workspace só tem uma linha por mês
    workspaceMonthIdx: uniqueIndex('usage_tracking_workspace_month_idx').on(
      table.workspaceId,
      table.month
    ),
  })
);

/**
 * Estado da subscrição Stripe de cada workspace.
 *
 * TODO: Atualizado via Stripe webhooks.
 */
export const stripeSubscriptions = pgTable(
  'stripe_subscriptions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    workspaceId: uuid('workspace_id')
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // ID do cliente Stripe -> usado para API calls
    stripeCustomerId: varchar('stripe_customer_id').notNull().unique(),
    stripeSubscriptionId: varchar('stripe_subscription_id').notNull().unique(),
    stripeProductId: varchar('stripe_product_id'),

    // Plano de billing: free, pro, business, enterprise
    plan: varchar('plan').default('free').notNull(),

    // Estado da subscrição: active, past_due, canceled, unpaid
    status: varchar('status').notNull(),

    // Período de faturação atual
    currentPeriodStart: date('current_period_start'),
    currentPeriodEnd: date('current_period_end'),

    // Data de fim da trial (null se não for uma trial)
    trialEnd: date('trial_end'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Lookup de subscrições por estado
    statusIdx: index('stripe_subscriptions_status_idx').on(table.status),
  })
);
