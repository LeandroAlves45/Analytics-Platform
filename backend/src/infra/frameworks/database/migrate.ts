// migrate.ts
//
// Aplica migrations Drizzle e converte tabelas de métricas em hypertables TimescaleDB.
//
// Comandos:
//   npm run db:migrate          → migrations + hypertables
//   npm run db:hypertables      → apenas hypertables (re-run idempotente)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { logger } from "../logging";

dotenv.config();

const MIGRATIONS_FOLDER = resolve(
  process.cwd(),
  "src/infra/frameworks/database/migrations",
);

const HYPERTABLES_SQL_PATH = resolve(
  process.cwd(),
  "../docker/init_hypertables.sql",
);

function buildDatabaseUrl(): string {
  const {
    DATABASE_HOST,
    DATABASE_PORT,
    DATABASE_USER,
    DATABASE_PASSWORD,
    DATABASE_NAME,
  } = process.env;

  if (
    !DATABASE_HOST ||
    !DATABASE_PORT ||
    !DATABASE_USER ||
    !DATABASE_PASSWORD ||
    !DATABASE_NAME
  ) {
    throw new Error(
      "Variáveis de ambiente da BD em falta. Verifica DATABASE_HOST, DATABASE_PORT, " +
        "DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME no ficheiro .env",
    );
  }

  return `postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`;
}

async function runHypertables(pool: Pool): Promise<void> {
  const sql = readFileSync(HYPERTABLES_SQL_PATH, "utf-8");
  logger.info("hypertables_applying", { path: HYPERTABLES_SQL_PATH });
  await pool.query(sql);
  logger.info("hypertables_applied");
}

async function runMigrations(pool: Pool): Promise<void> {
  const db = drizzle(pool);
  logger.info("migrations_running", { folder: MIGRATIONS_FOLDER });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  logger.info("migrations_completed");
}

async function main(): Promise<void> {
  const hypertablesOnly = process.argv.includes("--hypertables-only");
  const skipHypertables = process.argv.includes("--skip-hypertables");
  const databaseUrl = buildDatabaseUrl();

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    if (!hypertablesOnly) {
      await runMigrations(pool);
    }

    if (!skipHypertables) {
      await runHypertables(pool);
    }

    logger.info("database_setup_completed");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  logger.error("database_setup_failed", {
    error: error instanceof Error ? error.message : "Unknown",
  });
  process.exit(1);
});
