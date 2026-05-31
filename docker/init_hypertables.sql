-- docker/init_hypertables.sql
--
-- Converte as tabelas de métricas em hypertables TimescaleDB.
-- Este script corre APÓS as migrations do Drizzle terem criado as tabelas.
--
-- Como executar manualmente (desenvolvimento):
--   docker exec -i analytics-saas-postgres psql -U analytics_user -d analytics_db < docker/init_hypertables.sql
--
-- Em desenvolvimento, preferir: npm run db:migrate (executa migrations + este script)
-- Em produção, este script é chamado pelo pipeline de deploy após as migrations.

-- metrics_raw: chunks de 1 hora (alto volume de dados)
SELECT create_hypertable('metrics_raw', 'time',
  chunk_time_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- metrics_5min: chunks de 1 dia (90 dias de retenção)
SELECT create_hypertable('metrics_5min', 'time',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- metrics_1h: chunks de 1 semana (1 ano de retenção)
SELECT create_hypertable('metrics_1h', 'time',
  chunk_time_interval => INTERVAL '1 week',
  if_not_exists => TRUE
);

-- metrics_1d: chunks de 1 mês (retenção infinita)
SELECT create_hypertable('metrics_1d', 'time',
  chunk_time_interval => INTERVAL '1 month',
  if_not_exists => TRUE
);

-- Política de compressão para metrics_raw
-- Chunks com mais de 3 dias são comprimidos
ALTER TABLE metrics_raw SET (
  timescaledb.compress,
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('metrics_raw',
  compress_after => INTERVAL '3 days',
  if_not_exists => TRUE
);

-- Políticas de retenção (DATABASE_SCHEMA.md)
SELECT add_retention_policy('metrics_raw',
  drop_after => INTERVAL '7 days',
  if_not_exists => TRUE
);

SELECT add_retention_policy('metrics_5min',
  drop_after => INTERVAL '90 days',
  if_not_exists => TRUE
);

SELECT add_retention_policy('metrics_1h',
  drop_after => INTERVAL '1 year',
  if_not_exists => TRUE
);
