/**
 * Integration Tests: Bulk Permission Checks
 *
 * Tests:
 * - getUserPermissionsBulk returns permissions for multiple users
 * - Different users have different permissions
 * - Admin users get all permissions in bulk check
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase } from '../../setup/db-setup';
import { createUser, createAdmin } from '../../factories/user.factory';
import { createCompany, createRole, ensurePermissions } from '../../factories/company.factory';
import { getUserPermissionsBulk } from '@/lib/permissions-helpers';

describe('Bulk Permission Checks', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    (global as any).__adminPermissionsCache = undefined;
  });

  it('should return permissions for multiple users at once', async () => {
    const company = await createCompany();
    await ensurePermissions(['machines.view', 'machines.edit', 'work_orders.view']);

    const role1 = await createRole(company.id, {
      name: 'ROLE_A',
      displayName: 'Role A',
      permissions: ['machines.view', 'machines.edit'],
    });

    const role2 = await createRole(company.id, {
      name: 'ROLE_B',
      displayName: 'Role B',
      permissions: ['work_orders.view'],
    });

    const { user: user1 } = await createUser({
      companyId: company.id,
      roleId: role1.id,
    });

    const { user: user2 } = await createUser({
      companyId: company.id,
      roleId: role2.id,
    });

    const result = await getUserPermissionsBulk(
      [user1.id, user2.id],
      company.id
    );

    expect(result.size).toBe(2);

    const user1Perms = result.get(user1.id);
    const user2Perms = result.get(user2.id);

    expect(user1Perms).toBeDefined();
    expect(user2Perms).toBeDefined();

    expect(user1Perms).toContain('machines.view');
    expect(user1Perms).toContain('machines.edit');

    expect(user2Perms).toContain('work_orders.view');
    expect(user2Perms).not.toContain('machines.edit');
  });

  it('should handle admin users in bulk check', async () => {
    const company = await createCompany();
    await ensurePermissions(['machines.view', 'admin.permissions']);

    const { user: adminUser } = await createAdmin(company.id);
    const role = await createRole(company.id, {
      name: 'BASIC_R',
      displayName: 'Basic',
      permissions: ['machines.view'],
    });

    const { user: regularUser } = await createUser({
      companyId: company.id,
      roleId: role.id,
    });

    const result = await getUserPermissionsBulk(
      [adminUser.id, regularUser.id],
      company.id
    );

    const adminPerms = result.get(adminUser.id);
    const regularPerms = result.get(regularUser.id);

    // Admin should have all permissions
    expect(adminPerms).toContain('machines.view');
    expect(adminPerms).toContain('admin.permissions');

    // Regular user should only have role permissions
    expect(regularPerms).toContain('machines.view');
    expect(regularPerms).not.toContain('admin.permissions');
  });

  it('should return empty map for non-existent users', async () => {
    const company = await createCompany();

    const result = await getUserPermissionsBulk(
      [99998, 99999],
      company.id
    );

    expect(result.size).toBe(0);
  });

  it('should handle empty user ID array', async () => {
    const company = await createCompany();

    const result = await getUserPermissionsBulk([], company.id);

    expect(result.size).toBe(0);
  });
});
