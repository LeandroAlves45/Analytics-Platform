/**
 * Testes unitários da entidade Workspace.
 *
 * Cobrem: criação com input válido, validações fail-fast (name), geração de UUID,
 * slugificação via `slugFromName` (lowercase, caracteres especiais e acentos)
 * e unicidade de ids entre instâncias.
 * Não há stubs de infraestrutura — a entidade não tem I/O.
 */

import { Workspace } from '@domain/entities/Workspace';
import { ValidationError } from '@shared/errors';

describe('Workspace', () => {
  const validInput = {
    userId: '00000000-0000-4000-8000-000000000001',
    name: 'My Workspace',
    slug: 'my-workspace',
    plan: 'free' as const,
  };

  it('should create workspace with valid input', () => {
    const workspace = new Workspace(validInput);
    expect(workspace.name).toBe('My Workspace');
    expect(workspace.plan).toBe('free');
  });

  it('should default plan and status when omitted', () => {
    const { plan: _plan, ...inputWithoutPlan } = validInput;
    const workspace = new Workspace(inputWithoutPlan);
    expect(workspace.plan).toBe('free');
    expect(workspace.status).toBe('active');
  });

  it('should generate a UUID id on creation', () => {
    const workspace = new Workspace(validInput);
    expect(workspace.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('should throw ValidationError when name is empty string', () => {
    expect(() => new Workspace({ ...validInput, name: '' })).toThrow(ValidationError);
  });

  it('should convert name to lowercase slug via slugFromName', () => {
    const slug = Workspace.slugFromName('My Workspace Test');
    expect(slug).toBe('my-workspace-test');
  });

  it('should slugify special characters and accents', () => {
    const slug = Workspace.slugFromName('Research & Élite Coworking');
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug).not.toContain(' ');
  });

  it('should produce two different workspaces with different ids', () => {
    const workspace1 = new Workspace(validInput);
    const workspace2 = new Workspace(validInput);
    expect(workspace1.id).not.toBe(workspace2.id);
  });

  it('should reconstitute workspace from persistence data', () => {
    const workspace = Workspace.reconstitute({
      id: '00000000-0000-4000-8000-000000000002',
      userId: validInput.userId,
      name: 'Persisted Workspace',
      slug: 'persisted-workspace',
      plan: 'pro',
      status: 'active',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    expect(workspace.id).toBe('00000000-0000-4000-8000-000000000002');
    expect(workspace.plan).toBe('pro');
  });

  it('should throw ValidationError when userId is not a valid UUID', () => {
    expect(() => new Workspace({ ...validInput, userId: 'not-a-uuid' })).toThrow(ValidationError);
  });

  it('should throw ValidationError when slug is too short', () => {
    expect(() => new Workspace({ ...validInput, slug: 'ab' })).toThrow(ValidationError);
  });

  it('should throw ValidationError when plan is invalid', () => {
    expect(() => new Workspace({ ...validInput, plan: 'invalid-plan' })).toThrow(ValidationError);
  });

  it('should fallback to workspace slug when slugFromName produces empty string', () => {
    expect(Workspace.slugFromName('   ')).toBe('workspace');
  });
});
