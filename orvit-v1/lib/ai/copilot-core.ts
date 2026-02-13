/**
 * AI Copilot Core - Maintenance Assistant
 *
 * This module provides AI-powered assistance for maintenance operations
 */

import { prisma } from '@/lib/prisma';

export interface CopilotContext {
  companyId: number;
  userId: number;
  entityType?: 'MACHINE' | 'WORK_ORDER' | 'FAILURE' | 'GENERAL';
  entityId?: number;
}

export interface CopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CopilotResponse {
  message: string;
  suggestions?: string[];
  actions?: CopilotAction[];
  relatedEntities?: RelatedEntity[];
  confidence: number;
}

export interface CopilotAction {
  type: string;
  label: string;
  params: Record<string, any>;
  requiresConfirmation: boolean;
}

export interface RelatedEntity {
  type: string;
  id: number;
  name: string;
  url?: string;
}

/**
 * Process a user query and return AI-generated response
 */
export async function processCopilotQuery(
  query: string,
  context: CopilotContext,
  history: CopilotMessage[] = []
): Promise<CopilotResponse> {
  try {
    // Build context based on entity type
    const contextData = await buildContext(context);

    // Classify the query intent
    const intent = classifyIntent(query);

    // Generate response based on intent
    switch (intent.type) {
      case 'DIAGNOSIS':
        return await handleDiagnosis(query, context, contextData);
      case 'HISTORY':
        return await handleHistory(query, context, contextData);
      case 'PRIORITY':
        return await handlePrioritization(query, context);
      case 'INVENTORY':
        return await handleInventory(query, context);
      case 'PROCEDURE':
        return await handleProcedure(query, context, contextData);
      case 'KPI':
        return await handleKPI(query, context);
      default:
        return await handleGeneral(query, context, contextData);
    }
  } catch (error) {
    console.error('Copilot error:', error);
    return {
      message: 'Lo siento, hubo un error procesando tu consulta. Por favor intenta de nuevo.',
      confidence: 0,
    };
  }
}

/**
 * Classify the intent of the user query
 */
function classifyIntent(query: string): { type: string; confidence: number } {
  const queryLower = query.toLowerCase();

  const patterns = [
    { type: 'DIAGNOSIS', keywords: ['causa', 'problema', 'falla', 'vibra', 'ruido', 'no funciona', 'diagnóstico'] },
    { type: 'HISTORY', keywords: ['historial', 'pasó', 'antes', 'anterior', 'último', 'cuántas veces'] },
    { type: 'PRIORITY', keywords: ['priorizar', 'primero', 'urgente', 'importante', 'backlog', 'hoy'] },
    { type: 'INVENTORY', keywords: ['stock', 'repuesto', 'tenemos', 'disponible', 'falta'] },
    { type: 'PROCEDURE', keywords: ['procedimiento', 'cómo', 'pasos', 'manual', 'instrucción'] },
    { type: 'KPI', keywords: ['mtbf', 'mttr', 'disponibilidad', 'indicador', 'métrica', 'rendimiento'] },
  ];

  for (const pattern of patterns) {
    if (pattern.keywords.some((kw) => queryLower.includes(kw))) {
      return { type: pattern.type, confidence: 0.8 };
    }
  }

  return { type: 'GENERAL', confidence: 0.5 };
}

/**
 * Build context data for the AI
 */
async function buildContext(context: CopilotContext): Promise<any> {
  const data: any = {};

  if (context.entityType === 'MACHINE' && context.entityId) {
    const machine = await prisma.machine.findUnique({
      where: { id: context.entityId },
      include: {
        components: true,
        area: true,
        sector: true,
      },
    });
    data.machine = machine;

    // Get recent failures
    const recentFailures = await prisma.failureOccurrence.findMany({
      where: { machineId: context.entityId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    data.recentFailures = recentFailures;

    // Get recent work orders
    const recentWOs = await prisma.workOrder.findMany({
      where: { machineId: context.entityId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    data.recentWorkOrders = recentWOs;
  }

  if (context.entityType === 'WORK_ORDER' && context.entityId) {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: context.entityId },
      include: {
        machine: true,
        failureOccurrence: true,
        assignedTo: true,
      },
    });
    data.workOrder = workOrder;
  }

  return data;
}

/**
 * Handle diagnosis queries
 */
async function handleDiagnosis(
  query: string,
  context: CopilotContext,
  contextData: any
): Promise<CopilotResponse> {
  const machineId = context.entityId || contextData.machine?.id;

  if (!machineId) {
    return {
      message: 'Para ayudarte con el diagnóstico, necesito saber de qué máquina estamos hablando. ¿Puedes indicarme el nombre o ID de la máquina?',
      confidence: 0.7,
    };
  }

  // Get similar failures from history
  const similarFailures = await prisma.failureOccurrence.findMany({
    where: {
      machineId,
      companyId: context.companyId,
    },
    include: {
      solutions: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Analyze patterns
  const failurePatterns = analyzeFailurePatterns(similarFailures);

  let message = `Basándome en el historial de la máquina, encontré ${similarFailures.length} fallas registradas.\n\n`;

  if (failurePatterns.mostCommon) {
    message += `**Causa más común:** ${failurePatterns.mostCommon.cause} (${failurePatterns.mostCommon.count} veces)\n\n`;
  }

  if (failurePatterns.recentPattern) {
    message += `**Patrón reciente:** ${failurePatterns.recentPattern}\n\n`;
  }

  message += '**Acciones sugeridas:**\n';

  const suggestions = [];
  const actions: CopilotAction[] = [];

  if (similarFailures.length > 0 && similarFailures[0].solutions?.length > 0) {
    const preferredSolution = similarFailures[0].solutions.find((s: any) => s.isPreferred);
    if (preferredSolution) {
      suggestions.push(`Aplicar solución preferida: ${preferredSolution.description}`);
      actions.push({
        type: 'APPLY_SOLUTION',
        label: 'Aplicar solución',
        params: { solutionId: preferredSolution.id },
        requiresConfirmation: true,
      });
    }
  }

  suggestions.push('Revisar historial completo de fallas');
  suggestions.push('Crear orden de trabajo para inspección');

  return {
    message,
    suggestions,
    actions,
    relatedEntities: similarFailures.slice(0, 3).map((f) => ({
      type: 'FAILURE',
      id: f.id,
      name: f.description || `Falla #${f.id}`,
      url: `/mantenimiento/fallas/${f.id}`,
    })),
    confidence: 0.75,
  };
}

/**
 * Handle history queries
 */
async function handleHistory(
  query: string,
  context: CopilotContext,
  contextData: any
): Promise<CopilotResponse> {
  const machineId = context.entityId || contextData.machine?.id;

  if (!machineId) {
    return {
      message: '¿De qué máquina quieres ver el historial?',
      confidence: 0.7,
    };
  }

  // Get comprehensive history
  const [failures, workOrders, downtimes] = await Promise.all([
    prisma.failureOccurrence.count({ where: { machineId, companyId: context.companyId } }),
    prisma.workOrder.findMany({
      where: { machineId, companyId: context.companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
    prisma.downtimeLog.aggregate({
      where: { machineId },
      _sum: { durationMinutes: true },
      _count: true,
    }),
  ]);

  const totalDowntime = downtimes._sum.durationMinutes || 0;
  const downtimeHours = Math.round(totalDowntime / 60);

  let message = `**Historial de la máquina:**\n\n`;
  message += `- Total de fallas registradas: **${failures}**\n`;
  message += `- Downtime acumulado: **${downtimeHours} horas** (${downtimes._count} eventos)\n\n`;

  if (workOrders.length > 0) {
    message += `**Últimas órdenes de trabajo:**\n`;
    workOrders.forEach((wo) => {
      message += `- OT #${wo.id}: ${wo.title} (${wo.status})\n`;
    });
  }

  return {
    message,
    relatedEntities: workOrders.map((wo) => ({
      type: 'WORK_ORDER',
      id: wo.id,
      name: wo.title,
      url: `/mantenimiento/ordenes/${wo.id}`,
    })),
    confidence: 0.85,
  };
}

/**
 * Handle prioritization queries
 */
async function handlePrioritization(query: string, context: CopilotContext): Promise<CopilotResponse> {
  // Get pending work orders
  const pendingWOs = await prisma.workOrder.findMany({
    where: {
      companyId: context.companyId,
      status: { in: ['pending', 'in_progress'] },
    },
    include: {
      machine: { select: { name: true, criticalityScore: true } },
    },
    orderBy: [
      { priority: 'asc' },
      { dueDate: 'asc' },
    ],
    take: 10,
  });

  let message = `**Priorización sugerida para hoy:**\n\n`;

  const prioritized = pendingWOs.map((wo, index) => {
    const critScore = wo.machine?.criticalityScore || 50;
    const isOverdue = wo.dueDate && new Date(wo.dueDate) < new Date();
    return {
      ...wo,
      score: calculatePriorityScore(wo.priority, critScore, isOverdue),
      isOverdue,
    };
  }).sort((a, b) => b.score - a.score);

  prioritized.slice(0, 5).forEach((wo, index) => {
    const overdueTag = wo.isOverdue ? ' ⚠️ VENCIDA' : '';
    message += `${index + 1}. **OT #${wo.id}**: ${wo.title} (${wo.machine?.name})${overdueTag}\n`;
    message += `   Prioridad: ${wo.priority} | Criticidad máquina: ${wo.machine?.criticalityScore || 'N/A'}\n\n`;
  });

  return {
    message,
    suggestions: [
      'Ver todas las OTs pendientes',
      'Filtrar por área',
      'Ver OTs vencidas',
    ],
    relatedEntities: prioritized.slice(0, 5).map((wo) => ({
      type: 'WORK_ORDER',
      id: wo.id,
      name: wo.title,
      url: `/mantenimiento/ordenes/${wo.id}`,
    })),
    confidence: 0.8,
  };
}

/**
 * Handle inventory queries
 */
async function handleInventory(query: string, context: CopilotContext): Promise<CopilotResponse> {
  // Check for specific part name in query
  const queryLower = query.toLowerCase();

  // Get low stock items
  const lowStock = await prisma.tool.findMany({
    where: {
      companyId: context.companyId,
      currentStock: { lte: prisma.tool.fields.minStockLevel },
    },
    take: 10,
  });

  let message = '';

  if (lowStock.length > 0) {
    message = `**Alerta de stock bajo:**\n\n`;
    lowStock.forEach((item) => {
      message += `- ${item.name}: ${item.currentStock} unidades (mín: ${item.minStockLevel})\n`;
    });
    message += '\n';
  } else {
    message = 'No hay items con stock bajo actualmente.\n\n';
  }

  // Get total inventory value
  const inventory = await prisma.tool.aggregate({
    where: { companyId: context.companyId },
    _count: true,
    _sum: { currentStock: true },
  });

  message += `**Resumen de inventario:**\n`;
  message += `- Total de items: ${inventory._count}\n`;
  message += `- Unidades totales: ${inventory._sum.currentStock || 0}\n`;

  return {
    message,
    suggestions: [
      'Ver items críticos',
      'Buscar repuesto específico',
      'Ver movimientos recientes',
    ],
    confidence: 0.8,
  };
}

/**
 * Handle procedure queries
 */
async function handleProcedure(
  query: string,
  context: CopilotContext,
  contextData: any
): Promise<CopilotResponse> {
  const machineId = context.entityId || contextData.machine?.id;

  // Search for relevant checklists
  const checklists = await prisma.maintenanceChecklist.findMany({
    where: {
      companyId: context.companyId,
      isActive: true,
      ...(machineId ? { machineId } : {}),
    },
    take: 5,
  });

  let message = '';

  if (checklists.length > 0) {
    message = `**Procedimientos disponibles:**\n\n`;
    checklists.forEach((cl) => {
      message += `- ${cl.name} (${cl.frequency})\n`;
    });
  } else {
    message = 'No encontré procedimientos específicos. Puedes buscar en la base de conocimiento.';
  }

  return {
    message,
    suggestions: [
      'Ver base de conocimiento',
      'Crear nuevo procedimiento',
    ],
    relatedEntities: checklists.map((cl) => ({
      type: 'CHECKLIST',
      id: cl.id,
      name: cl.name,
      url: `/mantenimiento/checklists/${cl.id}`,
    })),
    confidence: 0.7,
  };
}

/**
 * Handle KPI queries
 */
async function handleKPI(query: string, context: CopilotContext): Promise<CopilotResponse> {
  // This would typically call the KPI API
  const message = `Para ver los KPIs detallados, te sugiero visitar el dashboard de mantenimiento donde encontrarás:

- **MTBF** (Tiempo medio entre fallas)
- **MTTR** (Tiempo medio de reparación)
- **Disponibilidad** de equipos
- **Compliance de PM**
- **Backlog** de trabajo

¿Quieres que te muestre algún indicador específico?`;

  return {
    message,
    suggestions: [
      'Ver MTBF por máquina',
      'Ver MTTR del mes',
      'Ver compliance de preventivo',
    ],
    actions: [
      {
        type: 'NAVIGATE',
        label: 'Ir al Dashboard',
        params: { url: '/mantenimiento' },
        requiresConfirmation: false,
      },
    ],
    confidence: 0.7,
  };
}

/**
 * Handle general queries
 */
async function handleGeneral(
  query: string,
  context: CopilotContext,
  contextData: any
): Promise<CopilotResponse> {
  return {
    message: `Entiendo tu consulta. Puedo ayudarte con:

- **Diagnóstico** de fallas y problemas
- **Historial** de máquinas y equipos
- **Priorización** de trabajo
- **Inventario** y repuestos
- **Procedimientos** y manuales
- **KPIs** e indicadores

¿En qué te puedo ayudar específicamente?`,
    suggestions: [
      '¿Qué problemas ha tenido la máquina X?',
      '¿Qué debería atender primero hoy?',
      '¿Tenemos stock del repuesto Y?',
    ],
    confidence: 0.5,
  };
}

/**
 * Analyze failure patterns from history
 */
function analyzeFailurePatterns(failures: any[]): {
  mostCommon?: { cause: string; count: number };
  recentPattern?: string;
} {
  if (failures.length === 0) return {};

  // Count causes
  const causeCounts: Record<string, number> = {};
  failures.forEach((f) => {
    const cause = f.rootCause || f.failureCategory || 'Desconocida';
    causeCounts[cause] = (causeCounts[cause] || 0) + 1;
  });

  const mostCommon = Object.entries(causeCounts).sort((a, b) => b[1] - a[1])[0];

  // Check for recent pattern (same failure in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentFailures = failures.filter((f) => new Date(f.createdAt) > thirtyDaysAgo);
  let recentPattern: string | undefined;

  if (recentFailures.length >= 3) {
    recentPattern = `${recentFailures.length} fallas en los últimos 30 días - posible problema recurrente`;
  }

  return {
    mostCommon: mostCommon ? { cause: mostCommon[0], count: mostCommon[1] } : undefined,
    recentPattern,
  };
}

/**
 * Calculate priority score for work orders
 */
function calculatePriorityScore(priority: string | null, criticalityScore: number, isOverdue: boolean): number {
  let score = 0;

  // Priority weight
  const priorityWeights: Record<string, number> = {
    P1: 100,
    P2: 75,
    P3: 50,
    P4: 25,
  };
  score += priorityWeights[priority || 'P3'] || 50;

  // Criticality weight (0-100)
  score += criticalityScore * 0.5;

  // Overdue penalty
  if (isOverdue) score += 50;

  return score;
}

export default {
  processCopilotQuery,
};
