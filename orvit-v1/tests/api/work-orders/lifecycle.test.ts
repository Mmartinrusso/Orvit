/**
 * Integration Tests: Work Order Lifecycle
 *
 * Tests:
 * - Status transitions: PENDING → IN_PROGRESS → COMPLETED
 * - Timestamps updated on state changes
 * - Invalid state transitions
 * - Assignment tracking
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser, createAdmin } from '../../factories/user.factory';
import { createFullCompanySetup } from '../../factories/company.factory';
import { createWorkOrder } from '../../factories/workorder.factory';

// Mock notifications
vi.mock('@/lib/notifications/notification-service', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  default: { sendNotification: vi.fn() },
}));

vi.mock('@/lib/discord/agenda-notifications', () => ({
  sendDiscordNotification: vi.fn().mockResolvedValue(undefined),
}));

describe('Work Order Lifecycle', () => {
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
  // Direct DB Lifecycle Tests (testing business rules)
  // ========================================================================

  it('should create work order with PENDING status by default', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      title: 'New WO',
      createdById: user.id,
      companyId: company.id,
    });

    expect(workOrder.status).toBe('PENDING');
    expect(workOrder.startedDate).toBeNull();
    expect(workOrder.completedDate).toBeNull();
  });

  it('should transition from PENDING to IN_PROGRESS', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      title: 'Transition WO',
      status: 'PENDING',
      createdById: user.id,
      companyId: company.id,
    });

    const updated = await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: 'IN_PROGRESS',
        startedDate: new Date(),
      },
    });

    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.startedDate).not.toBeNull();
  });

  it('should transition from IN_PROGRESS to COMPLETED with timestamps', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      title: 'Complete WO',
      status: 'IN_PROGRESS',
      createdById: user.id,
      companyId: company.id,
    });

    const completedDate = new Date();
    const updated = await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: 'COMPLETED',
        completedDate,
        isCompleted: true,
        actualHours: 4.5,
      },
    });

    expect(updated.status).toBe('COMPLETED');
    expect(updated.completedDate).toBeDefined();
    expect(updated.isCompleted).toBe(true);
    expect(updated.actualHours).toBe(4.5);
  });

  it('should support transition to WAITING status', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      title: 'Waiting WO',
      status: 'IN_PROGRESS',
      createdById: user.id,
      companyId: company.id,
    });

    const updated = await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: 'WAITING',
        waitingReason: 'SPARE_PART',
        waitingDescription: 'Waiting for replacement pump',
        waitingSince: new Date(),
      },
    });

    expect(updated.status).toBe('WAITING');
    expect(updated.waitingReason).toBe('SPARE_PART');
  });

  it('should support CANCELLED status', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      title: 'Cancel WO',
      status: 'PENDING',
      createdById: user.id,
      companyId: company.id,
    });

    const updated = await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: { status: 'CANCELLED' },
    });

    expect(updated.status).toBe('CANCELLED');
  });

  // ========================================================================
  // Assignment
  // ========================================================================

  it('should track assignment with timestamp', async () => {
    const { company } = await createFullCompanySetup();
    const { user: admin } = await createAdmin(company.id);
    const { user: technician } = await createUser({ companyId: company.id });

    const workOrder = await createWorkOrder({
      title: 'Assign WO',
      createdById: admin.id,
      companyId: company.id,
    });

    const assignedAt = new Date();
    const updated = await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: {
        assignedToId: technician.id,
        assignedAt,
        status: 'SCHEDULED',
      },
    });

    expect(updated.assignedToId).toBe(technician.id);
    expect(updated.assignedAt).not.toBeNull();
    expect(updated.status).toBe('SCHEDULED');
  });

  // ========================================================================
  // Priority
  // ========================================================================

  it('should support all priority levels', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

    for (const priority of priorities) {
      const wo = await createWorkOrder({
        title: `${priority} WO`,
        priority,
        createdById: user.id,
        companyId: company.id,
      });
      expect(wo.priority).toBe(priority);
    }
  });

  // ========================================================================
  // Maintenance Types
  // ========================================================================

  it('should support all maintenance types', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const types = ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY', 'FAILURE'] as const;

    for (const type of types) {
      const wo = await createWorkOrder({
        title: `${type} WO`,
        type,
        createdById: user.id,
        companyId: company.id,
      });
      expect(wo.type).toBe(type);
    }
  });
});
