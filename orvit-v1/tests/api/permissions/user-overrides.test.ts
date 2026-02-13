/**
 * Integration Tests: User Permission Overrides
 *
 * Tests:
 * - User-specific grant overrides role denial
 * - User-specific denial overrides role grant
 * - Expired user permissions are ignored
 * - Admin denial overrides all-permissions grant
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase } from '../../setup/db-setup';
import { createUser, createAdmin } from '../../factories/user.factory';
import { createCompany, createRole, ensurePermissions, grantUserPermission, denyUserPermission } from '../../factories/company.factory';
import { getUserPermissions, hasUserPermission } from '@/lib/permissions-helpers';

describe('User Permission Overrides', () => {
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

  // ========================================================================
  // Grant Override
  // ========================================================================

  it('should grant permission to user even if role does not have it', async () => {
    const company = await createCompany();
    await ensurePermissions(['machines.view', 'machines.edit', 'machines.delete']);

    const role = await createRole(company.id, {
      name: 'LIMITED',
      displayName: 'Limited',
      permissions: ['machines.view'],
    });

    const { user } = await createUser({
      companyId: company.id,
      roleId: role.id,
    });

    // Grant machines.edit directly to user (not in role)
    await grantUserPermission(user.id, 'machines.edit');

    const permissions = await getUserPermissions(user.id, 'LIMITED', company.id);

    expect(permissions).toContain('machines.view'); // from role
    expect(permissions).toContain('machines.edit'); // from user override
    expect(permissions).not.toContain('machines.delete'); // not granted anywhere
  });

  // ========================================================================
  // Denial Override
  // ========================================================================

  it('should deny permission to user even if role has it', async () => {
    const company = await createCompany();
    await ensurePermissions(['machines.view', 'machines.edit']);

    const role = await createRole(company.id, {
      name: 'TECH',
      displayName: 'Technician',
      permissions: ['machines.view', 'machines.edit'],
    });

    const { user } = await createUser({
      companyId: company.id,
      roleId: role.id,
    });

    // Deny machines.edit specifically for this user
    await denyUserPermission(user.id, 'machines.edit');

    const permissions = await getUserPermissions(user.id, 'TECH', company.id);

    expect(permissions).toContain('machines.view'); // still from role
    expect(permissions).not.toContain('machines.edit'); // denied by override
  });

  // ========================================================================
  // Admin Denial
  // ========================================================================

  it('should deny specific permission to admin user via user override', async () => {
    const company = await createCompany();
    await ensurePermissions(['admin.system_settings', 'admin.permissions']);

    const { user } = await createAdmin(company.id);

    // Deny a specific permission for this admin
    await denyUserPermission(user.id, 'admin.system_settings');

    const permissions = await getUserPermissions(user.id, 'ADMIN', company.id);

    // Admin gets all permissions EXCEPT the denied one
    expect(permissions).toContain('admin.permissions');
    expect(permissions).not.toContain('admin.system_settings');
  });

  // ========================================================================
  // Expired Permissions
  // ========================================================================

  it('should ignore expired user permission grants', async () => {
    const company = await createCompany();
    await ensurePermissions(['machines.delete']);

    const role = await createRole(company.id, {
      name: 'BASIC',
      displayName: 'Basic',
      permissions: [],
    });

    const { user } = await createUser({
      companyId: company.id,
      roleId: role.id,
    });

    // Grant permission that expired yesterday
    await grantUserPermission(user.id, 'machines.delete', {
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const permissions = await getUserPermissions(user.id, 'BASIC', company.id);

    // Expired permission should not be included
    expect(permissions).not.toContain('machines.delete');
  });

  it('should include non-expired user permission grants', async () => {
    const company = await createCompany();
    await ensurePermissions(['machines.delete']);

    const role = await createRole(company.id, {
      name: 'BASIC2',
      displayName: 'Basic 2',
      permissions: [],
    });

    const { user } = await createUser({
      companyId: company.id,
      roleId: role.id,
    });

    // Grant permission that expires tomorrow
    await grantUserPermission(user.id, 'machines.delete', {
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const permissions = await getUserPermissions(user.id, 'BASIC2', company.id);

    expect(permissions).toContain('machines.delete');
  });

  // ========================================================================
  // hasUserPermission Helper
  // ========================================================================

  it('should return true for hasUserPermission when user has permission', async () => {
    const company = await createCompany();
    await ensurePermissions(['machines.view']);

    const role = await createRole(company.id, {
      name: 'VIEWER',
      displayName: 'Viewer',
      permissions: ['machines.view'],
    });

    const { user } = await createUser({
      companyId: company.id,
      roleId: role.id,
    });

    const result = await hasUserPermission(user.id, company.id, 'machines.view');

    expect(result).toBe(true);
  });

  it('should return false for hasUserPermission when user lacks permission', async () => {
    const company = await createCompany();
    await ensurePermissions(['machines.delete']);

    const role = await createRole(company.id, {
      name: 'NODEL',
      displayName: 'No Delete',
      permissions: [],
    });

    const { user } = await createUser({
      companyId: company.id,
      roleId: role.id,
    });

    const result = await hasUserPermission(user.id, company.id, 'machines.delete');

    expect(result).toBe(false);
  });
});
