/**
 * Smart Collections Service
 *
 * AI-powered collection prioritization and recommendations:
 * - Risk-based scoring for each pending invoice
 * - Optimal contact timing recommendations
 * - Communication channel suggestions
 * - Automated dunning sequence management
 */

import { prisma } from '@/lib/prisma';
import { subDays, differenceInDays, addDays, format, getDay, getHours } from 'date-fns';

export interface CollectionPriority {
  invoiceId: number;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  amount: number;
  daysOverdue: number;
  priorityScore: number; // 0-100, higher = more urgent
  riskCategory: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: CollectionAction;
  bestContactTime: string;
  bestContactChannel: 'email' | 'phone' | 'whatsapp' | 'visit';
  expectedRecoveryRate: number; // 0-1
  dunningStage: number; // 0 = not started, 1-5 = stages
  lastContactDate: Date | null;
  nextActionDate: Date;
  notes: string[];
}

export interface CollectionAction {
  type: 'reminder' | 'call' | 'escalate' | 'payment_plan' | 'legal' | 'write_off';
  description: string;
  urgency: 'immediate' | 'today' | 'this_week' | 'next_week';
  template?: string;
}

export interface CollectionSummary {
  totalPending: number;
  totalOverdue: number;
  totalClients: number;
  byRiskCategory: {
    critical: { count: number; amount: number };
    high: { count: number; amount: number };
    medium: { count: number; amount: number };
    low: { count: number; amount: number };
  };
  todayActions: number;
  weekActions: number;
  estimatedRecovery: number;
}

export interface DunningSequence {
  stage: number;
  daysAfterDue: number;
  channel: 'email' | 'phone' | 'whatsapp' | 'letter';
  template: string;
  escalation: boolean;
}

// Default dunning sequence configuration
const DEFAULT_DUNNING_SEQUENCE: DunningSequence[] = [
  { stage: 1, daysAfterDue: -3, channel: 'email', template: 'REMINDER_FRIENDLY', escalation: false },
  { stage: 2, daysAfterDue: 0, channel: 'whatsapp', template: 'DUE_TODAY', escalation: false },
  { stage: 3, daysAfterDue: 7, channel: 'email', template: 'OVERDUE_FIRST', escalation: false },
  { stage: 4, daysAfterDue: 15, channel: 'phone', template: 'OVERDUE_CALL', escalation: true },
  { stage: 5, daysAfterDue: 30, channel: 'email', template: 'FINAL_NOTICE', escalation: true },
];

/**
 * Get prioritized collection list
 */
export async function getPrioritizedCollections(
  companyId: number,
  options?: {
    limit?: number;
    riskCategory?: 'low' | 'medium' | 'high' | 'critical';
    minAmount?: number;
    includeNotDue?: boolean;
  }
): Promise<{ items: CollectionPriority[]; summary: CollectionSummary }> {
  const now = new Date();

  // Get all pending invoices with client data
  const pendingInvoices = await prisma.salesInvoice.findMany({
    where: {
      companyId,
      estado: { in: ['EMITIDA', 'PENDIENTE', 'VENCIDA'] },
      saldoPendiente: { gt: options?.minAmount ?? 0 },
      ...(options?.includeNotDue ? {} : { fechaVencimiento: { lte: addDays(now, 3) } }),
    },
    include: {
      client: {
        select: {
          id: true,
          legalName: true,
          name: true,
          phone: true,
          email: true,
          isBlocked: true,
          currentBalance: true,
          creditLimit: true,
        },
      },
    },
    orderBy: { fechaVencimiento: 'asc' },
  });

  // Get client payment patterns
  const clientPatterns = await getClientPaymentPatterns(companyId);

  // Get recent collection actions
  const recentActions = await getRecentCollectionActions(companyId);

  // Get historical contact success by time/channel
  const contactPatterns = await getContactSuccessPatterns(companyId);

  // Calculate priority for each invoice
  const priorities: CollectionPriority[] = [];

  for (const invoice of pendingInvoices) {
    const daysOverdue = differenceInDays(now, invoice.fechaVencimiento);
    const amount = Number(invoice.saldoPendiente);

    // Get client-specific patterns
    const clientPattern = clientPatterns.get(invoice.clientId);

    // Calculate priority score
    const priorityScore = calculatePriorityScore({
      daysOverdue,
      amount,
      clientPattern,
      clientBlocked: invoice.client.isBlocked,
      creditUtilization: invoice.client.creditLimit
        ? Number(invoice.client.currentBalance) / Number(invoice.client.creditLimit)
        : 0,
    });

    // Determine risk category
    const riskCategory = determineRiskCategory(priorityScore);

    // Skip if filtering by risk category
    if (options?.riskCategory && riskCategory !== options.riskCategory) {
      continue;
    }

    // Get last contact info
    const clientActions = recentActions.get(invoice.clientId) || [];
    const lastContact = clientActions.length > 0
      ? clientActions[0].fecha
      : null;

    // Determine dunning stage
    const dunningStage = determineDunningStage(daysOverdue, clientActions);

    // Get recommended action
    const recommendedAction = getRecommendedAction(daysOverdue, dunningStage, clientPattern);

    // Calculate best contact time and channel
    const { bestContactTime, bestContactChannel } = getBestContactStrategy(
      invoice.client,
      contactPatterns,
      dunningStage
    );

    // Calculate expected recovery rate
    const expectedRecoveryRate = calculateExpectedRecoveryRate(
      daysOverdue,
      clientPattern,
      dunningStage
    );

    // Generate notes
    const notes = generateCollectionNotes(invoice, clientPattern, daysOverdue);

    priorities.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.numeroCompleto,
      clientId: invoice.clientId,
      clientName: invoice.client.legalName || invoice.client.name || 'Sin nombre',
      amount,
      daysOverdue,
      priorityScore,
      riskCategory,
      recommendedAction,
      bestContactTime,
      bestContactChannel,
      expectedRecoveryRate,
      dunningStage,
      lastContactDate: lastContact,
      nextActionDate: calculateNextActionDate(daysOverdue, dunningStage, lastContact),
      notes,
    });
  }

  // Sort by priority score descending
  priorities.sort((a, b) => b.priorityScore - a.priorityScore);

  // Apply limit if specified
  const items = options?.limit ? priorities.slice(0, options.limit) : priorities;

  // Calculate summary
  const summary = calculateSummary(priorities);

  return { items, summary };
}

/**
 * Get client payment patterns from history
 */
async function getClientPaymentPatterns(companyId: number): Promise<Map<string, {
  avgDaysLate: number;
  paymentConsistency: number;
  preferredChannel: string;
  totalInvoices: number;
  totalPaid: number;
  lastPaymentDate: Date | null;
}>> {
  const patterns = new Map();

  const paidInvoices = await prisma.salesInvoice.findMany({
    where: {
      companyId,
      estado: 'COBRADA',
      fechaEmision: { gte: subDays(new Date(), 365) },
    },
    select: {
      clientId: true,
      fechaVencimiento: true,
      paymentAllocations: {
        select: {
          payment: {
            select: { fechaPago: true },
          },
        },
        take: 1,
      },
    },
  });

  const clientData = new Map<string, { daysLate: number[]; lastPayment: Date | null }>();

  for (const invoice of paidInvoices) {
    if (!invoice.paymentAllocations[0]) continue;

    const paymentDate = invoice.paymentAllocations[0].payment.fechaPago;
    const daysLate = differenceInDays(paymentDate, invoice.fechaVencimiento);

    if (!clientData.has(invoice.clientId)) {
      clientData.set(invoice.clientId, { daysLate: [], lastPayment: null });
    }

    const data = clientData.get(invoice.clientId)!;
    data.daysLate.push(daysLate);
    if (!data.lastPayment || paymentDate > data.lastPayment) {
      data.lastPayment = paymentDate;
    }
  }

  for (const [clientId, data] of clientData) {
    const avgDaysLate = data.daysLate.reduce((a, b) => a + b, 0) / data.daysLate.length;
    const variance = data.daysLate.reduce((sum, d) => sum + Math.pow(d - avgDaysLate, 2), 0) / data.daysLate.length;
    const consistency = 1 / (1 + Math.sqrt(variance) / 10);

    patterns.set(clientId, {
      avgDaysLate: Math.round(avgDaysLate),
      paymentConsistency: consistency,
      preferredChannel: 'email', // Default, can be enhanced with actual data
      totalInvoices: data.daysLate.length,
      totalPaid: data.daysLate.length,
      lastPaymentDate: data.lastPayment,
    });
  }

  return patterns;
}

/**
 * Get recent collection actions by client
 */
async function getRecentCollectionActions(companyId: number): Promise<Map<string, Array<{
  fecha: Date;
  tipo: string;
  resultado: string | null;
}>>> {
  const actions = await prisma.collectionAction.findMany({
    where: {
      companyId,
      fecha: { gte: subDays(new Date(), 90) },
    },
    select: {
      clientId: true,
      fecha: true,
      tipo: true,
      resultado: true,
    },
    orderBy: { fecha: 'desc' },
  });

  const byClient = new Map<string, Array<{ fecha: Date; tipo: string; resultado: string | null }>>();

  for (const action of actions) {
    if (!byClient.has(action.clientId)) {
      byClient.set(action.clientId, []);
    }
    byClient.get(action.clientId)!.push({
      fecha: action.fecha,
      tipo: action.tipo,
      resultado: action.resultado,
    });
  }

  return byClient;
}

/**
 * Get contact success patterns by time and channel
 */
async function getContactSuccessPatterns(companyId: number): Promise<{
  byDayOfWeek: Record<number, number>;
  byHour: Record<number, number>;
  byChannel: Record<string, number>;
}> {
  // Analyze successful collection actions
  const successfulActions = await prisma.collectionAction.findMany({
    where: {
      companyId,
      resultado: { in: ['PROMESA_PAGO', 'PAGO_REALIZADO', 'ACUERDO'] },
      fecha: { gte: subDays(new Date(), 180) },
    },
    select: {
      fecha: true,
      tipo: true,
    },
  });

  const byDayOfWeek: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const byHour: Record<number, number> = {};
  const byChannel: Record<string, number> = {};

  for (const action of successfulActions) {
    const day = getDay(action.fecha);
    const hour = getHours(action.fecha);

    byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1;
    byHour[hour] = (byHour[hour] || 0) + 1;
    byChannel[action.tipo] = (byChannel[action.tipo] || 0) + 1;
  }

  return { byDayOfWeek, byHour, byChannel };
}

/**
 * Calculate priority score (0-100)
 */
function calculatePriorityScore(params: {
  daysOverdue: number;
  amount: number;
  clientPattern?: { avgDaysLate: number; paymentConsistency: number };
  clientBlocked: boolean;
  creditUtilization: number;
}): number {
  let score = 0;

  // Days overdue (0-40 points)
  if (params.daysOverdue > 0) {
    score += Math.min(40, params.daysOverdue * 2);
  } else if (params.daysOverdue >= -3) {
    // About to be due
    score += 10;
  }

  // Amount impact (0-25 points)
  // Larger amounts = higher priority
  if (params.amount >= 1000000) score += 25;
  else if (params.amount >= 500000) score += 20;
  else if (params.amount >= 100000) score += 15;
  else if (params.amount >= 50000) score += 10;
  else score += 5;

  // Client risk profile (0-20 points)
  if (params.clientBlocked) {
    score += 20;
  } else if (params.clientPattern) {
    // Higher score for clients who typically pay late
    if (params.clientPattern.avgDaysLate > 30) score += 15;
    else if (params.clientPattern.avgDaysLate > 15) score += 10;
    else if (params.clientPattern.avgDaysLate > 7) score += 5;

    // Lower consistency = higher score
    score += Math.round((1 - params.clientPattern.paymentConsistency) * 10);
  }

  // Credit utilization (0-15 points)
  if (params.creditUtilization >= 1) score += 15;
  else if (params.creditUtilization >= 0.8) score += 10;
  else if (params.creditUtilization >= 0.6) score += 5;

  return Math.min(100, score);
}

/**
 * Determine risk category based on score
 */
function determineRiskCategory(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Determine current dunning stage
 */
function determineDunningStage(
  daysOverdue: number,
  actions: Array<{ fecha: Date; tipo: string }>
): number {
  // Count completed dunning actions
  const completedStages = new Set<number>();

  for (const action of actions) {
    if (action.tipo === 'REMINDER_FRIENDLY') completedStages.add(1);
    if (action.tipo === 'DUE_TODAY') completedStages.add(2);
    if (action.tipo === 'OVERDUE_FIRST') completedStages.add(3);
    if (action.tipo === 'OVERDUE_CALL') completedStages.add(4);
    if (action.tipo === 'FINAL_NOTICE') completedStages.add(5);
  }

  return completedStages.size;
}

/**
 * Get recommended action based on current state
 */
function getRecommendedAction(
  daysOverdue: number,
  dunningStage: number,
  clientPattern?: { avgDaysLate: number; paymentConsistency: number }
): CollectionAction {
  // Client typically pays very late - escalate faster
  const fastEscalate = clientPattern && clientPattern.avgDaysLate > 30;

  if (daysOverdue <= -3) {
    return {
      type: 'reminder',
      description: 'Enviar recordatorio amigable de próximo vencimiento',
      urgency: 'this_week',
      template: 'REMINDER_FRIENDLY',
    };
  }

  if (daysOverdue <= 0) {
    return {
      type: 'reminder',
      description: 'Enviar aviso de vencimiento hoy',
      urgency: 'today',
      template: 'DUE_TODAY',
    };
  }

  if (daysOverdue <= 7 && dunningStage < 3) {
    return {
      type: 'reminder',
      description: 'Enviar primer aviso de mora',
      urgency: 'today',
      template: 'OVERDUE_FIRST',
    };
  }

  if (daysOverdue <= 15 && dunningStage < 4) {
    return {
      type: 'call',
      description: 'Llamar al cliente para gestionar cobro',
      urgency: fastEscalate ? 'immediate' : 'today',
      template: 'OVERDUE_CALL',
    };
  }

  if (daysOverdue <= 30) {
    return {
      type: 'escalate',
      description: 'Escalar a supervisor / aviso final',
      urgency: 'immediate',
      template: 'FINAL_NOTICE',
    };
  }

  if (daysOverdue <= 60) {
    return {
      type: 'payment_plan',
      description: 'Ofrecer plan de pagos o negociar',
      urgency: 'today',
    };
  }

  if (daysOverdue <= 90) {
    return {
      type: 'legal',
      description: 'Evaluar acción legal o cesión de cartera',
      urgency: 'this_week',
    };
  }

  return {
    type: 'write_off',
    description: 'Evaluar castigo de cartera',
    urgency: 'next_week',
  };
}

/**
 * Get best contact strategy for a client
 */
function getBestContactStrategy(
  client: { phone: string | null; email: string; },
  patterns: { byDayOfWeek: Record<number, number>; byHour: Record<number, number>; byChannel: Record<string, number> },
  dunningStage: number
): { bestContactTime: string; bestContactChannel: 'email' | 'phone' | 'whatsapp' | 'visit' } {
  // Find best day
  const bestDay = Object.entries(patterns.byDayOfWeek)
    .sort(([, a], [, b]) => b - a)[0];
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Find best hour
  const bestHour = Object.entries(patterns.byHour)
    .filter(([hour]) => Number(hour) >= 9 && Number(hour) <= 18)
    .sort(([, a], [, b]) => b - a)[0];

  const bestContactTime = bestHour
    ? `${dayNames[Number(bestDay[0])]} ${bestHour[0]}:00hs`
    : 'Martes 10:00hs'; // Default

  // Determine channel based on dunning stage and client data
  let bestContactChannel: 'email' | 'phone' | 'whatsapp' | 'visit';

  if (dunningStage >= 4 || !client.email) {
    bestContactChannel = client.phone ? 'phone' : 'email';
  } else if (dunningStage >= 2) {
    bestContactChannel = 'whatsapp';
  } else {
    bestContactChannel = 'email';
  }

  return { bestContactTime, bestContactChannel };
}

/**
 * Calculate expected recovery rate
 */
function calculateExpectedRecoveryRate(
  daysOverdue: number,
  clientPattern?: { avgDaysLate: number; paymentConsistency: number },
  dunningStage: number = 0
): number {
  let baseRate = 1.0;

  // Reduce by days overdue
  if (daysOverdue > 0) {
    baseRate -= Math.min(0.5, daysOverdue * 0.01);
  }

  // Client pattern impact
  if (clientPattern) {
    // Good payers
    if (clientPattern.avgDaysLate < 7 && clientPattern.paymentConsistency > 0.8) {
      baseRate = Math.min(1, baseRate + 0.1);
    }
    // Bad payers
    if (clientPattern.avgDaysLate > 30 || clientPattern.paymentConsistency < 0.5) {
      baseRate -= 0.2;
    }
  }

  // Dunning stage impact
  baseRate -= dunningStage * 0.05;

  return Math.max(0.1, Math.min(1, baseRate));
}

/**
 * Calculate next action date
 */
function calculateNextActionDate(
  daysOverdue: number,
  dunningStage: number,
  lastContactDate: Date | null
): Date {
  const now = new Date();

  // If no contact yet, take action today
  if (!lastContactDate) {
    return now;
  }

  const daysSinceContact = differenceInDays(now, lastContactDate);

  // Minimum 2 days between contacts, max 7 days
  const nextContact = Math.max(2, Math.min(7, 7 - dunningStage));

  if (daysSinceContact >= nextContact) {
    return now;
  }

  return addDays(lastContactDate, nextContact);
}

/**
 * Generate collection notes
 */
function generateCollectionNotes(
  invoice: { fechaVencimiento: Date; saldoPendiente: any },
  clientPattern?: { avgDaysLate: number; paymentConsistency: number; lastPaymentDate: Date | null },
  daysOverdue: number = 0
): string[] {
  const notes: string[] = [];

  if (daysOverdue < 0) {
    notes.push(`Vence en ${Math.abs(daysOverdue)} días`);
  } else if (daysOverdue === 0) {
    notes.push('Vence HOY');
  } else {
    notes.push(`Vencida hace ${daysOverdue} días`);
  }

  if (clientPattern) {
    if (clientPattern.avgDaysLate > 15) {
      notes.push(`Cliente paga en promedio ${clientPattern.avgDaysLate} días después del vencimiento`);
    } else if (clientPattern.avgDaysLate < 0) {
      notes.push('Cliente suele pagar antes del vencimiento');
    }

    if (clientPattern.paymentConsistency < 0.5) {
      notes.push('Patrón de pago irregular - seguimiento cercano recomendado');
    }

    if (clientPattern.lastPaymentDate) {
      const daysSincePayment = differenceInDays(new Date(), clientPattern.lastPaymentDate);
      if (daysSincePayment > 60) {
        notes.push(`Último pago hace ${daysSincePayment} días`);
      }
    }
  }

  return notes;
}

/**
 * Calculate collection summary
 */
function calculateSummary(items: CollectionPriority[]): CollectionSummary {
  const now = new Date();

  const summary: CollectionSummary = {
    totalPending: items.reduce((sum, i) => sum + i.amount, 0),
    totalOverdue: items.filter(i => i.daysOverdue > 0).reduce((sum, i) => sum + i.amount, 0),
    totalClients: new Set(items.map(i => i.clientId)).size,
    byRiskCategory: {
      critical: { count: 0, amount: 0 },
      high: { count: 0, amount: 0 },
      medium: { count: 0, amount: 0 },
      low: { count: 0, amount: 0 },
    },
    todayActions: 0,
    weekActions: 0,
    estimatedRecovery: 0,
  };

  for (const item of items) {
    summary.byRiskCategory[item.riskCategory].count += 1;
    summary.byRiskCategory[item.riskCategory].amount += item.amount;

    if (differenceInDays(item.nextActionDate, now) === 0) {
      summary.todayActions += 1;
    }
    if (differenceInDays(item.nextActionDate, now) <= 7) {
      summary.weekActions += 1;
    }

    summary.estimatedRecovery += item.amount * item.expectedRecoveryRate;
  }

  summary.estimatedRecovery = Math.round(summary.estimatedRecovery * 100) / 100;

  return summary;
}

/**
 * Schedule automatic dunning actions (for cron job)
 */
export async function scheduleDunningActions(companyId: number): Promise<{
  scheduled: number;
  errors: string[];
}> {
  const { items } = await getPrioritizedCollections(companyId, { includeNotDue: true });
  const now = new Date();
  let scheduled = 0;
  const errors: string[] = [];

  for (const item of items) {
    if (differenceInDays(item.nextActionDate, now) <= 0) {
      try {
        // Create collection action record
        await prisma.collectionAction.create({
          data: {
            clientId: item.clientId,
            invoiceId: item.invoiceId,
            companyId,
            tipo: item.recommendedAction.template || item.recommendedAction.type.toUpperCase(),
            fecha: now,
            notas: item.notes.join('. '),
            prioridad: item.riskCategory.toUpperCase(),
            usuarioId: 1, // System user
          },
        });
        scheduled++;
      } catch (error) {
        errors.push(`Error scheduling action for invoice ${item.invoiceId}: ${error}`);
      }
    }
  }

  return { scheduled, errors };
}
