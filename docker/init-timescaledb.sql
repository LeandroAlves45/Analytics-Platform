-- docker/init-timescaledb.sql
--
-- Executado automaticamente pelo PostgreSQL quando o container
-- é criado pela primeira vez (via docker-entrypoint-initdb.d/).

-- Ativa a extensão TimescaleDB na base de dados analytics_db
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Ativa a extensão para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;