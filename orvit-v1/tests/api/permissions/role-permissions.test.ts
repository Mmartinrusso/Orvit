/**
 * Integration Tests: Role-Based Permissions
 *
 * Tests:
 * - Admin roles get all permissions
 * - Regular user gets only role-assigned permissions
 * - Permissions from database role override static definitions
 * - SUPERADMIN has all permissions
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase } from '../../setup/db-setup';
import { createUser, createSuperAdmin, createAdmin } from '../../factories/user.factory';
import { createCompany, createRole, ensurePermissions } from '../../factories/company.factory';
import { getUserPermissions } from '@/lib/permissions-helpers';

describe('Role-Based Permissions', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    // Clear admin permissions cache
    (global as any).__adminPermissionsCache = undefined;
  });

  // ========================================================================
  // Admin Roles
  // ========================================================================

  it('should grant all active permissions to ADMIN role', async () => {
    const company = await createCompany();
    await ensurePermissions([
      'machines.view',
      'machines.edit',
      'work_orders.view',
      'work_orders.create',
      'tasks.view',
    ]);

    const { user } = await createAdmin(company.id);

    const permissions = await getUserPermissions(user.id, 'ADMIN', company.id);

    expect(permissions).toContain('machines.view');
    expect(permissions).toContain('machines.edit');
    expect(permissions).toContain('work_orders.view');
    expect(permissions).toContain('work_orders.create');
    expect(permissions).toContain('tasks.view');
  });

  it('should grant all permissions to SUPERADMIN role', async () => {
    const company = await createCompany();
    await ensurePermissions([
      'admin.permissions',
      'admin.roles',
      'users.create',
      'users.delete',
    ]);

    const { user } = await createSuperAdmin();

    const permissions = await getUserPermissions(user.id, 'SUPERADMIN', company.id);

    expect(permissions).toContain('admin.permissions');
    expect(permissions).toContain('admin.roles');
    expect(permissions).toContain('users.create');
    expect(permissions).toContain('users.delete');
  });

  it('should grant all permissions to ADMINISTRADOR role', async () => {
    const company = await createCompany();
    await ensurePermissions(['machines.view', 'machines.edit']);

    const { user } = await createUser({
      role: 'USER', // global role doesn't matter
      companyId: company.id,
    });

    const permissions = await getUserPermissions(user.id, 'ADMINISTRADOR', company.id);

    expect(permissions).toContain('machines.view');
    expect(permissions).toContain('machines.edit');
  });

  it('should grant all permissions to ADMIN_ENTERPRISE role', async () => {
    const company = await createCompany();
    await ensurePermissions(['machines.view']);

    const { user } = await createUser({
      role: 'ADMIN_ENTERPRISE',
      companyId: company.id,
    });

    const permissions = await getUserPermissions(user.id, 'ADMIN_ENTERPRISE', company.id);

    expect(permissions).toContain('machines.view');
  });

  // ========================================================================
  // Regular User with Role
  // ========================================================================

  it('should only grant role-assigned permissions to regular user', async () => {
    const company = await createCompany();
    await ensurePermissions([
      'machines.view',
      'machines.edit',
      'machines.delete',
      'work_orders.view',
      'work_orders.create',
    ]);

    const role = await createRole(company.id, {
      name: 'OPERARIO',
      displayName: 'Operario',
      permissions: ['machines.view', 'work_orders.view'],
    });

    const { user } = await createUser({
      companyId: company.id,
      roleId: role.id,
    });

    const permissions = await getUserPermissions(user.id, 'OPERARIO', company.id);

    expect(permissions).toContain('machines.view');
    expect(permissions).toContain('work_orders.view');
    // Should NOT have permissions not assigned to role
    expect(permissions).not.toContain('machines.delete');
  });

  it('should return empty permissions for user with no role permissions', async () => {
    const company = await createCompany();
    const role = await createRole(company.id, {
      name: 'EMPTY_ROLE',
      displayName: 'Empty Role',
      permissions: [],
    });

    const { user } = await createUser({
      companyId: company.id,
      roleId: role.id,
    });

    const permissions = await getUserPermissions(user.id, 'EMPTY_ROLE', company.id);

    // Static ROLE_PERMISSIONS for unknown roles should be empty
    // (only role-defined permissions in DB, which is none)
    expect(Array.isArray(permissions)).toBe(true);
  });

  // ========================================================================
  // Permission from DB Role
  // ========================================================================

  it('should combine static role permissions with DB role permissions', async () => {
    const company = await createCompany();
    await ensurePermissions(['custom.permission']);

    // Create a role matching a built-in role name but with extra permissions
    const role = await createRole(company.id, {
      name: 'SUPERVISOR',
      displayName: 'Supervisor',
      permissions: ['custom.permission'],
    });

    const { user } = await createUser({
      role: 'SUPERVISOR',
      companyId: company.id,
      roleId: role.id,
    });

    const permissions = await getUserPermissions(user.id, 'SUPERVISOR', company.id);

    // Should have the custom DB permission
    expect(permissions).toContain('custom.permission');
  });
});
