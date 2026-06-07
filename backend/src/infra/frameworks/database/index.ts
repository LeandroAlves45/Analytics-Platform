// src/infra/frameworks/database/index.ts
//
// Barrel export do módulo de base de dados.
// Permite importar tudo de um único ponto:
//   import { initializeDatabase, checkDatabaseConnection } from '@infra/frameworks/database'
//   import { users, workspaces, metricsRaw } from '@infra/frameworks/database'

export {
  initializeDatabase,
  closeDatabaseConnection,
  checkDatabaseConnection,
  getDatabase,
  type Database,
} from './connection';

// Exporta todas as tabelas do schema
export {
  // Time-series
  metricsRaw,
  metrics5min,
  metrics1h,
  metrics1d,
  // Metadata
  users,
  workspaces,
  apiKeys,
  endpoints,
  workspaceMembers,
  // Alerting
  alertRules,
  alertEvents,
  // Billing
  usageTracking,
  stripeSubscriptions,
} from './schema';
