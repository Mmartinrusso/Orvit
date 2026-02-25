/**
 * Gestión de Historial de Soluciones
 *
 * Funciones:
 * - getTopSolutions: Obtiene las soluciones más efectivas por componente/máquina
 * - getSolutionHistory: Obtiene historial completo de soluciones
 * - getSolutionById: Obtiene detalle de una solución específica
 * - getSolutionStats: Estadísticas de efectividad de soluciones
 * - Helper functions para análisis de soluciones
 */

import { prisma } from '@/lib/prisma';
import {
  validate,
  topSolutionsParamsSchema,
  solutionHistoryParamsSchema,
  getSolutionByIdParamsSchema,
  findSimilarSolutionsParamsSchema,
  solutionStatsParamsSchema,
  mttrParamsSchema,
  frequentToolsParamsSchema
} from './validations';

export interface TopSolutionsParams {
  companyId: number;
  machineId?: number;
  componentId?: number;
  subcomponentId?: number;
  limit?: number;
  minEffectiveness?: number;
  /** Días para que la efectividad decaiga a la mitad (default: 180 = 6 meses) */
  decayHalfLifeDays?: number;
}

export interface SolutionHistoryParams {
  companyId: number;
  machineId?: number;
  componentId?: number;
  subcomponentId?: number;
  failureOccurrenceId?: number;
  performedById?: number;
  outcome?: 'FUNCIONÓ' | 'PARCIAL' | 'NO_FUNCIONÓ';
  minEffectiveness?: number;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SolutionWithStats {
  id: number;
  diagnosis: string;
  solution: string;
  outcome: string;
  performedById: number;
  performedByName?: string;
  performedAt: Date;
  actualMinutes: number | null;
  finalComponentId: number | null;
  finalSubcomponentId: number | null;
  effectiveness: number | null;
  fixType: string;
  usageCount: number;
  avgEffectiveness: number;
  lastUsedAt: Date;
  toolsUsed?: any;
  sparePartsUsed?: any;
}

/**
 * Obtiene las top N soluciones más efectivas
 * Filtra por componente/subcomponente si se proporciona
 * Ordena por efectividad con decay temporal y frecuencia de uso
 *
 * ✅ NUEVO: Temporal decay - soluciones más recientes tienen más peso
 * Formula: adjustedEffectiveness = avgEffectiveness * decayFactor
 * decayFactor = e^(-ageDays / halfLifeDays)
 */
export async function getTopSolutions(params: TopSolutionsParams): Promise<SolutionWithStats[]> {
  // ✅ Validar parámetros
  const validated = validate(topSolutionsParamsSchema, params);
  const {
    companyId,
    machineId,
    componentId,
    subcomponentId,
    limit = 5,
    minEffectiveness = 3,
    decayHalfLifeDays = 180 // 6 meses por defecto
  } = { ...validated, decayHalfLifeDays: params.decayHalfLifeDays ?? 180 };

  // Construir filtro WHERE
  const where: any = {
    companyId,
    effectiveness: { gte: minEffectiveness },
    outcome: 'FUNCIONÓ', // Solo soluciones que funcionaron
    isObsolete: false // ✅ NUEVO: Excluir soluciones obsoletas
  };

  if (subcomponentId) {
    where.finalSubcomponentId = subcomponentId;
  } else if (componentId) {
    where.finalComponentId = componentId;
  }

  // Si se especifica machineId, filtrar por fallas de esa máquina
  if (machineId) {
    where.failureOccurrence = {
      machineId
    };
  }

  // Obtener soluciones con sus relaciones
  const solutions = await prisma.solutionApplied.findMany({
    where,
    include: {
      performedBy: {
        select: {
          id: true,
          name: true
        }
      },
      failureOccurrence: {
        select: {
          id: true,
          machineId: true,
          title: true
        }
      }
    },
    orderBy: [
      { effectiveness: 'desc' },
      { performedAt: 'desc' }
    ],
    take: limit * 3 // Obtener más para agrupar después
  });

  // Agrupar soluciones similares (mismo diagnosis + solution)
  const groupedMap = new Map<string, typeof solutions>();

  solutions.forEach(sol => {
    const key = `${sol.diagnosis.toLowerCase().trim()}-${sol.solution.toLowerCase().trim().substring(0, 100)}`;

    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }
    groupedMap.get(key)!.push(sol);
  });

  // ✅ Helper para calcular decay temporal
  const now = Date.now();
  const calculateDecayFactor = (lastUsed: Date): number => {
    const ageDays = (now - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    // Exponential decay: e^(-age/halfLife)
    return Math.exp(-ageDays / decayHalfLifeDays);
  };

  // Calcular estadísticas por grupo
  const grouped = Array.from(groupedMap.entries()).map(([key, solutions]) => {
    const avgEffectiveness = solutions.reduce((sum, s) => sum + (s.effectiveness || 0), 0) / solutions.length;
    const lastUsedAt = new Date(Math.max(...solutions.map(s => s.performedAt.getTime())));

    // ✅ NUEVO: Calcular decay factor basado en última fecha de uso
    const decayFactor = calculateDecayFactor(lastUsedAt);
    // Score ajustado = efectividad * decay * bonus por uso frecuente
    const usageBonus = Math.min(solutions.length / 5, 1); // Max 20% bonus por uso frecuente
    const adjustedScore = avgEffectiveness * decayFactor * (1 + usageBonus * 0.2);

    // Tomar la solución más reciente como representante
    const representative = solutions.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())[0];

    return {
      id: representative.id,
      diagnosis: representative.diagnosis,
      solution: representative.solution,
      outcome: representative.outcome,
      performedById: representative.performedById,
      performedByName: representative.performedBy?.name,
      performedAt: representative.performedAt,
      actualMinutes: representative.actualMinutes,
      finalComponentId: representative.finalComponentId,
      finalSubcomponentId: representative.finalSubcomponentId,
      effectiveness: representative.effectiveness,
      fixType: representative.fixType,
      usageCount: solutions.length,
      avgEffectiveness: Math.round(avgEffectiveness * 10) / 10,
      lastUsedAt,
      toolsUsed: representative.toolsUsed,
      sparePartsUsed: representative.sparePartsUsed,
      // ✅ NUEVO: Incluir score ajustado y decay factor para debugging
      _adjustedScore: Math.round(adjustedScore * 100) / 100,
      _decayFactor: Math.round(decayFactor * 100) / 100
    };
  });

  // ✅ NUEVO: Ordenar por score ajustado (incluye decay temporal)
  grouped.sort((a, b) => {
    return (b as any)._adjustedScore - (a as any)._adjustedScore;
  });

  return grouped.slice(0, limit);
}

/**
 * Obtiene historial completo de soluciones aplicadas
 * Con filtros opcionales por máquina, técnico, fechas, etc.
 */
export async function getSolutionHistory(params: SolutionHistoryParams) {
  // ✅ Validar parámetros
  const validated = validate(solutionHistoryParamsSchema, params);
  const {
    companyId,
    machineId,
    componentId,
    subcomponentId,
    failureOccurrenceId,
    performedById,
    outcome,
    minEffectiveness,
    startDate,
    endDate,
    search,
    limit = 50,
    offset = 0
  } = validated;

  const where: any = { companyId };

  // Text search across diagnosis, solution, confirmedCause, and failure title
  if (search) {
    where.OR = [
      { diagnosis: { contains: search, mode: 'insensitive' } },
      { solution: { contains: search, mode: 'insensitive' } },
      { confirmedCause: { contains: search, mode: 'insensitive' } },
      { failureOccurrence: { title: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (failureOccurrenceId) {
    where.failureOccurrenceId = failureOccurrenceId;
  }

  if (performedById) {
    where.performedById = performedById;
  }

  // Filtros de componente/subcomponente
  if (subcomponentId) {
    where.finalSubcomponentId = subcomponentId;
  } else if (componentId) {
    where.finalComponentId = componentId;
  }

  // Filtro por outcome
  if (outcome) {
    where.outcome = outcome;
  }

  // Filtro por efectividad mínima
  if (minEffectiveness) {
    where.effectiveness = { gte: minEffectiveness };
  }

  if (machineId) {
    where.failureOccurrence = {
      machineId
    };
  }

  if (startDate || endDate) {
    where.performedAt = {};
    if (startDate) where.performedAt.gte = startDate;
    if (endDate) where.performedAt.lte = endDate;
  }

  const [solutions, total] = await Promise.all([
    prisma.solutionApplied.findMany({
      where,
      include: {
        performedBy: {
          select: {
            id: true,
            name: true
          }
        },
        failureOccurrence: {
          select: {
            id: true,
            title: true,
            machineId: true,
            reportedAt: true,
            machine: {
              select: { id: true, name: true }
            },
            component: {
              select: { id: true, name: true }
            },
            subComponent: {
              select: { id: true, name: true }
            }
          }
        },
        workOrder: {
          select: {
            id: true,
            title: true,
            status: true,
            completedDate: true
          }
        }
      },
      orderBy: {
        performedAt: 'desc'
      },
      skip: offset,
      take: limit
    }),
    prisma.solutionApplied.count({ where })
  ]);

  return {
    solutions,
    total,
    hasMore: offset + limit < total
  };
}

/**
 * Obtiene detalle de una solución específica por ID
 */
export async function getSolutionById(solutionId: number) {
  // ✅ Validar parámetros
  validate(getSolutionByIdParamsSchema, { solutionId });

  return await prisma.solutionApplied.findUnique({
    where: { id: solutionId },
    include: {
      performedBy: {
        select: {
          id: true,
          name: true
        }
      },
      failureOccurrence: {
        select: {
          id: true,
          title: true,
          description: true,
          machineId: true,
          reportedAt: true,
          status: true
        }
      },
      workOrder: {
        select: {
          id: true,
          title: true,
          status: true,
          completedDate: true
        }
      },
      template: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });
}

/**
 * Obtiene estadísticas de efectividad de soluciones
 * Por componente/subcomponente
 * ✅ OPTIMIZADO: Usa groupBy y aggregate en paralelo
 */
export async function getSolutionStats(params: {
  companyId: number;
  componentId?: number;
  subcomponentId?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  // ✅ Validar parámetros
  const validated = validate(solutionStatsParamsSchema, params);
  const { companyId, componentId, subcomponentId, startDate, endDate } = validated;

  const where: any = { companyId };

  if (subcomponentId) {
    where.finalSubcomponentId = subcomponentId;
  } else if (componentId) {
    where.finalComponentId = componentId;
  }

  if (startDate || endDate) {
    where.performedAt = {};
    if (startDate) where.performedAt.gte = startDate;
    if (endDate) where.performedAt.lte = endDate;
  }

  // ✅ OPTIMIZADO: Ejecutar todas las queries en paralelo
  const [byOutcomeResult, byFixTypeResult, aggregateResult] = await Promise.all([
    // GroupBy outcome
    prisma.solutionApplied.groupBy({
      by: ['outcome'],
      where,
      _count: { id: true }
    }),
    // GroupBy fixType
    prisma.solutionApplied.groupBy({
      by: ['fixType'],
      where,
      _count: { id: true }
    }),
    // Aggregate para promedios
    prisma.solutionApplied.aggregate({
      where,
      _count: { id: true },
      _avg: { effectiveness: true, actualMinutes: true }
    })
  ]);

  const total = aggregateResult._count.id;
  const byOutcome = byOutcomeResult.reduce((acc, item) => {
    acc[item.outcome] = item._count.id;
    return acc;
  }, {} as Record<string, number>);

  const byFixType = byFixTypeResult.reduce((acc, item) => {
    acc[item.fixType] = item._count.id;
    return acc;
  }, {} as Record<string, number>);

  return {
    total,
    byOutcome,
    byFixType,
    avgEffectiveness: Math.round((aggregateResult._avg.effectiveness || 0) * 10) / 10,
    avgTimeMinutes: Math.round(aggregateResult._avg.actualMinutes || 0),
    successRate: total > 0 ? Math.round((byOutcome['FUNCIONÓ'] || 0) / total * 100) : 0
  };
}

/**
 * Encuentra soluciones similares a una falla
 * Útil para sugerir soluciones cuando se registra una falla
 */
export async function findSimilarSolutions(params: {
  companyId: number;
  machineId: number;
  componentId?: number;
  subcomponentId?: number;
  title: string;
  description?: string;
  limit?: number;
}) {
  // ✅ Validar parámetros
  const validated = validate(findSimilarSolutionsParamsSchema, params);
  const { companyId, machineId, componentId, subcomponentId, title, description, limit = 3 } = validated;

  // Buscar en mismo componente/máquina primero
  const where: any = {
    companyId,
    failureOccurrence: { machineId },
    effectiveness: { gte: 3 },
    outcome: 'FUNCIONÓ',
    isObsolete: false // ✅ NUEVO: Excluir soluciones obsoletas
  };

  if (subcomponentId) {
    where.finalSubcomponentId = subcomponentId;
  } else if (componentId) {
    where.finalComponentId = componentId;
  }

  const solutions = await prisma.solutionApplied.findMany({
    where,
    include: {
      performedBy: {
        select: {
          id: true,
          name: true
        }
      },
      failureOccurrence: {
        select: {
          id: true,
          title: true,
          description: true
        }
      }
    },
    orderBy: [
      { effectiveness: 'desc' },
      { performedAt: 'desc' }
    ],
    take: limit * 2 // Obtener más para filtrar después
  });

  // Calcular similaridad con título/descripción de la falla actual
  const withSimilarity = solutions.map(sol => {
    const titleMatch = calculateTextSimilarity(title, sol.failureOccurrence?.title || '');
    const descMatch = description && sol.failureOccurrence?.description
      ? calculateTextSimilarity(description, sol.failureOccurrence.description)
      : 0;

    return {
      ...sol,
      similarity: Math.max(titleMatch, descMatch)
    };
  });

  // Filtrar por similaridad mínima y ordenar
  return withSimilarity
    .filter(s => s.similarity > 30)
    .sort((a, b) => {
      const simDiff = b.similarity - a.similarity;
      if (Math.abs(simDiff) > 10) return simDiff;
      return (b.effectiveness || 0) - (a.effectiveness || 0);
    })
    .slice(0, limit);
}

/**
 * Calcula similaridad simple entre dos textos
 * Retorna porcentaje de palabras en común
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return Math.round((intersection.size / union.size) * 100);
}

/**
 * Obtiene el tiempo promedio de resolución (MTTR)
 * Por componente/máquina/técnico
 * ✅ OPTIMIZADO: Usa aggregate en lugar de fetch + reduce
 */
export async function getMTTR(params: {
  companyId: number;
  machineId?: number;
  componentId?: number;
  subcomponentId?: number;
  performedById?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  // ✅ Validar parámetros
  const validated = validate(mttrParamsSchema, params);
  const { companyId, machineId, componentId, subcomponentId, performedById, startDate, endDate } = validated;

  const where: any = {
    companyId,
    actualMinutes: { not: null },
    outcome: 'FUNCIONÓ'
  };

  if (subcomponentId) {
    where.finalSubcomponentId = subcomponentId;
  } else if (componentId) {
    where.finalComponentId = componentId;
  }

  if (performedById) {
    where.performedById = performedById;
  }

  if (machineId) {
    where.failureOccurrence = { machineId };
  }

  if (startDate || endDate) {
    where.performedAt = {};
    if (startDate) where.performedAt.gte = startDate;
    if (endDate) where.performedAt.lte = endDate;
  }

  // ✅ OPTIMIZADO: Usar aggregate en lugar de fetchMany + reduce
  const result = await prisma.solutionApplied.aggregate({
    where,
    _avg: { actualMinutes: true },
    _count: { id: true }
  });

  const sampleSize = result._count.id;
  if (sampleSize === 0) {
    return { mttrMinutes: 0, mttrHours: 0, sampleSize: 0 };
  }

  const mttrMinutes = Math.round(result._avg.actualMinutes || 0);

  return {
    mttrMinutes,
    mttrHours: Math.round(mttrMinutes / 60 * 10) / 10,
    sampleSize
  };
}

/**
 * Obtiene frecuencia de herramientas/repuestos usados
 * Útil para sugerir en formularios
 */
export async function getFrequentToolsAndParts(params: {
  companyId: number;
  componentId?: number;
  subcomponentId?: number;
  limit?: number;
}) {
  // ✅ Validar parámetros
  const validated = validate(frequentToolsParamsSchema, params);
  const { companyId, componentId, subcomponentId, limit } = validated;

  const where: any = { companyId };

  if (subcomponentId) {
    where.finalSubcomponentId = subcomponentId;
  } else if (componentId) {
    where.finalComponentId = componentId;
  }

  const solutions = await prisma.solutionApplied.findMany({
    where,
    select: {
      toolsUsed: true,
      sparePartsUsed: true
    }
  });

  const toolFreq: Record<string, number> = {};
  const partFreq: Record<string, number> = {};

  solutions.forEach(sol => {
    if (Array.isArray(sol.toolsUsed)) {
      (sol.toolsUsed as any[]).forEach((tool: any) => {
        const key = tool.name || tool.id?.toString();
        if (key) toolFreq[key] = (toolFreq[key] || 0) + 1;
      });
    }

    if (Array.isArray(sol.sparePartsUsed)) {
      (sol.sparePartsUsed as any[]).forEach((part: any) => {
        const key = part.name || part.id?.toString();
        if (key) partFreq[key] = (partFreq[key] || 0) + 1;
      });
    }
  });

  const topTools = Object.entries(toolFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));

  const topParts = Object.entries(partFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));

  return {
    topTools,
    topParts
  };
}
