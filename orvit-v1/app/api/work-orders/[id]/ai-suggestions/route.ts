/**
 * API: /api/work-orders/[id]/ai-suggestions
 *
 * GET - Obtener sugerencias inteligentes para una OT correctiva
 *       Sistema basado en reglas (sin LLM)
 *
 * P5.4: IA v1 Sugerencias
 *
 * Sugerencias generadas:
 * 1. Soluciones - Top soluciones aplicadas anteriormente al mismo componente
 * 2. Técnicos - Técnicos con experiencia en la máquina/componente
 * 3. Prioridad - Sugerencia basada en criticidad del activo y síntomas
 * 4. Checklists - Plantillas matching por máquina/componente
 * 5. Tiempo estimado - Basado en OTs similares anteriores
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { calculatePriority, Priority } from '@/lib/corrective/priority-calculator';

export const dynamic = 'force-dynamic';

interface SolutionSuggestion {
  id: number;
  diagnosis: string;
  solution: string;
  outcome: string;
  effectiveness: number | null;
  usageCount: number;
  lastUsedAt: Date;
  performedBy: { id: number; name: string } | null;
  score: number; // Relevance score
}

interface TechnicianSuggestion {
  id: number;
  name: string;
  email: string;
  completedWorkOrders: number;
  avgCompletionTime: number | null;
  lastWorkedOn: Date | null;
  score: number; // Relevance score
  reason: string;
}

interface ChecklistSuggestion {
  id: number;
  name: string;
  description: string | null;
  matchReason: string;
  usageCount: number;
  score: number;
}

interface PrioritySuggestion {
  suggested: Priority;
  current: string;
  reasons: string[];
  shouldEscalate: boolean;
}

interface TimeSuggestion {
  estimatedMinutes: number;
  basedOnSamples: number;
  confidence: 'low' | 'medium' | 'high';
  range: { min: number; max: number };
}

/**
 * GET /api/work-orders/[id]/ai-suggestions
 * Obtener sugerencias inteligentes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    // Obtener la OT con contexto
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            criticality: true
          }
        },
        component: { select: { id: true, name: true } },
        failureOccurrences: {
          select: {
            id: true,
            title: true,
            priority: true,
            causedDowntime: true,
            isSafetyRelated: true,
            isIntermittent: true,
            subcomponentId: true,
            symptoms: true
          }
        }
      }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // Extraer contexto de la falla principal
    const mainFailure = workOrder.failureOccurrences[0];
    const machineId = workOrder.machineId;
    const componentId = workOrder.componentId;
    const subcomponentId = mainFailure?.subcomponentId;

    // ✅ OPTIMIZADO: Ejecutar todas las queries en paralelo
    const [
      prevSolutionsResult,
      technicianStatsResult,
      templatesResult,
      similarOTsResult
    ] = await Promise.allSettled([
      // 1. Soluciones previas
      prisma.solutionApplied.findMany({
        where: {
          companyId,
          OR: [
            ...(subcomponentId ? [{ finalSubcomponentId: subcomponentId }] : []),
            ...(componentId ? [{ finalComponentId: componentId }] : []),
            ...(machineId ? [{ failureOccurrence: { machineId } }] : [])
          ],
          outcome: 'FUNCIONÓ'
        },
        include: {
          performedBy: { select: { id: true, name: true } },
          failureOccurrence: { select: { title: true, machineId: true } }
        },
        orderBy: [{ effectiveness: 'desc' }, { performedAt: 'desc' }],
        take: 10
      }),
      // 2. Stats de técnicos
      machineId ? prisma.workOrder.groupBy({
        by: ['assignedToId'],
        where: { companyId, machineId, status: 'COMPLETED', assignedToId: { not: null } },
        _count: { id: true },
        _avg: { actualHours: true }
      }) : Promise.resolve([]),
      // 3. Templates de checklists
      prisma.correctiveChecklistTemplate.findMany({
        where: {
          companyId,
          isActive: true,
          OR: [
            ...(machineId ? [{ machineId }] : []),
            ...(componentId ? [{ componentId }] : []),
            { machineId: null, componentId: null }
          ]
        },
        orderBy: { usageCount: 'desc' },
        take: 5
      }),
      // 4. OTs similares para tiempo estimado
      machineId ? prisma.workOrder.findMany({
        where: { companyId, machineId, type: 'CORRECTIVE', status: 'COMPLETED', actualHours: { not: null } },
        select: { actualHours: true },
        take: 20,
        orderBy: { completedDate: 'desc' }
      }) : Promise.resolve([])
    ]);

    // ========== 1. PROCESAR SUGERENCIAS DE SOLUCIONES ==========
    const solutionSuggestions: SolutionSuggestion[] = [];
    if (prevSolutionsResult.status === 'fulfilled') {
      for (const sol of prevSolutionsResult.value) {
        let score = 50;
        if (sol.finalSubcomponentId === subcomponentId) score += 30;
        else if (sol.finalComponentId === componentId) score += 20;
        if (sol.effectiveness) score += sol.effectiveness * 4;
        const daysSince = (Date.now() - sol.performedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) score += 10;
        else if (daysSince < 90) score += 5;

        solutionSuggestions.push({
          id: sol.id,
          diagnosis: sol.diagnosis,
          solution: sol.solution,
          outcome: sol.outcome,
          effectiveness: sol.effectiveness,
          usageCount: 1,
          lastUsedAt: sol.performedAt,
          performedBy: sol.performedBy,
          score
        });
      }
      solutionSuggestions.sort((a, b) => b.score - a.score);
    }

    // ========== 2. PROCESAR SUGERENCIAS DE TÉCNICOS ==========
    const technicianSuggestions: TechnicianSuggestion[] = [];
    if (technicianStatsResult.status === 'fulfilled' && technicianStatsResult.value.length > 0) {
      const technicianStats = technicianStatsResult.value;
      const userIds = technicianStats.map(t => t.assignedToId).filter((id): id is number => id !== null);

      if (userIds.length > 0) {
        // Query adicional para usuarios (necesaria porque groupBy no incluye)
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true }
        });

        for (const stat of technicianStats) {
          if (!stat.assignedToId) continue;
          const user = users.find(u => u.id === stat.assignedToId);
          if (!user) continue;

          let score = 50;
          score += Math.min(stat._count.id * 5, 30);
          if (stat._avg.actualHours && stat._avg.actualHours < 2) score += 10;

          technicianSuggestions.push({
            id: user.id,
            name: user.name,
            email: user.email,
            completedWorkOrders: stat._count.id,
            avgCompletionTime: stat._avg.actualHours ? Math.round(stat._avg.actualHours * 60) : null,
            lastWorkedOn: null,
            score,
            reason: `${stat._count.id} OTs completadas en esta máquina`
          });
        }
        technicianSuggestions.sort((a, b) => b.score - a.score);
      }
    }

    // ========== 3. CALCULAR PRIORIDAD (sync, no query) ==========
    let prioritySuggestion: PrioritySuggestion | null = null;
    try {
      const priorityResult = calculatePriority({
        assetCriticality: workOrder.machine?.criticality,
        causedDowntime: mainFailure?.causedDowntime || false,
        isSafetyRelated: mainFailure?.isSafetyRelated || false,
        isIntermittent: mainFailure?.isIntermittent || false,
        isObservation: false
      });

      const currentPriority = workOrder.priority;
      const PRIORITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };
      const shouldEscalate = (PRIORITY_RANK[priorityResult.priority] ?? 0) > (PRIORITY_RANK[currentPriority] ?? 0);

      prioritySuggestion = {
        suggested: priorityResult.priority,
        current: currentPriority,
        reasons: priorityResult.reasons,
        shouldEscalate
      };
    } catch (e) {
      console.warn('⚠️ Error calculando prioridad:', e);
    }

    // ========== 4. PROCESAR SUGERENCIAS DE CHECKLISTS ==========
    const checklistSuggestions: ChecklistSuggestion[] = [];
    if (templatesResult.status === 'fulfilled') {
      for (const template of templatesResult.value) {
        let score = 50;
        let matchReason = 'Plantilla genérica';
        if (template.machineId === machineId) { score += 30; matchReason = 'Match por máquina'; }
        if (template.componentId === componentId) { score += 20; matchReason = 'Match por componente'; }
        if (template.usageCount > 10) score += 10;

        checklistSuggestions.push({
          id: template.id,
          name: template.name,
          description: template.description,
          matchReason,
          usageCount: template.usageCount,
          score
        });
      }
      checklistSuggestions.sort((a, b) => b.score - a.score);
    }

    // ========== 5. PROCESAR ESTIMACIÓN DE TIEMPO ==========
    let timeSuggestion: TimeSuggestion | null = null;
    if (similarOTsResult.status === 'fulfilled' && similarOTsResult.value.length >= 3) {
      const hours = similarOTsResult.value.map(o => o.actualHours).filter((h): h is number => h !== null);
      if (hours.length >= 3) {
        const avgHours = hours.reduce((a, b) => a + b, 0) / hours.length;
        const confidence: 'low' | 'medium' | 'high' = hours.length >= 10 ? 'high' : hours.length >= 5 ? 'medium' : 'low';

        timeSuggestion = {
          estimatedMinutes: Math.round(avgHours * 60),
          basedOnSamples: hours.length,
          confidence,
          range: { min: Math.round(Math.min(...hours) * 60), max: Math.round(Math.max(...hours) * 60) }
        };
      }
    }

    return NextResponse.json({
      workOrder: {
        id: workOrder.id,
        title: workOrder.title,
        machine: workOrder.machine,
        component: workOrder.component,
        priority: workOrder.priority
      },
      suggestions: {
        solutions: solutionSuggestions.slice(0, 3), // Top 3
        technicians: technicianSuggestions.slice(0, 3), // Top 3
        priority: prioritySuggestion,
        checklists: checklistSuggestions.slice(0, 3), // Top 3
        estimatedTime: timeSuggestion
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        algorithm: 'rule-based-v1',
        dataQuality: {
          solutionsSamples: solutionSuggestions.length,
          techniciansSamples: technicianSuggestions.length,
          timeSamples: timeSuggestion?.basedOnSamples || 0
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/work-orders/[id]/ai-suggestions:', error);
    return NextResponse.json(
      { error: 'Error al generar sugerencias', detail: error.message },
      { status: 500 }
    );
  }
}
