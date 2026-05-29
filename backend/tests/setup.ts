// Configuração global para os testes
// Executado antes de cada teste

// Desabilita logs Pino em testes
process.env.LOG_LEVEL = 'silent';

// Define timezone UTC para consistency
process.env.TZ = 'UTC';

// Timeout padrão para testes
jest.setTimeout(5000);