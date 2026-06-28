/**
 * Testes unitários do middleware global de erros.
 * Cobrem JSON malformado, AppError operacional, erros desconhecidos
 * e payload final em dev vs produção.
 */

import type { Request, Response, NextFunction } from 'express';

import { errorHandlerMiddleware } from '@infra/middleware/ErrorHandlerMiddleware';
import { AppError, ErrorCodes, NotFoundError, ValidationError } from '@shared/errors';

jest.mock('@infra/frameworks/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

function makeResponse(): Response & { statusCode?: number; body?: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode?: number; body?: unknown };
}

function makeRequest(id = 'req-1'): Request {
  return { id } as Request;
}

describe('errorHandlerMiddleware', () => {
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    next.mockClear();
  });

  it('should return 400 for malformed JSON body', () => {
    const err = new SyntaxError('Unexpected token');
    Object.assign(err, { body: '{}' });

    const res = makeResponse();
    errorHandlerMiddleware(err, makeRequest(), res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: ErrorCodes.BAD_REQUEST,
        message: 'Invalid JSON in request body',
      },
    });
  });

  it('should map operational AppError to correct status and payload', () => {
    const err = new NotFoundError('AlertRule', 'rule-123');

    const res = makeResponse();
    errorHandlerMiddleware(err, makeRequest(), res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: "AlertRule with id 'rule-123' not found",
        resource: 'AlertRule',
        identifier: 'rule-123',
      },
    });
  });

  it('should map ValidationError with details in payload', () => {
    const err = new ValidationError('Invalid input', [
      { field: 'email', message: 'Invalid email' },
    ]);

    const res = makeResponse();
    errorHandlerMiddleware(err, makeRequest(), res, next);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid input',
        details: [{ field: 'email', message: 'Invalid email' }],
      },
    });
  });

  it('should treat non-operational AppError as unknown 500', () => {
    process.env.NODE_ENV = 'development';
    const err = new AppError('DB pool exhausted', 'INTERNAL_SERVER_ERROR', 500, {
      isOperational: false,
    });

    const res = makeResponse();
    errorHandlerMiddleware(err, makeRequest(), res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'DB pool exhausted',
      },
    });
  });

  it('should expose unknown error message in development', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('stripe signature mismatch');

    const res = makeResponse();
    errorHandlerMiddleware(err, makeRequest('req-dev'), res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'stripe signature mismatch',
      },
    });
  });

  it('should hide unknown error message in production', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('stripe signature mismatch');

    const res = makeResponse();
    errorHandlerMiddleware(err, makeRequest('req-prod'), res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred. Please try again later.',
      },
    });
  });

  it('should map plain TypeError as internal server error', () => {
    process.env.NODE_ENV = 'development';
    const err = new TypeError('Cannot read properties of undefined');

    const res = makeResponse();
    errorHandlerMiddleware(err, makeRequest(), res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Cannot read properties of undefined',
      },
    });
  });
});
