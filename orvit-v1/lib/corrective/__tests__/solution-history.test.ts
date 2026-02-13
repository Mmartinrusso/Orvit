/**
 * Tests para solution-history.ts
 * Casos probados:
 * - getTopSolutions() filtra por efectividad y agrupa similares
 * - getSolutionHistory() con paginación y filtros
 * - Validaciones de parámetros (límites, fechas)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTopSolutions, getSolutionHistory, getSolutionById, findSimilarSolutions } from '../solution-history';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    solutionApplied: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('solution-history.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTopSolutions()', () => {
    it('Filtra por minEffectiveness (default 3)', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);

      await getTopSolutions({
        companyId: 1,
        limit: 5,
      });

      const callArgs = (prisma.solutionApplied.findMany as any).mock.calls[0][0];
      expect(callArgs.where.effectiveness.gte).toBe(3);
    });

    it('Solo retorna soluciones con outcome=FUNCIONÓ', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);

      await getTopSolutions({
        companyId: 1,
      });

      const callArgs = (prisma.solutionApplied.findMany as any).mock.calls[0][0];
      expect(callArgs.where.outcome).toBe('FUNCIONÓ');
    });

    it('Respeta limit máximo de 50', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);

      await getTopSolutions({
        companyId: 1,
        limit: 5,
      });

      const callArgs = (prisma.solutionApplied.findMany as any).mock.calls[0][0];
      // Obtiene limit * 3 para agrupar después
      expect(callArgs.take).toBe(15);
    });

    it('Filtra por subcomponentId si se proporciona', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);

      await getTopSolutions({
        companyId: 1,
        subcomponentId: 5,
      });

      const callArgs = (prisma.solutionApplied.findMany as any).mock.calls[0][0];
      expect(callArgs.where.finalSubcomponentId).toBe(5);
    });

    it('Agrupa soluciones similares y calcula avgEffectiveness', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([
        {
          id: 1,
          diagnosis: 'Motor sobrecalentado',
          solution: 'Cambiar filtro de aceite',
          effectiveness: 5,
          performedById: 1,
          performedBy: { id: 1, name: 'Juan' },
          performedAt: new Date('2024-01-15'),
          outcome: 'FUNCIONÓ',
          failureOccurrence: { machineId: 1 },
        },
        {
          id: 2,
          diagnosis: 'Motor sobrecalentado',
          solution: 'Cambiar filtro de aceite',
          effectiveness: 4,
          performedById: 2,
          performedBy: { id: 2, name: 'María' },
          performedAt: new Date('2024-01-20'),
          outcome: 'FUNCIONÓ',
          failureOccurrence: { machineId: 1 },
        },
      ]);

      const results = await getTopSolutions({
        companyId: 1,
        limit: 5,
      });

      // Debe agrupar las 2 soluciones (mismo diagnosis + solution)
      expect(results.length).toBe(1);
      expect(results[0].usageCount).toBe(2);
      expect(results[0].avgEffectiveness).toBeCloseTo(4.5, 1);
    });

    it('Validación falla con limit > 50', async () => {
      await expect(
        getTopSolutions({
          companyId: 1,
          limit: 100,
        })
      ).rejects.toThrow('Validación falló');
    });

    it('Validación falla con companyId inválido', async () => {
      await expect(
        getTopSolutions({
          companyId: -1,
        })
      ).rejects.toThrow('Validación falló');
    });
  });

  describe('getSolutionHistory()', () => {
    it('Paginación con limit y offset', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);
      (prisma.solutionApplied.count as any).mockResolvedValue(100);

      await getSolutionHistory({
        companyId: 1,
        limit: 20,
        offset: 40,
      });

      const callArgs = (prisma.solutionApplied.findMany as any).mock.calls[0][0];
      expect(callArgs.take).toBe(20);
      expect(callArgs.skip).toBe(40);
    });

    it('Filtra por machineId si se proporciona', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);
      (prisma.solutionApplied.count as any).mockResolvedValue(0);

      await getSolutionHistory({
        companyId: 1,
        machineId: 5,
      });

      const callArgs = (prisma.solutionApplied.findMany as any).mock.calls[0][0];
      expect(callArgs.where.failureOccurrence.machineId).toBe(5);
    });

    it('Filtra por rango de fechas', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);
      (prisma.solutionApplied.count as any).mockResolvedValue(0);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await getSolutionHistory({
        companyId: 1,
        startDate,
        endDate,
      });

      const callArgs = (prisma.solutionApplied.findMany as any).mock.calls[0][0];
      expect(callArgs.where.performedAt.gte).toEqual(startDate);
      expect(callArgs.where.performedAt.lte).toEqual(endDate);
    });

    it('Retorna hasMore=true si hay más resultados', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);
      (prisma.solutionApplied.count as any).mockResolvedValue(100);

      const result = await getSolutionHistory({
        companyId: 1,
        limit: 50,
        offset: 0,
      });

      expect(result.hasMore).toBe(true);
    });

    it('Retorna hasMore=false si no hay más resultados', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);
      (prisma.solutionApplied.count as any).mockResolvedValue(30);

      const result = await getSolutionHistory({
        companyId: 1,
        limit: 50,
        offset: 0,
      });

      expect(result.hasMore).toBe(false);
    });

    it('Validación falla con limit > 200', async () => {
      await expect(
        getSolutionHistory({
          companyId: 1,
          limit: 300,
        })
      ).rejects.toThrow('Validación falló');
    });

    it('Validación falla con startDate > endDate', async () => {
      await expect(
        getSolutionHistory({
          companyId: 1,
          startDate: new Date('2024-12-31'),
          endDate: new Date('2024-01-01'),
        })
      ).rejects.toThrow('startDate debe ser anterior');
    });
  });

  describe('getSolutionById()', () => {
    it('Retorna solución con relaciones', async () => {
      (prisma.solutionApplied.findUnique as any).mockResolvedValue({
        id: 1,
        diagnosis: 'Test',
        performedBy: { id: 1, name: 'Juan' },
      });

      const result = await getSolutionById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it('Validación falla con solutionId inválido', async () => {
      await expect(getSolutionById(-1)).rejects.toThrow('Validación falló');
    });
  });

  describe('findSimilarSolutions()', () => {
    it('Busca en mismo machineId y componente', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);

      await findSimilarSolutions({
        companyId: 1,
        machineId: 5,
        componentId: 10,
        title: 'Falla motor',
      });

      const callArgs = (prisma.solutionApplied.findMany as any).mock.calls[0][0];
      expect(callArgs.where.failureOccurrence.machineId).toBe(5);
      expect(callArgs.where.finalComponentId).toBe(10);
    });

    it('Solo retorna effectiveness >= 3 y outcome=FUNCIONÓ', async () => {
      (prisma.solutionApplied.findMany as any).mockResolvedValue([]);

      await findSimilarSolutions({
        companyId: 1,
        machineId: 5,
        title: 'Test',
      });

      const callArgs = (prisma.solutionApplied.findMany as any).mock.calls[0][0];
      expect(callArgs.where.effectiveness.gte).toBe(3);
      expect(callArgs.where.outcome).toBe('FUNCIONÓ');
    });

    it('Validación falla con title muy corto', async () => {
      await expect(
        findSimilarSolutions({
          companyId: 1,
          machineId: 5,
          title: 'AB',
        })
      ).rejects.toThrow('Validación falló');
    });
  });
});
