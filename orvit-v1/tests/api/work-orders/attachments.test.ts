/**
 * Integration Tests: Work Order Attachments
 *
 * Tests:
 * - Creating attachments on work orders
 * - Attachment metadata tracking
 * - S3 URL storage
 * - Multiple attachments per work order
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser, createAdmin } from '../../factories/user.factory';
import { createFullCompanySetup } from '../../factories/company.factory';
import { createWorkOrder, createWorkOrderWithAttachment } from '../../factories/workorder.factory';

describe('Work Order Attachments', () => {
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
  // Create Attachments
  // ========================================================================

  it('should create an attachment on a work order', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      createdById: user.id,
      companyId: company.id,
    });

    const attachment = await prisma.workOrderAttachment.create({
      data: {
        workOrderId: workOrder.id,
        fileName: 'photo.jpg',
        fileUrl: 'https://s3.example.com/photo.jpg',
        fileType: 'image/jpeg',
        fileSize: 2048,
        uploadedById: user.id,
      },
    });

    expect(attachment.id).toBeDefined();
    expect(attachment.fileName).toBe('photo.jpg');
    expect(attachment.fileType).toBe('image/jpeg');
    expect(attachment.fileSize).toBe(2048);
    expect(attachment.uploadedById).toBe(user.id);
  });

  it('should create work order with attachment using factory', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const { workOrder, attachment } = await createWorkOrderWithAttachment(
      { createdById: user.id, companyId: company.id },
      user.id
    );

    expect(workOrder.id).toBeDefined();
    expect(attachment.workOrderId).toBe(workOrder.id);
    expect(attachment.fileName).toBe('test-file.pdf');
    expect(attachment.fileUrl).toContain('mock-s3');
  });

  // ========================================================================
  // Multiple Attachments
  // ========================================================================

  it('should support multiple attachments per work order', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      createdById: user.id,
      companyId: company.id,
    });

    await prisma.workOrderAttachment.createMany({
      data: [
        {
          workOrderId: workOrder.id,
          fileName: 'doc1.pdf',
          fileUrl: 'https://s3.example.com/doc1.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          uploadedById: user.id,
        },
        {
          workOrderId: workOrder.id,
          fileName: 'image1.png',
          fileUrl: 'https://s3.example.com/image1.png',
          fileType: 'image/png',
          fileSize: 5120,
          uploadedById: user.id,
        },
        {
          workOrderId: workOrder.id,
          fileName: 'video.mp4',
          fileUrl: 'https://s3.example.com/video.mp4',
          fileType: 'video/mp4',
          fileSize: 10240,
          uploadedById: user.id,
        },
      ],
    });

    const attachments = await prisma.workOrderAttachment.findMany({
      where: { workOrderId: workOrder.id },
    });

    expect(attachments.length).toBe(3);
  });

  // ========================================================================
  // Attachment Isolation
  // ========================================================================

  it('should not mix attachments between work orders', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const wo1 = await createWorkOrder({
      title: 'WO with attachments 1',
      createdById: user.id,
      companyId: company.id,
    });
    const wo2 = await createWorkOrder({
      title: 'WO with attachments 2',
      createdById: user.id,
      companyId: company.id,
    });

    await prisma.workOrderAttachment.create({
      data: {
        workOrderId: wo1.id,
        fileName: 'wo1-file.pdf',
        fileUrl: 'https://s3.example.com/wo1-file.pdf',
        fileType: 'application/pdf',
        fileSize: 512,
        uploadedById: user.id,
      },
    });

    const wo1Attachments = await prisma.workOrderAttachment.findMany({
      where: { workOrderId: wo1.id },
    });
    const wo2Attachments = await prisma.workOrderAttachment.findMany({
      where: { workOrderId: wo2.id },
    });

    expect(wo1Attachments.length).toBe(1);
    expect(wo2Attachments.length).toBe(0);
  });

  // ========================================================================
  // Cascade Delete
  // ========================================================================

  it('should delete attachments when work order is deleted', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createAdmin(company.id);

    const workOrder = await createWorkOrder({
      createdById: user.id,
      companyId: company.id,
    });

    await prisma.workOrderAttachment.create({
      data: {
        workOrderId: workOrder.id,
        fileName: 'cascade-test.pdf',
        fileUrl: 'https://s3.example.com/cascade.pdf',
        fileType: 'application/pdf',
        fileSize: 256,
        uploadedById: user.id,
      },
    });

    // Delete the work order
    await prisma.workOrder.delete({ where: { id: workOrder.id } });

    // Attachments should be gone too
    const attachments = await prisma.workOrderAttachment.findMany({
      where: { workOrderId: workOrder.id },
    });

    expect(attachments.length).toBe(0);
  });
});
