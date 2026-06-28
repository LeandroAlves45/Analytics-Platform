/**
 * Testes unitários para todas as classes de erro da aplicação.
 *
 * Verifica statusCode, code, mensagens, serialização JSON e comportamento
 * de `instanceof` (garantido pelo `Object.setPrototypeOf` no constructor de AppError).
 * Não há dependências externas — testes puramente de classes de erro.
 */

import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '@shared/errors';

// ---------------------------------------------------------------------------
// AppError
// ---------------------------------------------------------------------------

describe('AppError', () => {
  describe('constructor', () => {
    it('should set statusCode correctly', () => {
      const error = new AppError('Something failed', 'INTERNAL_SERVER_ERROR', 500);

      expect(error.statusCode).toBe(500);
    });

    it('should set code correctly', () => {
      const error = new AppError('Something failed', 'INTERNAL_SERVER_ERROR', 500);

      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should set message correctly', () => {
      const error = new AppError('Something failed', 'INTERNAL_SERVER_ERROR', 500);

      expect(error.message).toBe('Something failed');
    });

    it('should set isOperational to true by default', () => {
      const error = new AppError('test', 'BAD_REQUEST', 400);

      expect(error.isOperational).toBe(true);
    });

    it('should allow isOperational to be set to false for programming errors', () => {
      const error = new AppError('bug', 'INTERNAL_SERVER_ERROR', 500, { isOperational: false });

      expect(error.isOperational).toBe(false);
    });

    it('should store cause when provided in options', () => {
      const cause = new Error('original error');
      const error = new AppError('wrapped', 'INTERNAL_SERVER_ERROR', 500, { cause });

      // Cause é atribuído manualmente no constructor
      const typedError = error as AppError & { cause: Error };
      expect(typedError.cause).toBe(cause);
    });

    it('should set name to class name', () => {
      const error = new AppError('test', 'BAD_REQUEST', 400);

      expect(error.name).toBe('AppError');
    });

    it('should be an instance of both AppError and Error', () => {
      const error = new AppError('test', 'BAD_REQUEST', 400);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('toJSON', () => {
    it('should return error payload with code and message', () => {
      const error = new AppError('Something went wrong', 'NOT_FOUND', 404);

      expect(error.toJSON()).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Something went wrong',
        },
      });
    });
  });
});

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------

describe('ValidationError', () => {
  describe('constructor', () => {
    it('should have statusCode 422', () => {
      const error = new ValidationError('Invalid input');

      expect(error.statusCode).toBe(422);
    });

    it('should have VALIDATION_ERROR code', () => {
      const error = new ValidationError('Invalid input');

      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should be an instance of both ValidationError and AppError', () => {
      const error = new ValidationError('Invalid input');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should store an empty details array when no details are provided', () => {
      const error = new ValidationError('Invalid input');

      expect(error.details).toEqual([]);
    });

    it('should store provided details', () => {
      const details = [{ field: 'email', value: 'not-an-email', message: 'Invalid email format' }];
      const error = new ValidationError('Invalid input', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('toPublicDetails()', () => {
    // Requisito de segurança: o campo value nunca deve ser exposto ao cliente.
    // Pode conter passwords, tokens ou outros dados sensíveis.
    it('should strip the value field from each detail', () => {
      const error = new ValidationError('Invalid input', [
        { field: 'latencyMs', value: -1, message: 'Latency must be positive' },
      ]);

      const publicDetails = error.toPublicDetails();

      expect(publicDetails[0]).not.toHaveProperty('value');
    });

    it('should preserve field and message when stripping value', () => {
      const error = new ValidationError('Invalid input', [
        { field: 'latencyMs', value: -1, message: 'Latency must be positive' },
      ]);

      expect(error.toPublicDetails()).toEqual([
        { field: 'latencyMs', message: 'Latency must be positive' },
      ]);
    });

    it('should return empty array when details is empty', () => {
      const error = new ValidationError('Invalid input');

      expect(error.toPublicDetails()).toEqual([]);
    });

    it('should strip value from all entries when multiple details are provided', () => {
      const error = new ValidationError('Invalid input', [
        { field: 'workspaceId', value: '', message: 'Workspace ID is required' },
        { field: 'endpoint', value: 'no-slash', message: 'Endpoint must start with /' },
      ]);

      const publicDetails = error.toPublicDetails();

      expect(publicDetails).toHaveLength(2);
      expect(publicDetails[0]).toEqual({
        field: 'workspaceId',
        message: 'Workspace ID is required',
      });
      expect(publicDetails[1]).toEqual({
        field: 'endpoint',
        message: 'Endpoint must start with /',
      });
    });
  });

  describe('toJSON', () => {
    it('should include details array in error payload when details are provided', () => {
      const error = new ValidationError('Invalid input', [
        { field: 'email', value: 'bad', message: 'Invalid email' },
      ]);

      expect(error.toJSON()).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: [{ field: 'email', message: 'Invalid email' }],
        },
      });
    });

    it('should not include details key when no details are provided', () => {
      const error = new ValidationError('Invalid input');

      expect(error.toJSON().error).not.toHaveProperty('details');
    });
  });
});

// ---------------------------------------------------------------------------
// NotFoundError
// ---------------------------------------------------------------------------

describe('NotFoundError', () => {
  describe('constructor', () => {
    it('should have statusCode 404', () => {
      const error = new NotFoundError('Workspace', 'ws-123');

      expect(error.statusCode).toBe(404);
    });

    it('should have NOT_FOUND code', () => {
      const error = new NotFoundError('Workspace', 'ws-123');

      expect(error.code).toBe('NOT_FOUND');
    });

    it('should generate message with default id label', () => {
      const error = new NotFoundError('Workspace', 'ws-123');

      expect(error.message).toBe("Workspace with id 'ws-123' not found");
    });

    it('should generate message with custom identifier label', () => {
      const error = new NotFoundError('User', 'john@example.com', { identifierLabel: 'email' });

      expect(error.message).toBe("User with email 'john@example.com' not found");
    });

    it('should store resource', () => {
      const error = new NotFoundError('Metric', 'metric-456');

      expect(error.resource).toBe('Metric');
    });

    it('should store identifier', () => {
      const error = new NotFoundError('Metric', 'metric-456');

      expect(error.identifier).toBe('metric-456');
    });
  });

  describe('toJSON', () => {
    it('should include resource and identifier in error payload', () => {
      const error = new NotFoundError('Metric', 'metric-456');

      expect(error.toJSON()).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: "Metric with id 'metric-456' not found",
          resource: 'Metric',
          identifier: 'metric-456',
        },
      });
    });
  });
});

// ---------------------------------------------------------------------------
// UnauthorizedError
// ---------------------------------------------------------------------------

describe('UnauthorizedError', () => {
  it('should have statusCode 401', () => {
    const error = new UnauthorizedError();

    expect(error.statusCode).toBe(401);
  });

  it('should use default message when none provided', () => {
    const error = new UnauthorizedError();

    expect(error.message).toBe('Authentication required');
  });

  it('should use custom message when provided', () => {
    const error = new UnauthorizedError('Invalid or expired token');

    expect(error.message).toBe('Invalid or expired token');
  });
});

// ---------------------------------------------------------------------------
// ForbiddenError
// ---------------------------------------------------------------------------

describe('ForbiddenError', () => {
  it('should have statusCode 403', () => {
    const error = new ForbiddenError();

    expect(error.statusCode).toBe(403);
  });

  it('should use default message when none provided', () => {
    const error = new ForbiddenError();

    expect(error.message).toBe('You do not have permission to access this resource');
  });

  it('should use custom message when provided', () => {
    const error = new ForbiddenError('Cannot delete resources in this workspace');

    expect(error.message).toBe('Cannot delete resources in this workspace');
  });
});
