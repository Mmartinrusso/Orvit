/**
 * Tests para qa-rules.ts
 * Casos probados:
 * - requiresQA() con diferentes triggers (P1/P2, safety, downtime, recurrence)
 * - validateQACompletion() bloquea si QA no está aprobado
 * - Validaciones de parámetros
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requiresQA, validateQACompletion, createOrUpdateQA } from '../qa-rules';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    correctiveSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    qualityAssurance: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('qa-rules.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requiresQA()', () => {
    const mockSettings = {
      duplicateWindowHours: 48,
      recurrenceWindowDays: 7,
      downtimeQaThresholdMin: 60,
      slaP1Hours: 4,
      slaP2Hours: 8,
      slaP3Hours: 24,
      slaP4Hours: 72,
      requireEvidenceP3: true,
      requireEvidenceP2: true,
      requireEvidenceP1: true,
      requireReturnConfirmationOnDowntime: true,
      requireReturnConfirmationOnQA: true,
    };

    beforeEach(() => {
      (prisma.correctiveSettings.findUnique as any).mockResolvedValue(mockSettings);
    });

    it('SAFETY → siempre QA con evidencia COMPLETE', async () => {
      const result = await requiresQA({
        isSafetyRelated: true,
        priority: 'P3',
        assetCriticality: 'LOW',
        causedDowntime: false,
        isRecurrence: false,
        companyId: 1,
      });

      expect(result.required).toBe(true);
      expect(result.reason).toBe('SAFETY');
      expect(result.evidenceLevel).toBe('COMPLETE');
    });

    it('P1 → QA con evidencia COMPLETE', async () => {
      const result = await requiresQA({
        isSafetyRelated: false,
        priority: 'P1',
        assetCriticality: null,
        causedDowntime: false,
        isRecurrence: false,
        companyId: 1,
      });

      expect(result.required).toBe(true);
      expect(result.reason).toBe('HIGH_PRIORITY');
      expect(result.evidenceLevel).toBe('COMPLETE');
    });

    it('P2 → QA con evidencia STANDARD', async () => {
      const result = await requiresQA({
        isSafetyRelated: false,
        priority: 'P2',
        assetCriticality: null,
        causedDowntime: false,
        isRecurrence: false,
        companyId: 1,
      });

      expect(result.required).toBe(true);
      expect(result.reason).toBe('HIGH_PRIORITY');
      expect(result.evidenceLevel).toBe('STANDARD');
    });

    it('Downtime > 60min → QA con evidencia STANDARD', async () => {
      const result = await requiresQA({
        isSafetyRelated: false,
        priority: 'P3',
        assetCriticality: null,
        causedDowntime: true,
        downtimeMinutes: 120,
        isRecurrence: false,
        companyId: 1,
      });

      expect(result.required).toBe(true);
      expect(result.reason).toBe('HIGH_DOWNTIME');
      expect(result.evidenceLevel).toBe('STANDARD');
    });

    it('Reincidencia < 7 días → QA con evidencia STANDARD', async () => {
      const result = await requiresQA({
        isSafetyRelated: false,
        priority: 'P3',
        assetCriticality: null,
        causedDowntime: false,
        isRecurrence: true,
        recurrenceDays: 3,
        companyId: 1,
      });

      expect(result.required).toBe(true);
      expect(result.reason).toBe('RECURRENCE');
      expect(result.evidenceLevel).toBe('STANDARD');
    });

    it('P3 con requireEvidenceP3=true → NO obligatorio, evidencia BASIC', async () => {
      const result = await requiresQA({
        isSafetyRelated: false,
        priority: 'P3',
        assetCriticality: null,
        causedDowntime: false,
        isRecurrence: false,
        companyId: 1,
      });

      expect(result.required).toBe(false);
      expect(result.evidenceLevel).toBe('BASIC');
    });

    it('P4 → evidencia OPTIONAL', async () => {
      const result = await requiresQA({
        isSafetyRelated: false,
        priority: 'P4',
        assetCriticality: null,
        causedDowntime: false,
        isRecurrence: false,
        companyId: 1,
      });

      expect(result.required).toBe(false);
      expect(result.evidenceLevel).toBe('OPTIONAL');
    });

    it('Criticidad CRITICAL + downtime → QA con evidencia STANDARD', async () => {
      const result = await requiresQA({
        isSafetyRelated: false,
        priority: 'P3',
        assetCriticality: 'CRITICAL',
        causedDowntime: true,
        isRecurrence: false,
        companyId: 1,
      });

      expect(result.required).toBe(true);
      expect(result.reason).toBe('HIGH_CRITICALITY');
      expect(result.evidenceLevel).toBe('STANDARD');
    });

    it('Validación falla con companyId negativo', async () => {
      await expect(
        requiresQA({
          isSafetyRelated: false,
          priority: 'P3',
          assetCriticality: null,
          causedDowntime: false,
          isRecurrence: false,
          companyId: -1,
        })
      ).rejects.toThrow('Validación falló');
    });
  });

  describe('validateQACompletion()', () => {
    it('Si no hay QA → válido', async () => {
      (prisma.qualityAssurance.findUnique as any).mockResolvedValue(null);

      const result = await validateQACompletion(1);

      expect(result.valid).toBe(true);
    });

    it('Si QA no es requerido → válido', async () => {
      (prisma.qualityAssurance.findUnique as any).mockResolvedValue({
        isRequired: false,
      });

      const result = await validateQACompletion(1);

      expect(result.valid).toBe(true);
    });

    it('Si QA está PENDING → inválido', async () => {
      (prisma.qualityAssurance.findUnique as any).mockResolvedValue({
        isRequired: true,
        status: 'PENDING',
      });

      const result = await validateQACompletion(1);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('aprobado');
    });

    it('Si QA está APPROVED → válido', async () => {
      (prisma.qualityAssurance.findUnique as any).mockResolvedValue({
        isRequired: true,
        status: 'APPROVED',
        evidenceRequired: 'OPTIONAL',
      });

      const result = await validateQACompletion(1);

      expect(result.valid).toBe(true);
    });

    it('Si requiere evidencia y no hay → inválido', async () => {
      (prisma.qualityAssurance.findUnique as any).mockResolvedValue({
        isRequired: true,
        status: 'APPROVED',
        evidenceRequired: 'COMPLETE',
        evidenceProvided: null,
      });

      const result = await validateQACompletion(1);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('evidencia');
    });

    it('Validación falla con workOrderId inválido', async () => {
      await expect(validateQACompletion(-1)).rejects.toThrow('Validación falló');
    });
  });

  describe('createOrUpdateQA()', () => {
    beforeEach(() => {
      (prisma.correctiveSettings.findUnique as any).mockResolvedValue({
        duplicateWindowHours: 48,
      });
    });

    it('Crea QA nuevo si no existe', async () => {
      (prisma.qualityAssurance.findUnique as any).mockResolvedValue(null);
      (prisma.qualityAssurance.create as any).mockResolvedValue({ id: 1 });

      await createOrUpdateQA({
        workOrderId: 1,
        companyId: 1,
        qaRequirement: {
          required: true,
          reason: 'SAFETY',
          evidenceLevel: 'COMPLETE',
        },
      });

      expect(prisma.qualityAssurance.create).toHaveBeenCalledWith({
        data: {
          workOrderId: 1,
          isRequired: true,
          requiredReason: 'SAFETY',
          evidenceRequired: 'COMPLETE',
          status: 'PENDING',
        },
      });
    });

    it('Actualiza QA existente', async () => {
      (prisma.qualityAssurance.findUnique as any).mockResolvedValue({ id: 1 });
      (prisma.qualityAssurance.update as any).mockResolvedValue({ id: 1 });

      await createOrUpdateQA({
        workOrderId: 1,
        companyId: 1,
        qaRequirement: {
          required: true,
          reason: 'HIGH_PRIORITY',
          evidenceLevel: 'STANDARD',
        },
      });

      expect(prisma.qualityAssurance.update).toHaveBeenCalledWith({
        where: { workOrderId: 1 },
        data: {
          isRequired: true,
          requiredReason: 'HIGH_PRIORITY',
          evidenceRequired: 'STANDARD',
          status: 'PENDING',
        },
      });
    });
  });
});
