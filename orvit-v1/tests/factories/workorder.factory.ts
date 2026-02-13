/**
 * Work Order Factory
 *
 * Creates work orders, machines, work stations, and related entities for testing.
 */
import { getTestPrisma } from '../setup/db-setup';

const prisma = getTestPrisma();

// ============================================================================
// Counters
// ============================================================================

let machineCounter = 0;
let workOrderCounter = 0;

// ============================================================================
// Machine
// ============================================================================

interface CreateMachineOptions {
  name?: string;
  sectorId: number;
  companyId: number;
}

export async function createMachine(options: CreateMachineOptions) {
  const n = ++machineCounter;
  return prisma.machine.create({
    data: {
      name: options.name || `Machine ${n}`,
      sectorId: options.sectorId,
      companyId: options.companyId,
      status: 'ACTIVE',
    },
  });
}

// ============================================================================
// Work Station
// ============================================================================

export async function createWorkStation(
  sectorId: number,
  companyId: number,
  name?: string
) {
  const n = Date.now();
  return prisma.workStation.create({
    data: {
      name: name || `WorkStation ${n}`,
      code: `WS-${n}`,
      sectorId,
      companyId,
    },
  });
}

// ============================================================================
// Work Order
// ============================================================================

interface CreateWorkOrderOptions {
  title?: string;
  description?: string;
  status?: 'INCOMING' | 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  type?: 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'EMERGENCY' | 'FAILURE';
  machineId?: number;
  assignedToId?: number;
  createdById: number;
  companyId: number;
  sectorId?: number;
  scheduledDate?: Date;
  estimatedHours?: number;
  cost?: number;
}

export async function createWorkOrder(options: CreateWorkOrderOptions) {
  const n = ++workOrderCounter;
  return prisma.workOrder.create({
    data: {
      title: options.title || `Work Order ${n}`,
      description: options.description || `Test work order description ${n}`,
      status: options.status || 'PENDING',
      priority: options.priority || 'MEDIUM',
      type: options.type || 'CORRECTIVE',
      machineId: options.machineId,
      assignedToId: options.assignedToId,
      createdById: options.createdById,
      companyId: options.companyId,
      sectorId: options.sectorId,
      scheduledDate: options.scheduledDate,
      estimatedHours: options.estimatedHours,
      cost: options.cost,
    },
  });
}

/**
 * Create a work order with a comment
 */
export async function createWorkOrderWithComment(
  workOrderOptions: CreateWorkOrderOptions,
  commentUserId: number,
  commentText?: string
) {
  const workOrder = await createWorkOrder(workOrderOptions);

  const comment = await prisma.workOrderComment.create({
    data: {
      workOrderId: workOrder.id,
      userId: commentUserId,
      content: commentText || `Test comment on WO-${workOrder.id}`,
    },
  });

  return { workOrder, comment };
}

/**
 * Create a work order with an attachment
 */
export async function createWorkOrderWithAttachment(
  workOrderOptions: CreateWorkOrderOptions,
  uploadedById: number
) {
  const workOrder = await createWorkOrder(workOrderOptions);

  const attachment = await prisma.workOrderAttachment.create({
    data: {
      workOrderId: workOrder.id,
      fileName: 'test-file.pdf',
      fileUrl: 'https://mock-s3.example.com/test-file.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      uploadedById,
    },
  });

  return { workOrder, attachment };
}

/**
 * Reset counters
 */
export function resetWorkOrderCounters(): void {
  machineCounter = 0;
  workOrderCounter = 0;
}
