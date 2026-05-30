// drizzle.config.ts
//
// Configuração do Drizzle Kit - o CLI que gera e corre migrations.
//
// Comandos que usam este ficheiro:
//   npm run db:generate  → lê o schema.ts e gera ficheiros SQL de migration
//   npm run db:migrate   → aplica as migrations pendentes à base de dados
//   npm run db:studio    → abre interface visual para explorar a base de dados
//
// O Drizzle Kit procura este ficheiro na raiz por convenção.

import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carrega as variáveis de ambiente
dotenv.config();

// Constrói a DATABASE_URL a partir das variáveis individuais
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
    "Missing required database environment variables for Drizzle Kit. " +
      "Check your .env file: DATABASE_HOST, DATABASE_PORT, DATABASE_USER, " +
      "DATABASE_PASSWORD, DATABASE_NAME",
  );
}

const databaseUrl = `postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`;

const config: Config = {
  // Onde está o schema TypeScript (fonte da verdade)
  schema: "./src/infra/frameworks/database/schema.ts",

  // Onde guardar od ficheiros de migrations gerados
  out: "./src/infra/frameworks/database/migrations",

  // Dialecto da BD
  dialect: "postgresql",

  // Credenciais da BD
  dbCredentials: {
    url: databaseUrl,
  },

  // Verbose: mostra queries executadas durante as migrations
  verbose: true,

  // Strict: pede confirmação antes de executar destructive migrations
  strict: true,
};

export default config;
