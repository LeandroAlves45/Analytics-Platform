/**
 * Testes de integração directos ao DrizzleWorkspaceRepository.
 * Cobrem membership, workspace inexistente e conflito de slug.
 */

import { randomUUID } from 'node:crypto';

import { Workspace } from '@domain/entities/Workspace';
import { AppError, ValidationError } from '@shared/errors';
import { getDatabase } from '@infra/frameworks/database';
import { users } from '@infra/frameworks/database/schema';
import { DrizzleWorkspaceRepository } from '@infra/repositories/DrizzleWorkspaceRepository';

import { TEST_USER_ID } from '../fixtures/metrics';

function createRepository(): DrizzleWorkspaceRepository {
  return new DrizzleWorkspaceRepository(getDatabase());
}

function createWorkspace(overrides?: { slug?: string; userId?: string }): Workspace {
  const suffix = Date.now();
  return new Workspace({
    userId: overrides?.userId ?? TEST_USER_ID,
    name: `Repo Test ${suffix}`,
    slug: overrides?.slug ?? `repo-test-${suffix}`,
  });
}

describe('DrizzleWorkspaceRepository -> integration', () => {
  describe('findById', () => {
    it('should return null for non-existent workspace', async () => {
      const repo = createRepository();

      const result = await repo.findById('00000000-0000-4000-8000-000000000099');

      expect(result).toBeNull();
    });

    it('should reconstitute workspace after save', async () => {
      const repo = createRepository();
      const workspace = createWorkspace();
      const saved = await repo.save(workspace);

      const found = await repo.findById(saved.id);

      expect(found).not.toBeNull();
      expect(found!.slug).toBe(workspace.slug);
      expect(found!.userId).toBe(TEST_USER_ID);
    });
  });

  describe('findByUserId', () => {
    it('should return null when user has no workspace', async () => {
      const repo = createRepository();
      const orphanUserId = randomUUID();

      await getDatabase()
        .insert(users)
        .values({
          id: orphanUserId,
          email: `orphan-${Date.now()}@integration.local`,
          passwordHash: 'hash',
        });

      const result = await repo.findByUserId(orphanUserId);

      expect(result).toBeNull();
    });
  });

  describe('save slug conflict', () => {
    it('should throw ValidationError when slug is already taken', async () => {
      const repo = createRepository();
      const slug = `duplicate-slug-${Date.now()}`;

      await repo.save(createWorkspace({ slug }));

      await expect(repo.save(createWorkspace({ slug }))).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('membership', () => {
    it('should return false when user is not a member', async () => {
      const repo = createRepository();
      const saved = await repo.save(createWorkspace());
      const otherUserId = randomUUID();

      await getDatabase()
        .insert(users)
        .values({
          id: otherUserId,
          email: `member-test-${Date.now()}@integration.local`,
          passwordHash: 'hash',
        });

      const isMember = await repo.isMember(saved.id, otherUserId);

      expect(isMember).toBe(false);
    });

    it('should return true after addMember', async () => {
      const repo = createRepository();
      const saved = await repo.save(createWorkspace());
      const memberUserId = randomUUID();

      await getDatabase()
        .insert(users)
        .values({
          id: memberUserId,
          email: `added-member-${Date.now()}@integration.local`,
          passwordHash: 'hash',
        });

      await repo.addMember(saved.id, memberUserId, 'member');

      expect(await repo.isMember(saved.id, memberUserId)).toBe(true);
    });

    it('should throw AppError when addMember fails for non-existent workspace', async () => {
      const repo = createRepository();
      const memberUserId = randomUUID();

      await getDatabase()
        .insert(users)
        .values({
          id: memberUserId,
          email: `fk-fail-${Date.now()}@integration.local`,
          passwordHash: 'hash',
        });

      await expect(
        repo.addMember('00000000-0000-4000-8000-000000000099', memberUserId, 'member')
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('updatePlan', () => {
    it('should update plan without error even when workspace does not exist', async () => {
      const repo = createRepository();

      await expect(
        repo.updatePlan('00000000-0000-4000-8000-000000000099', 'pro')
      ).resolves.toBeUndefined();
    });

    it('should persist new plan for existing workspace', async () => {
      const repo = createRepository();
      const saved = await repo.save(createWorkspace());

      await repo.updatePlan(saved.id, 'business');

      const found = await repo.findById(saved.id);
      expect(found!.plan).toBe('business');
    });
  });
});
