/**
 * Integration Tests: Work Order Comments
 *
 * Tests:
 * - Creating comments on work orders
 * - Reading comments
 * - Comment author tracking
 * - Multiple comments on single work order
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser, createAdmin } from '../../factories/user.factory';
import { createFullCompanySetup } from '../../factories/company.factory';
import { createWorkOrder, createWorkOrderWithComment } from '../../factories/workorder.factory';

describe('Work Order Comments', () => {
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
  // Create Comments
  // ========================================================================

  it('should create a comment on a work order', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      createdById: user.id,
      companyId: company.id,
    });

    const comment = await prisma.workOrderComment.create({
      data: {
        workOrderId: workOrder.id,
        userId: user.id,
        content: 'This is a test comment',
      },
    });

    expect(comment.id).toBeDefined();
    expect(comment.content).toBe('This is a test comment');
    expect(comment.workOrderId).toBe(workOrder.id);
    expect(comment.userId).toBe(user.id);
  });

  it('should create work order with comment using factory', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const { workOrder, comment } = await createWorkOrderWithComment(
      { createdById: user.id, companyId: company.id },
      user.id,
      'Factory comment'
    );

    expect(workOrder.id).toBeDefined();
    expect(comment.content).toBe('Factory comment');
    expect(comment.workOrderId).toBe(workOrder.id);
  });

  // ========================================================================
  // Read Comments
  // ========================================================================

  it('should retrieve all comments for a work order', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);
    const { user: tech } = await createUser({ companyId: company.id });

    const workOrder = await createWorkOrder({
      createdById: user.id,
      companyId: company.id,
    });

    await prisma.workOrderComment.createMany({
      data: [
        { workOrderId: workOrder.id, userId: user.id, content: 'Admin comment' },
        { workOrderId: workOrder.id, userId: tech.id, content: 'Tech comment' },
        { workOrderId: workOrder.id, userId: user.id, content: 'Follow-up' },
      ],
    });

    const comments = await prisma.workOrderComment.findMany({
      where: { workOrderId: workOrder.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    expect(comments.length).toBe(3);
    expect(comments[0].content).toBe('Admin comment');
    expect(comments[1].content).toBe('Tech comment');
    expect(comments[2].content).toBe('Follow-up');
  });

  it('should include author information in comments', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      createdById: user.id,
      companyId: company.id,
    });

    await prisma.workOrderComment.create({
      data: {
        workOrderId: workOrder.id,
        userId: user.id,
        content: 'Author comment',
      },
    });

    const comments = await prisma.workOrderComment.findMany({
      where: { workOrderId: workOrder.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    expect(comments[0].user.id).toBe(user.id);
    expect(comments[0].user.name).toBe(user.name);
  });

  // ========================================================================
  // Comments don't leak between work orders
  // ========================================================================

  it('should not mix comments between work orders', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const wo1 = await createWorkOrder({
      title: 'WO 1',
      createdById: user.id,
      companyId: company.id,
    });
    const wo2 = await createWorkOrder({
      title: 'WO 2',
      createdById: user.id,
      companyId: company.id,
    });

    await prisma.workOrderComment.create({
      data: { workOrderId: wo1.id, userId: user.id, content: 'Comment for WO1' },
    });
    await prisma.workOrderComment.create({
      data: { workOrderId: wo2.id, userId: user.id, content: 'Comment for WO2' },
    });

    const wo1Comments = await prisma.workOrderComment.findMany({
      where: { workOrderId: wo1.id },
    });
    const wo2Comments = await prisma.workOrderComment.findMany({
      where: { workOrderId: wo2.id },
    });

    expect(wo1Comments.length).toBe(1);
    expect(wo1Comments[0].content).toBe('Comment for WO1');
    expect(wo2Comments.length).toBe(1);
    expect(wo2Comments[0].content).toBe('Comment for WO2');
  });
});
