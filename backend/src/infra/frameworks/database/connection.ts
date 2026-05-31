// src/infra/frameworks/database/connection.ts
//
// Cria e exporta a ligação á base de dados.
//
// A ligação à base de dados é uma dependência de infra-estrutura.
// Separar do schema permite importar a ligação sem importar o schema
// e vice-versa. Também facilita os testes de integração, onde
// podemos substituir a ligação por uma de teste.

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { logger } from "../logging";
import * as schema from "./schema";

// Pool de ligação PostgreSQL
// Um pool mantém várias ligações abertas em simultâneo,
// reutilizando-as em vez de abrir e fechar uma por request.
// Isto é crítico para performance com muitos requests concorrentes.
let pool: Pool | null = null;

// Instância do Drizzle ORM -> o que o resto da aplicação usa para queries.
// O tipo Database encapsula o pool e o schema.
export type Database = ReturnType<typeof drizzle<typeof schema>>;
let db: Database | null = null;

// Configuração do pool de ligações.
const POOL_CONFIG = {
  // Número de ligações máximas no pool
  max: 10,

  // Tempo máximo de espera para uma ligação no pool
  connectionTimeoutMillis: 50000,

  // Tempo máximo de inactividade de uma ligação no pool
  idleTimeoutMillis: 30000,
};

// Inicializa o pool e a instância Drizzle.
// Deve ser chamada uma vez no arranque da aplicação (main.ts).
// Retorna a instância db para ser passada via Dependency Injection.
export function initializeDatabase(databaseUrl: string): Database {
  if (db) {
    // Já foi inicializado -> retorna a instância existente
    return db;
  }

  logger.info("database_initializing", { pool_max: POOL_CONFIG.max });

  // Cria o pool com a DATABASE_URL do ambiente
  pool = new Pool({
    connectionString: databaseUrl,
    ...POOL_CONFIG,
  });

  // Listener de erros no pool
  pool.on("error", (error) => {
    logger.error("database_pool_error", { error: error.message });
  });

  // Cria a instância Drizzle com o pool e o schema.
  // O schema é passado para que o Drizzle possa inferir os tipos TypeScript
  // nas queries: db.select().from(schema.users) retorna User[].
  db = drizzle(pool, { schema });

  logger.info("database_initialized");

  return db;
}

// Fecha o pool e a instância Drizzle.
// Deve ser chamado no graceful shutdown da aplicação.
export async function closeDatabaseConnection(): Promise<void> {
  if (pool) {
    logger.info("database_closing");
    await pool.end();
    pool = null;
    db = null;
    logger.info("database_closed");
  }
}

// Verifica se a BD está acessível.
// Usado no health check /ready do Express.
export async function checkDatabaseConnection(): Promise<boolean> {
  if (!pool) {
    return false;
  }

  try {
    // Executa uma query simples para verificar a conexão
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch (error) {
    logger.error("database_health_check_failed", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return false;
  }
}
