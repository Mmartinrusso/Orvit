/**
 * Tests para downtime-manager.ts
 * Casos probados:
 * - handleDowntime() crea DowntimeLog y marca requiresReturnToProduction
 * - confirmReturnToProduction() cierra downtime y actualiza flags
 * - validateCanClose() bloquea si falta retorno a producción / downtime abierto / QA pendiente
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleDowntime, confirmReturnToProduction, validateCanClose } from '../downtime-manager';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    downtimeLog: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workOrder: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    qualityAssurance: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    correctiveSettings: {
      findUnique: vi.fn(),
    },
  },
}));

describe('downtime-manager.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleDowntime()', () => {
    it('Si causedDowntime=false → retorna null (no hace nada)', async () => {
      const result = await handleDowntime({
        failureOccurrenceId: 1,
        machineId: 1,
        causedDowntime: false,
        companyId: 1,
      });

      expect(result).toBeNull();
      expect(prisma.downtimeLog.create).not.toHaveBeenCalled();
    });

    it('Si causedDowntime=true → crea DowntimeLog', async () => {
      (prisma.downtimeLog.create as any).mockResolvedValue({ id: 1 });

      const result = await handleDowntime({
        failureOccurrenceId: 1,
        machineId: 1,
        causedDowntime: true,
        companyId: 1,
        category: 'UNPLANNED',
      });

      expect(result).toEqual({ id: 1 });
      expect(prisma.downtimeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          failureOccurrenceId: 1,
          machineId: 1,
          category: 'UNPLANNED',
          companyId: 1,
        }),
      });
    });

    it('Si tiene workOrderId → marca requiresReturnToProduction=true', async () => {
      (prisma.downtimeLog.create as any).mockResolvedValue({ id: 1 });
      (prisma.workOrder.update as any).mockResolvedValue({ id: 1 });

      await handleDowntime({
        failureOccurrenceId: 1,
        workOrderId: 10,
        machineId: 1,
        causedDowntime: true,
        companyId: 1,
      });

      expect(prisma.workOrder.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { requiresReturnToProduction: true },
      });
    });

    it('Validación falla con companyId inválido', async () => {
      await expect(
        handleDowntime({
          failureOccurrenceId: 1,
          machineId: 1,
          causedDowntime: true,
          companyId: -1,
        })
      ).rejects.toThrow('Validación falló');
    });
  });

  describe('confirmReturnToProduction()', () => {
    const mockDowntime = {
      id: 1,
      startedAt: new Date('2024-01-01T10:00:00Z'),
      endedAt: null,
    };

    beforeEach(() => {
      (prisma.downtimeLog.findUnique as any).mockResolvedValue(mockDowntime);
      (prisma.downtimeLog.update as any).mockResolvedValue({ id: 1 });
      (prisma.workOrder.update as any).mockResolvedValue({ id: 1 });
      (prisma.qualityAssurance.findUnique as any).mockResolvedValue(null);
      (prisma.correctiveSettings.findUnique as any).mockResolvedValue({
        requireReturnConfirmationOnQA: true,
      });
    });

    it('Cierra DowntimeLog con endedAt y totalMinutes', async () => {
      const result = await confirmReturnToProduction({
        downtimeLogId: 1,
        returnedById: 1,
        companyId: 1,
      });

      expect(prisma.downtimeLog.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          endedAt: expect.any(Date),
          returnToProductionBy: 1,
          returnToProductionAt: expect.any(Date),
          totalMinutes: expect.any(Number),
        }),
      });

      expect(result.downtimeLogId).toBe(1);
      expect(result.totalMinutes).toBeGreaterThan(0);
    });

    it('Marca WorkOrder.returnToProductionConfirmed=true', async () => {
      await confirmReturnToProduction({
        downtimeLogId: 1,
        workOrderId: 10,
        returnedById: 1,
        companyId: 1,
      });

      expect(prisma.workOrder.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { returnToProductionConfirmed: true },
      });
    });

    it('Si QA requiere confirmación → también marca QA', async () => {
      (prisma.qualityAssurance.findUnique as any).mockResolvedValue({
        isRequired: true,
        workOrderId: 10,
      });

      await confirmReturnToProduction({
        downtimeLogId: 1,
        workOrderId: 10,
        returnedById: 1,
        companyId: 1,
      });

      expect(prisma.qualityAssurance.update).toHaveBeenCalledWith({
        where: { workOrderId: 10 },
        data: expect.objectContaining({
          returnToProductionConfirmed: true,
          returnConfirmedById: 1,
          returnConfirmedAt: expect.any(Date),
        }),
      });
    });

    it('Error si downtime no existe', async () => {
      (prisma.downtimeLog.findUnique as any).mockResolvedValue(null);

      await expect(
        confirmReturnToProduction({
          downtimeLogId: 999,
          returnedById: 1,
          companyId: 1,
        })
      ).rejects.toThrow('no encontrado');
    });

    it('Error si downtime ya fue cerrado', async () => {
      (prisma.downtimeLog.findUnique as any).mockResolvedValue({
        ...mockDowntime,
        endedAt: new Date(),
      });

      await expect(
        confirmReturnToProduction({
          downtimeLogId: 1,
          returnedById: 1,
          companyId: 1,
        })
      ).rejects.toThrow('ya fue cerrado');
    });
  });

  describe('validateCanClose()', () => {
    const mockSettings = {
      requireReturnConfirmationOnQA: true,
    };

    beforeEach(() => {
      (prisma.correctiveSettings.findUnique as any).mockResolvedValue(mockSettings);
    });

    it('Si requiresReturnToProduction=true y NO confirmado → inválido', async () => {
      (prisma.workOrder.findUnique as any).mockResolvedValue({
        id: 1,
        requiresReturnToProduction: true,
        returnToProductionConfirmed: false,
        qualityAssurance: null,
      });

      const result = await validateCanClose({
        workOrderId: 1,
        companyId: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Retorno a Producción');
    });

    it('Si requiresReturnToProduction=true y hay downtime abierto → inválido', async () => {
      (prisma.workOrder.findUnique as any).mockResolvedValue({
        id: 1,
        requiresReturnToProduction: true,
        returnToProductionConfirmed: true,
        qualityAssurance: null,
      });

      (prisma.downtimeLog.findFirst as any).mockResolvedValue({
        id: 1,
        endedAt: null,
      });

      const result = await validateCanClose({
        workOrderId: 1,
        companyId: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('downtime');
    });

    it('Si QA está PENDING → inválido', async () => {
      (prisma.workOrder.findUnique as any).mockResolvedValue({
        id: 1,
        requiresReturnToProduction: false,
        qualityAssurance: {
          isRequired: true,
          status: 'PENDING',
        },
      });

      const result = await validateCanClose({
        workOrderId: 1,
        companyId: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('aprobado');
    });

    it('Si QA requiere confirmación de retorno y no está confirmado → inválido', async () => {
      (prisma.workOrder.findUnique as any).mockResolvedValue({
        id: 1,
        requiresReturnToProduction: false,
        qualityAssurance: {
          isRequired: true,
          status: 'APPROVED',
          returnToProductionConfirmed: false,
        },
      });

      const result = await validateCanClose({
        workOrderId: 1,
        companyId: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('confirmación de Retorno a Producción');
    });

    it('Si todo está OK → válido', async () => {
      (prisma.workOrder.findUnique as any).mockResolvedValue({
        id: 1,
        requiresReturnToProduction: true,
        returnToProductionConfirmed: true,
        qualityAssurance: {
          isRequired: true,
          status: 'APPROVED',
          returnToProductionConfirmed: true,
        },
      });

      (prisma.downtimeLog.findFirst as any).mockResolvedValue(null);

      const result = await validateCanClose({
        workOrderId: 1,
        companyId: 1,
      });

      expect(result.valid).toBe(true);
    });

    it('Validación falla con workOrderId inválido', async () => {
      await expect(
        validateCanClose({
          workOrderId: -1,
          companyId: 1,
        })
      ).rejects.toThrow('Validación falló');
    });
  });
});
