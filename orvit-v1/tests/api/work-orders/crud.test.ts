/**
 * Integration Tests: Work Orders CRUD
 *
 * Tests:
 * - GET /api/work-orders - List work orders with filters
 * - POST /api/work-orders - Create work order
 * - DELETE /api/work-orders - Delete work order
 * - Permission checks
 * - Company-scoped queries
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser, createAdmin, createSuperAdmin } from '../../factories/user.factory';
import { createCompany, createFullCompanySetup, ensurePermissions, grantUserPermission } from '../../factories/company.factory';
import { createWorkOrder, createMachine } from '../../factories/workorder.factory';
import { createAuthenticatedRequest, createMockRequest, parseJsonResponse } from '../../utils/test-helpers';

// Mock notification-related imports that fire-and-forget
vi.mock('@/lib/notifications/notification-service', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  default: { sendNotification: vi.fn() },
}));

vi.mock('@/lib/discord/agenda-notifications', () => ({
  sendDiscordNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/automation/engine', () => ({
  triggerWorkOrderCreated: vi.fn().mockResolvedValue(undefined),
  triggerWorkOrderStatusChanged: vi.fn().mockResolvedValue(undefined),
  triggerWorkOrderAssigned: vi.fn().mockResolvedValue(undefined),
}));

describe('Work Orders CRUD', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await initTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  // ========================================================================
  // GET /api/work-orders
  // ========================================================================

  it('should return work orders for a company', async () => {
    const { company, sector } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    await createWorkOrder({
      title: 'WO-1',
      createdById: user.id,
      companyId: company.id,
      sectorId: sector.id,
    });
    await createWorkOrder({
      title: 'WO-2',
      createdById: user.id,
      companyId: company.id,
    });

    const { GET } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders?companyId=${company.id}`,
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      { searchParams: { companyId: String(company.id) } }
    );

    const response = await GET(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });

  it('should filter work orders by status', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    await createWorkOrder({
      title: 'Pending WO',
      status: 'PENDING',
      createdById: user.id,
      companyId: company.id,
    });
    await createWorkOrder({
      title: 'Completed WO',
      status: 'COMPLETED',
      createdById: user.id,
      companyId: company.id,
    });

    const { GET } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders?companyId=${company.id}&status=PENDING`,
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      { searchParams: { companyId: String(company.id), status: 'PENDING' } }
    );

    const response = await GET(request);
    const { data } = await parseJsonResponse(response);

    expect(data.length).toBe(1);
    expect(data[0].title).toBe('Pending WO');
  });

  it('should filter work orders by priority', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    await createWorkOrder({
      title: 'Low WO',
      priority: 'LOW',
      createdById: user.id,
      companyId: company.id,
    });
    await createWorkOrder({
      title: 'Urgent WO',
      priority: 'URGENT',
      createdById: user.id,
      companyId: company.id,
    });

    const { GET } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders?companyId=${company.id}&priority=URGENT`,
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      { searchParams: { companyId: String(company.id), priority: 'URGENT' } }
    );

    const response = await GET(request);
    const { data } = await parseJsonResponse(response);

    expect(data.length).toBe(1);
    expect(data[0].title).toBe('Urgent WO');
  });

  // ========================================================================
  // POST /api/work-orders
  // ========================================================================

  it('should create a work order with valid data', async () => {
    const { company, sector } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const { POST } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      '/api/work-orders',
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      {
        method: 'POST',
        body: {
          title: 'New Work Order',
          description: 'Test description',
          priority: 'HIGH',
          type: 'CORRECTIVE',
          createdById: user.id,
          companyId: company.id,
          sectorId: sector.id,
        },
      }
    );

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(201);
    expect(data.title).toBe('New Work Order');
    expect(data.priority).toBe('HIGH');
    expect(data.type).toBe('CORRECTIVE');
    expect(data.companyId).toBe(company.id);

    // Verify in database
    const dbWO = await prisma.workOrder.findUnique({ where: { id: data.id } });
    expect(dbWO).not.toBeNull();
    expect(dbWO?.title).toBe('New Work Order');
  });

  it('should create a work order assigned to a machine', async () => {
    const { company, sector } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);
    const machine = await createMachine({
      sectorId: sector.id,
      companyId: company.id,
    });

    const { POST } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      '/api/work-orders',
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      {
        method: 'POST',
        body: {
          title: 'Machine WO',
          type: 'CORRECTIVE',
          machineId: machine.id,
          createdById: user.id,
          companyId: company.id,
        },
      }
    );

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(201);
    expect(data.machineId).toBe(machine.id);
  });

  // ========================================================================
  // DELETE /api/work-orders
  // ========================================================================

  it('should allow creator to delete their work order', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createUser({ companyId: company.id });

    const workOrder = await createWorkOrder({
      title: 'To Delete',
      createdById: user.id,
      companyId: company.id,
    });

    const { DELETE } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders?id=${workOrder.id}&userId=${user.id}`,
      { userId: user.id, companyId: company.id },
      { searchParams: { id: String(workOrder.id), userId: String(user.id) } }
    );

    const response = await DELETE(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(200);

    // Verify deleted
    const dbWO = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
    expect(dbWO).toBeNull();
  });

  it('should allow SUPERADMIN to delete any work order', async () => {
    const { company } = await createFullCompanySetup();
    const { user: creator } = await createUser({ companyId: company.id });
    const { user: superadmin } = await createSuperAdmin();

    const workOrder = await createWorkOrder({
      title: 'Admin Delete',
      createdById: creator.id,
      companyId: company.id,
    });

    const { DELETE } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders?id=${workOrder.id}&userId=${superadmin.id}`,
      { userId: superadmin.id, role: 'SUPERADMIN' },
      { searchParams: { id: String(workOrder.id), userId: String(superadmin.id) } }
    );

    const response = await DELETE(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(200);
  });

  it('should reject delete from non-creator without permission', async () => {
    const { company } = await createFullCompanySetup();
    const { user: creator } = await createUser({ companyId: company.id });
    const { user: otherUser } = await createUser({ companyId: company.id });

    const workOrder = await createWorkOrder({
      title: 'No Delete',
      createdById: creator.id,
      companyId: company.id,
    });

    const { DELETE } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders?id=${workOrder.id}&userId=${otherUser.id}`,
      { userId: otherUser.id, companyId: company.id },
      { searchParams: { id: String(workOrder.id), userId: String(otherUser.id) } }
    );

    const response = await DELETE(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(403);
  });

  it('should reject delete with missing parameters', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const { DELETE } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      '/api/work-orders',
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
    );

    const response = await DELETE(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(400);
  });
});
