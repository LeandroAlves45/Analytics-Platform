/**
 * Testes unitários da entidade ApiKey.
 *
 * Cobrem: validação de domínio (workspaceId UUID, name, keyHash, keyPreview),
 * comportamento de isActive(), geração de plaintext key com prefixo apk_.
 * Zero I/O — entidade pura sem dependências externas.
 */

import { ApiKey } from '@domain/entities/ApiKey';
import { ValidationError } from '@shared/errors';

const validInput = {
  workspaceId: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Prod SDK',
  keyHash: '$2a$10$hashedkeyvalue00000000',
  keyPreview: 'abcd1234',
};

describe('ApiKey', () => {
  describe('validation', () => {
    it('should throw ValidationError when workspaceId is not a valid UUID', () => {
      expect(() => new ApiKey({ ...validInput, workspaceId: 'ws-1' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when name is empty after trim', () => {
      expect(() => new ApiKey({ ...validInput, name: '   ' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when keyHash is missing', () => {
      expect(() => new ApiKey({ ...validInput, keyHash: '' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when keyPreview has fewer than 4 characters', () => {
      expect(() => new ApiKey({ ...validInput, keyPreview: 'abc' })).toThrow(ValidationError);
    });

    it('should create api key with valid input', () => {
      const key = new ApiKey(validInput);
      expect(key.workspaceId).toBe(validInput.workspaceId);
      expect(key.name).toBe('Prod SDK');
      expect(key.status).toBe('active');
    });

    it('should trim name on creation', () => {
      const key = new ApiKey({ ...validInput, name: '  My Key  ' });
      expect(key.name).toBe('My Key');
    });
  });

  describe('isActive()', () => {
    it('should return true for active status', () => {
      const key = new ApiKey(validInput);
      expect(key.isActive()).toBe(true);
    });

    it('should return false for revoked status', () => {
      const key = new ApiKey({ ...validInput, status: 'revoked' });
      expect(key.isActive()).toBe(false);
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute api key from persistence data', () => {
      const key = ApiKey.reconstitute({
        id: '00000000-0000-4000-8000-000000000003',
        workspaceId: validInput.workspaceId,
        name: 'Restored Key',
        keyHash: validInput.keyHash,
        keyPreview: validInput.keyPreview,
        status: 'revoked',
        lastUsedAt: new Date('2025-06-01'),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-06-01'),
      });

      expect(key.id).toBe('00000000-0000-4000-8000-000000000003');
      expect(key.status).toBe('revoked');
      expect(key.lastUsedAt).toEqual(new Date('2025-06-01'));
    });
  });

  describe('generatePlaintextKey()', () => {
    it('should always start with apk_ prefix', () => {
      expect(ApiKey.generatePlaintextKey()).toMatch(/^apk_/);
    });

    it('should produce unique keys on each call', () => {
      const key1 = ApiKey.generatePlaintextKey();
      const key2 = ApiKey.generatePlaintextKey();
      expect(key1).not.toBe(key2);
    });

    it('should have substantial length for security', () => {
      expect(ApiKey.generatePlaintextKey().length).toBeGreaterThan(20);
    });
  });
});
