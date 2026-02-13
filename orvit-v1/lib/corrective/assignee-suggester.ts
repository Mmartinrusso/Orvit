/**
 * P1: Sistema de Sugerencia Automática de Asignado
 *
 * Sugiere técnico basado en:
 * 1. Historial: quién resolvió fallas similares en este componente
 * 2. Configuración: asignado por defecto del componente/área
 * 3. Carga de trabajo: cuántas OTs tiene asignadas actualmente
 *
 * NO asigna automáticamente, solo sugiere como "smart default"
 */

import { prisma } from '@/lib/prisma';

export interface AssigneeSuggestion {
  userId: number;
  userName: string;
  score: number;
  reasons: string[];
}

export interface SuggestionParams {
  machineId: number;
  componentId?: number;
  subcomponentId?: number;
  failureCategory?: string;
  companyId: number;
  areaId?: number;
  sectorId?: number;
}

/**
 * Obtiene sugerencias de asignado para una falla/OT
 * Retorna lista ordenada por score (mayor primero)
 */
export async function suggestAssignee(params: SuggestionParams): Promise<AssigneeSuggestion[]> {
  const { machineId, componentId, subcomponentId, failureCategory, companyId, areaId, sectorId } = params;

  const suggestions = new Map<number, AssigneeSuggestion>();

  // 1. Buscar por historial de soluciones en este componente/subcomponente
  await addHistorySuggestions(suggestions, {
    machineId,
    componentId,
    subcomponentId,
    companyId
  });

  // 2. Buscar asignado por defecto del área/sector
  await addDefaultAssigneeSuggestions(suggestions, {
    areaId,
    sectorId,
    companyId
  });

  // 3. Buscar técnicos con experiencia en esta categoría de falla
  if (failureCategory) {
    await addCategorySuggestions(suggestions, {
      failureCategory,
      companyId
    });
  }

  // 4. Penalizar por carga de trabajo actual
  await penalizeByWorkload(suggestions, companyId);

  // 5. Ordenar por score descendente
  const sortedSuggestions = Array.from(suggestions.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Top 3

  return sortedSuggestions;
}

/**
 * Agrega sugerencias basadas en historial de soluciones
 */
async function addHistorySuggestions(
  suggestions: Map<number, AssigneeSuggestion>,
  params: { machineId: number; componentId?: number; subcomponentId?: number; companyId: number }
): Promise<void> {
  const { machineId, componentId, subcomponentId, companyId } = params;

  // Buscar soluciones aplicadas en los últimos 90 días
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  // Construir where clause dinámicamente
  const where: any = {
    companyId,
    performedAt: { gte: cutoffDate },
    outcome: 'FUNCIONÓ', // Solo soluciones exitosas
  };

  // Priorizar por nivel de especificidad
  if (subcomponentId) {
    where.finalSubcomponentId = subcomponentId;
  } else if (componentId) {
    where.finalComponentId = componentId;
  }

  try {
    // Agrupar por performedById
    const solutions = await prisma.solutionApplied.groupBy({
      by: ['performedById'],
      where,
      _count: { id: true },
      _avg: { effectiveness: true },
      orderBy: { _count: { id: 'desc' } }
    });

    // Obtener nombres de usuarios
    const userIds = solutions.map(s => s.performedById);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });
    const userMap = new Map(users.map(u => [u.id, u.name]));

    for (const sol of solutions) {
      const userId = sol.performedById;
      const existing = suggestions.get(userId);
      const historyScore = Math.min(sol._count.id * 15, 60); // Max 60 puntos por historial
      const effectivenessBonus = (sol._avg.effectiveness || 3) * 5; // 5-25 puntos extra

      if (existing) {
        existing.score += historyScore + effectivenessBonus;
        existing.reasons.push(
          `${sol._count.id} soluciones previas en este componente`
        );
      } else {
        suggestions.set(userId, {
          userId,
          userName: userMap.get(userId) || 'Usuario',
          score: historyScore + effectivenessBonus,
          reasons: [`${sol._count.id} soluciones previas en este componente`]
        });
      }
    }
  } catch (error) {
    // Si falla, continuar sin sugerencias de historial
    console.warn('⚠️ Error obteniendo historial de soluciones:', error);
  }
}

/**
 * Agrega sugerencias basadas en asignado por defecto del área/sector
 */
async function addDefaultAssigneeSuggestions(
  suggestions: Map<number, AssigneeSuggestion>,
  params: { areaId?: number; sectorId?: number; companyId: number }
): Promise<void> {
  const { areaId, sectorId, companyId } = params;

  // Buscar usuarios con rol de técnico en el área/sector
  try {
    const where: any = {
      companyId,
      role: {
        name: { contains: 'Técnico', mode: 'insensitive' }
      }
    };

    if (sectorId) {
      where.sectorId = sectorId;
    } else if (areaId) {
      where.sector = { areaId };
    }

    const technicians = await prisma.userOnCompany.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } }
      },
      take: 5
    });

    for (const tech of technicians) {
      const userId = tech.userId;
      const existing = suggestions.get(userId);
      const areaScore = sectorId ? 30 : 20; // Mayor score si es del sector específico

      if (existing) {
        existing.score += areaScore;
        existing.reasons.push('Técnico asignado al área/sector');
      } else {
        suggestions.set(userId, {
          userId,
          userName: tech.user.name,
          score: areaScore,
          reasons: ['Técnico asignado al área/sector']
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ Error obteniendo técnicos por defecto:', error);
  }
}

/**
 * Agrega sugerencias basadas en experiencia en categoría de falla
 */
async function addCategorySuggestions(
  suggestions: Map<number, AssigneeSuggestion>,
  params: { failureCategory: string; companyId: number }
): Promise<void> {
  const { failureCategory, companyId } = params;

  try {
    // Buscar OTs correctivas completadas en esta categoría
    const workOrders = await prisma.workOrder.findMany({
      where: {
        companyId,
        type: 'CORRECTIVE',
        status: 'COMPLETED',
        failureOccurrences: {
          some: {
            failureCategory
          }
        }
      },
      select: {
        assignedToId: true
      },
      take: 50
    });

    // Contar por asignado
    const countByUser = new Map<number, number>();
    for (const wo of workOrders) {
      if (wo.assignedToId) {
        countByUser.set(wo.assignedToId, (countByUser.get(wo.assignedToId) || 0) + 1);
      }
    }

    // Obtener nombres
    const userIds = Array.from(countByUser.keys());
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });
    const userMap = new Map(users.map(u => [u.id, u.name]));

    for (const [userId, count] of countByUser) {
      const categoryScore = Math.min(count * 5, 25); // Max 25 puntos
      const existing = suggestions.get(userId);

      if (existing) {
        existing.score += categoryScore;
        existing.reasons.push(`Experiencia en fallas ${failureCategory}`);
      } else {
        suggestions.set(userId, {
          userId,
          userName: userMap.get(userId) || 'Usuario',
          score: categoryScore,
          reasons: [`Experiencia en fallas ${failureCategory}`]
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ Error obteniendo experiencia por categoría:', error);
  }
}

/**
 * Penaliza por carga de trabajo actual
 */
async function penalizeByWorkload(
  suggestions: Map<number, AssigneeSuggestion>,
  companyId: number
): Promise<void> {
  const userIds = Array.from(suggestions.keys());

  if (userIds.length === 0) return;

  try {
    // Contar OTs abiertas asignadas a cada usuario
    const workloads = await prisma.workOrder.groupBy({
      by: ['assignedToId'],
      where: {
        companyId,
        assignedToId: { in: userIds },
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      },
      _count: { id: true }
    });

    for (const wl of workloads) {
      if (wl.assignedToId) {
        const existing = suggestions.get(wl.assignedToId);
        if (existing) {
          // Penalizar 5 puntos por cada OT abierta (max -30)
          const penalty = Math.min(wl._count.id * 5, 30);
          existing.score -= penalty;
          if (wl._count.id > 3) {
            existing.reasons.push(`Alta carga (${wl._count.id} OTs abiertas)`);
          }
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Error calculando carga de trabajo:', error);
  }
}

/**
 * API helper para obtener sugerencia rápida (top 1)
 */
export async function getTopAssigneeSuggestion(params: SuggestionParams): Promise<AssigneeSuggestion | null> {
  const suggestions = await suggestAssignee(params);
  return suggestions.length > 0 ? suggestions[0] : null;
}
