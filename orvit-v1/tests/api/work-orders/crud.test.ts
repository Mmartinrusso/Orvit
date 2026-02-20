/**
 * Integration Tests: Work Orders CRUD
 *
 * Tests:
 * - GET /api/work-orders - List work orders with filters
 * - GET /api/work-orders/[id] - Get single work order
 * - POST /api/work-orders - Create work order
 * - PUT /api/work-orders/[id] - Update work order
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

vi.mock('@/lib/metrics', () => ({
  trackCount: vi.fn().mockResolvedValue(undefined),
  trackDuration: vi.fn().mockResolvedValue(undefined),
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

  // ========================================================================
  // GET /api/work-orders/[id] - Single work order
  // ========================================================================

  it('should return a single work order by id', async () => {
    const { company, sector } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      title: 'Single WO',
      description: 'Test detail view',
      priority: 'HIGH',
      type: 'PREVENTIVE',
      createdById: user.id,
      companyId: company.id,
      sectorId: sector.id,
    });

    const { GET } = await import('@/app/api/work-orders/[id]/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders/${workOrder.id}`,
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
    );

    const response = await GET(request, { params: { id: String(workOrder.id) } });
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.id).toBe(workOrder.id);
    expect(data.title).toBe('Single WO');
    expect(data.priority).toBe('HIGH');
    expect(data.type).toBe('PREVENTIVE');
    expect(data.createdBy).toBeDefined();
    expect(data.createdBy.id).toBe(user.id);
  });

  it('should return 404 for non-existent work order', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const { GET } = await import('@/app/api/work-orders/[id]/route');
    const request = await createAuthenticatedRequest(
      '/api/work-orders/999999',
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
    );

    const response = await GET(request, { params: { id: '999999' } });
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(404);
  });

  // ========================================================================
  // PUT /api/work-orders/[id] - Update work order
  // ========================================================================

  it('should update a work order title and priority', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      title: 'Original Title',
      priority: 'LOW',
      createdById: user.id,
      companyId: company.id,
    });

    const { PUT } = await import('@/app/api/work-orders/[id]/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders/${workOrder.id}`,
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      {
        method: 'PUT',
        body: {
          title: 'Updated Title',
          priority: 'URGENT',
        },
      }
    );

    const response = await PUT(request, { params: { id: String(workOrder.id) } });
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.title).toBe('Updated Title');
    expect(data.priority).toBe('URGENT');

    // Verify in database
    const dbWO = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
    expect(dbWO?.title).toBe('Updated Title');
    expect(dbWO?.priority).toBe('URGENT');
  });

  it('should update work order status to IN_PROGRESS and auto-set startedDate', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      title: 'Status WO',
      status: 'PENDING',
      createdById: user.id,
      companyId: company.id,
    });

    const { PUT } = await import('@/app/api/work-orders/[id]/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders/${workOrder.id}`,
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      {
        method: 'PUT',
        body: { status: 'IN_PROGRESS' },
      }
    );

    const response = await PUT(request, { params: { id: String(workOrder.id) } });
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.status).toBe('IN_PROGRESS');
    expect(data.startedDate).not.toBeNull();
  });

  it('should update work order status to COMPLETED and auto-set completedDate', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      title: 'Complete WO',
      status: 'IN_PROGRESS',
      createdById: user.id,
      companyId: company.id,
    });

    const { PUT } = await import('@/app/api/work-orders/[id]/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders/${workOrder.id}`,
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      {
        method: 'PUT',
        body: { status: 'COMPLETED' },
      }
    );

    const response = await PUT(request, { params: { id: String(workOrder.id) } });
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.status).toBe('COMPLETED');
    expect(data.completedDate).not.toBeNull();
  });

  it('should return 404 when updating non-existent work order', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const { PUT } = await import('@/app/api/work-orders/[id]/route');
    const request = await createAuthenticatedRequest(
      '/api/work-orders/999999',
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      {
        method: 'PUT',
        body: { title: 'Nope' },
      }
    );

    const response = await PUT(request, { params: { id: '999999' } });
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(404);
  });

  it('should assign work order to another user', async () => {
    const { company } = await createFullCompanySetup();
    const { user: admin } = await createAdmin(company.id);
    const { user: technician } = await createUser({ companyId: company.id });

    const workOrder = await createWorkOrder({
      title: 'Assign WO',
      createdById: admin.id,
      companyId: company.id,
    });

    const { PUT } = await import('@/app/api/work-orders/[id]/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders/${workOrder.id}`,
      { userId: admin.id, companyId: company.id, role: 'ADMIN' },
      {
        method: 'PUT',
        body: { assignedToId: technician.id },
      }
    );

    const response = await PUT(request, { params: { id: String(workOrder.id) } });
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.assignedToId).toBe(technician.id);
    expect(data.assignedTo).toBeDefined();
    expect(data.assignedTo.id).toBe(technician.id);
  });

  // ========================================================================
  // DELETE /api/work-orders/[id] - Delete via [id] route
  // ========================================================================

  it('should delete a work order via [id] route', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      title: 'Delete Via ID',
      createdById: user.id,
      companyId: company.id,
    });

    const { DELETE } = await import('@/app/api/work-orders/[id]/route');
    const request = await createAuthenticatedRequest(
      `/api/work-orders/${workOrder.id}`,
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
    );

    const response = await DELETE(request, { params: { id: String(workOrder.id) } });

    expect(response.status).toBe(204);

    // Verify deleted from database
    const dbWO = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
    expect(dbWO).toBeNull();
  });
});
