/**
 * Testes unitários do módulo de ligação à base de dados.
 * Cobrem inicialização, singleton, health check degradado e fecho do pool.
 */

const mockQuery = jest.fn().mockResolvedValue(undefined);
const mockRelease = jest.fn();
const mockConnect = jest.fn();
const mockEnd = jest.fn().mockResolvedValue(undefined);
const mockOn = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    end: mockEnd,
    on: mockOn,
  })),
}));

jest.mock('drizzle-orm/node-postgres', () => ({
  drizzle: jest.fn().mockReturnValue({ mocked: true }),
}));

jest.mock('@infra/frameworks/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import {
  initializeDatabase,
  closeDatabaseConnection,
  checkDatabaseConnection,
  getDatabase,
} from '@infra/frameworks/database/connection';

describe('database connection', () => {
  beforeEach(async () => {
    await closeDatabaseConnection();
    mockConnect.mockReset();
    mockEnd.mockReset().mockResolvedValue(undefined);
    mockQuery.mockReset().mockResolvedValue(undefined);
    mockRelease.mockReset();
    mockOn.mockReset();
  });

  afterEach(async () => {
    await closeDatabaseConnection();
  });

  it('should throw when getDatabase is called before initialization', () => {
    expect(() => getDatabase()).toThrow('Database not initialized');
  });

  it('should return false from checkDatabaseConnection when pool is not initialized', async () => {
    expect(await checkDatabaseConnection()).toBe(false);
  });

  it('should initialize pool and return drizzle instance', () => {
    const db = initializeDatabase('postgresql://user:pass@localhost:5432/test');

    expect(db).toEqual({ mocked: true });
    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should return existing instance on second initializeDatabase call', () => {
    const first = initializeDatabase('postgresql://user:pass@localhost:5432/test');
    const second = initializeDatabase('postgresql://other:5432/db');

    expect(second).toBe(first);
  });

  it('should return true when health check query succeeds', async () => {
    initializeDatabase('postgresql://user:pass@localhost:5432/test');
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });

    expect(await checkDatabaseConnection()).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    expect(mockRelease).toHaveBeenCalled();
  });

  it('should return false when health check connect fails', async () => {
    initializeDatabase('postgresql://user:pass@localhost:5432/test');
    mockConnect.mockRejectedValue(new Error('connection refused'));

    expect(await checkDatabaseConnection()).toBe(false);
  });

  it('should return false when health check query fails', async () => {
    initializeDatabase('postgresql://user:pass@localhost:5432/test');
    mockConnect.mockResolvedValue({
      query: jest.fn().mockRejectedValue(new Error('query failed')),
      release: mockRelease,
    });

    expect(await checkDatabaseConnection()).toBe(false);
  });

  it('should close pool and reset state on closeDatabaseConnection', async () => {
    initializeDatabase('postgresql://user:pass@localhost:5432/test');

    await closeDatabaseConnection();

    expect(mockEnd).toHaveBeenCalled();
    expect(await checkDatabaseConnection()).toBe(false);
    expect(() => getDatabase()).toThrow('Database not initialized');
  });

  it('should allow re-initialization after close', async () => {
    initializeDatabase('postgresql://user:pass@localhost:5432/test');
    await closeDatabaseConnection();

    const db = initializeDatabase('postgresql://user:pass@localhost:5432/test');

    expect(db).toEqual({ mocked: true });
    expect(getDatabase()).toBe(db);
  });
});
