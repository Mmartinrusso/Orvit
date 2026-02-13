/**
 * Payment Anomaly Detection Service
 *
 * AI-powered detection of suspicious payment patterns:
 * - Duplicate payments
 * - Unusual amounts
 * - Atypical payment methods
 * - Timing anomalies
 * - Pattern breaks
 */

import { prisma } from '@/lib/prisma';
import { subDays, differenceInDays, getHours, getDay, format } from 'date-fns';

export interface PaymentAnomaly {
  paymentId: number;
  paymentNumber: string;
  clientId: string;
  clientName: string;
  amount: number;
  date: Date;
  anomalyType: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  description: string;
  details: Record<string, any>;
  suggestedAction: string;
  status: 'pending' | 'reviewed' | 'confirmed' | 'dismissed';
}

export type AnomalyType =
  | 'duplicate_payment'
  | 'unusual_amount'
  | 'unusual_method'
  | 'unusual_timing'
  | 'pattern_break'
  | 'rapid_sequence'
  | 'round_number'
  | 'split_payment'
  | 'unallocated_payment';

export interface AnomalyDetectionResult {
  anomalies: PaymentAnomaly[];
  summary: {
    totalChecked: number;
    totalAnomalies: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
  lastCheckDate: Date;
}

interface ClientPaymentProfile {
  avgAmount: number;
  stdDevAmount: number;
  preferredMethods: string[];
  typicalDaysOfWeek: number[];
  typicalHours: number[];
  avgPaymentFrequency: number;
  totalPayments: number;
}

/**
 * Detect anomalies in recent payments
 */
export async function detectPaymentAnomalies(
  companyId: number,
  options?: {
    daysToCheck?: number;
    minConfidence?: number;
    paymentIds?: number[];
  }
): Promise<AnomalyDetectionResult> {
  const daysToCheck = options?.daysToCheck ?? 30;
  const minConfidence = options?.minConfidence ?? 0.6;

  // Get recent payments to check
  const payments = await prisma.clientPayment.findMany({
    where: {
      companyId,
      ...(options?.paymentIds
        ? { id: { in: options.paymentIds } }
        : { fechaPago: { gte: subDays(new Date(), daysToCheck) } }),
    },
    include: {
      client: {
        select: {
          id: true,
          legalName: true,
          name: true,
        },
      },
      allocations: {
        select: {
          invoiceId: true,
          montoAplicado: true,
        },
      },
    },
    orderBy: { fechaPago: 'desc' },
  });

  // Build client payment profiles
  const clientProfiles = await buildClientProfiles(companyId);

  // Detect anomalies
  const anomalies: PaymentAnomaly[] = [];

  for (const payment of payments) {
    const paymentAnomalies = await analyzePayment(payment, clientProfiles, payments);

    for (const anomaly of paymentAnomalies) {
      if (anomaly.confidence >= minConfidence) {
        anomalies.push(anomaly);
      }
    }
  }

  // Calculate summary
  const summary = {
    totalChecked: payments.length,
    totalAnomalies: anomalies.length,
    bySeverity: {
      critical: anomalies.filter(a => a.severity === 'critical').length,
      high: anomalies.filter(a => a.severity === 'high').length,
      medium: anomalies.filter(a => a.severity === 'medium').length,
      low: anomalies.filter(a => a.severity === 'low').length,
    },
    byType: anomalies.reduce((acc, a) => {
      acc[a.anomalyType] = (acc[a.anomalyType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return {
    anomalies,
    summary,
    lastCheckDate: new Date(),
  };
}

/**
 * Build payment profiles for all clients
 */
async function buildClientProfiles(companyId: number): Promise<Map<string, ClientPaymentProfile>> {
  const profiles = new Map<string, ClientPaymentProfile>();

  // Get historical payments (last 12 months)
  const historicalPayments = await prisma.clientPayment.findMany({
    where: {
      companyId,
      estado: 'CONFIRMADO',
      fechaPago: { gte: subDays(new Date(), 365) },
    },
    select: {
      clientId: true,
      totalPago: true,
      fechaPago: true,
      efectivo: true,
      transferencia: true,
      chequesTerceros: true,
      chequesPropios: true,
      tarjetaCredito: true,
      tarjetaDebito: true,
    },
    orderBy: { fechaPago: 'asc' },
  });

  // Group by client
  const byClient = new Map<string, typeof historicalPayments>();

  for (const payment of historicalPayments) {
    if (!byClient.has(payment.clientId)) {
      byClient.set(payment.clientId, []);
    }
    byClient.get(payment.clientId)!.push(payment);
  }

  // Calculate profiles
  for (const [clientId, clientPayments] of byClient) {
    if (clientPayments.length < 3) continue; // Need minimum data

    const amounts = clientPayments.map(p => Number(p.totalPago));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length;
    const stdDevAmount = Math.sqrt(variance);

    // Determine preferred payment methods
    const methodCounts: Record<string, number> = {
      efectivo: 0,
      transferencia: 0,
      chequesTerceros: 0,
      chequesPropios: 0,
      tarjetaCredito: 0,
      tarjetaDebito: 0,
    };

    for (const p of clientPayments) {
      if (Number(p.efectivo) > 0) methodCounts.efectivo++;
      if (Number(p.transferencia) > 0) methodCounts.transferencia++;
      if (Number(p.chequesTerceros) > 0) methodCounts.chequesTerceros++;
      if (Number(p.chequesPropios) > 0) methodCounts.chequesPropios++;
      if (Number(p.tarjetaCredito) > 0) methodCounts.tarjetaCredito++;
      if (Number(p.tarjetaDebito) > 0) methodCounts.tarjetaDebito++;
    }

    const preferredMethods = Object.entries(methodCounts)
      .filter(([, count]) => count > clientPayments.length * 0.2)
      .map(([method]) => method);

    // Typical days and hours
    const daysOfWeek = clientPayments.map(p => getDay(p.fechaPago));
    const hours = clientPayments.map(p => getHours(p.fechaPago));

    const typicalDays = [...new Set(daysOfWeek)].filter(
      day => daysOfWeek.filter(d => d === day).length > clientPayments.length * 0.15
    );

    const typicalHours = [...new Set(hours)].filter(
      hour => hours.filter(h => h === hour).length > clientPayments.length * 0.1
    );

    // Average frequency (days between payments)
    let totalDaysBetween = 0;
    for (let i = 1; i < clientPayments.length; i++) {
      totalDaysBetween += differenceInDays(
        clientPayments[i].fechaPago,
        clientPayments[i - 1].fechaPago
      );
    }
    const avgFrequency = totalDaysBetween / (clientPayments.length - 1);

    profiles.set(clientId, {
      avgAmount,
      stdDevAmount,
      preferredMethods,
      typicalDaysOfWeek: typicalDays,
      typicalHours,
      avgPaymentFrequency: avgFrequency,
      totalPayments: clientPayments.length,
    });
  }

  return profiles;
}

/**
 * Analyze a single payment for anomalies
 */
async function analyzePayment(
  payment: any,
  profiles: Map<string, ClientPaymentProfile>,
  allPayments: any[]
): Promise<PaymentAnomaly[]> {
  const anomalies: PaymentAnomaly[] = [];
  const profile = profiles.get(payment.clientId);
  const amount = Number(payment.totalPago);
  const clientName = payment.client.legalName || payment.client.name || 'Sin nombre';

  // 1. Check for duplicates
  const duplicates = await checkDuplicates(payment, allPayments);
  if (duplicates.found) {
    anomalies.push({
      paymentId: payment.id,
      paymentNumber: payment.numero,
      clientId: payment.clientId,
      clientName,
      amount,
      date: payment.fechaPago,
      anomalyType: 'duplicate_payment',
      severity: 'high',
      confidence: duplicates.confidence,
      description: `Posible pago duplicado: ${duplicates.description}`,
      details: { duplicatePaymentIds: duplicates.matchingIds },
      suggestedAction: 'Verificar que no sea un doble cobro al cliente',
      status: 'pending',
    });
  }

  // 2. Check for unusual amount
  if (profile) {
    const amountAnomaly = checkUnusualAmount(payment, profile);
    if (amountAnomaly) {
      anomalies.push({
        paymentId: payment.id,
        paymentNumber: payment.numero,
        clientId: payment.clientId,
        clientName,
        amount,
        date: payment.fechaPago,
        anomalyType: 'unusual_amount',
        severity: amountAnomaly.severity,
        confidence: amountAnomaly.confidence,
        description: amountAnomaly.description,
        details: {
          avgAmount: profile.avgAmount,
          stdDev: profile.stdDevAmount,
          deviation: amountAnomaly.deviation,
        },
        suggestedAction: 'Verificar que el monto sea correcto',
        status: 'pending',
      });
    }

    // 3. Check for unusual payment method
    const methodAnomaly = checkUnusualMethod(payment, profile);
    if (methodAnomaly) {
      anomalies.push({
        paymentId: payment.id,
        paymentNumber: payment.numero,
        clientId: payment.clientId,
        clientName,
        amount,
        date: payment.fechaPago,
        anomalyType: 'unusual_method',
        severity: 'medium',
        confidence: methodAnomaly.confidence,
        description: methodAnomaly.description,
        details: {
          usedMethod: methodAnomaly.usedMethod,
          preferredMethods: profile.preferredMethods,
        },
        suggestedAction: 'Confirmar el método de pago con el cliente',
        status: 'pending',
      });
    }

    // 4. Check for unusual timing
    const timingAnomaly = checkUnusualTiming(payment, profile);
    if (timingAnomaly) {
      anomalies.push({
        paymentId: payment.id,
        paymentNumber: payment.numero,
        clientId: payment.clientId,
        clientName,
        amount,
        date: payment.fechaPago,
        anomalyType: 'unusual_timing',
        severity: 'low',
        confidence: timingAnomaly.confidence,
        description: timingAnomaly.description,
        details: {
          dayOfWeek: getDay(payment.fechaPago),
          hour: getHours(payment.fechaPago),
          typicalDays: profile.typicalDaysOfWeek,
          typicalHours: profile.typicalHours,
        },
        suggestedAction: 'Monitorear - puede ser un cambio de hábito legítimo',
        status: 'pending',
      });
    }
  }

  // 5. Check for round numbers (potential estimation or fraud)
  const roundAnomaly = checkRoundNumber(payment);
  if (roundAnomaly) {
    anomalies.push({
      paymentId: payment.id,
      paymentNumber: payment.numero,
      clientId: payment.clientId,
      clientName,
      amount,
      date: payment.fechaPago,
      anomalyType: 'round_number',
      severity: 'low',
      confidence: roundAnomaly.confidence,
      description: roundAnomaly.description,
      details: { isExactRound: roundAnomaly.isExactRound },
      suggestedAction: 'Verificar que corresponda a facturas específicas',
      status: 'pending',
    });
  }

  // 6. Check for unallocated payment
  if (payment.allocations.length === 0) {
    anomalies.push({
      paymentId: payment.id,
      paymentNumber: payment.numero,
      clientId: payment.clientId,
      clientName,
      amount,
      date: payment.fechaPago,
      anomalyType: 'unallocated_payment',
      severity: 'medium',
      confidence: 0.9,
      description: 'Pago sin asignar a ninguna factura',
      details: {},
      suggestedAction: 'Asignar el pago a las facturas correspondientes',
      status: 'pending',
    });
  }

  // 7. Check for rapid payment sequence
  const rapidSequence = checkRapidSequence(payment, allPayments);
  if (rapidSequence) {
    anomalies.push({
      paymentId: payment.id,
      paymentNumber: payment.numero,
      clientId: payment.clientId,
      clientName,
      amount,
      date: payment.fechaPago,
      anomalyType: 'rapid_sequence',
      severity: 'medium',
      confidence: rapidSequence.confidence,
      description: rapidSequence.description,
      details: {
        paymentsInWindow: rapidSequence.count,
        windowHours: 24,
      },
      suggestedAction: 'Verificar que no haya errores de carga',
      status: 'pending',
    });
  }

  return anomalies;
}

/**
 * Check for duplicate payments
 */
async function checkDuplicates(
  payment: any,
  allPayments: any[]
): Promise<{ found: boolean; confidence: number; description: string; matchingIds: number[] }> {
  const amount = Number(payment.totalPago);
  const matchingIds: number[] = [];

  // Find payments with same amount in the last 7 days
  for (const other of allPayments) {
    if (other.id === payment.id) continue;
    if (other.clientId !== payment.clientId) continue;

    const daysDiff = Math.abs(differenceInDays(payment.fechaPago, other.fechaPago));
    if (daysDiff > 7) continue;

    const otherAmount = Number(other.totalPago);

    // Exact match
    if (otherAmount === amount) {
      matchingIds.push(other.id);
    }
    // Very close match (within 1%)
    else if (Math.abs(otherAmount - amount) / amount < 0.01) {
      matchingIds.push(other.id);
    }
  }

  if (matchingIds.length === 0) {
    return { found: false, confidence: 0, description: '', matchingIds: [] };
  }

  const confidence = matchingIds.length === 1 ? 0.7 : 0.9;

  return {
    found: true,
    confidence,
    description: `Se encontraron ${matchingIds.length} pago(s) similar(es) del mismo cliente en los últimos 7 días`,
    matchingIds,
  };
}

/**
 * Check for unusual payment amount
 */
function checkUnusualAmount(
  payment: any,
  profile: ClientPaymentProfile
): { severity: 'low' | 'medium' | 'high'; confidence: number; description: string; deviation: number } | null {
  const amount = Number(payment.totalPago);
  const deviation = Math.abs(amount - profile.avgAmount) / profile.stdDevAmount;

  // Less than 2 std deviations is normal
  if (deviation < 2) return null;

  let severity: 'low' | 'medium' | 'high';
  let confidence: number;

  if (deviation >= 4) {
    severity = 'high';
    confidence = 0.9;
  } else if (deviation >= 3) {
    severity = 'medium';
    confidence = 0.8;
  } else {
    severity = 'low';
    confidence = 0.7;
  }

  const direction = amount > profile.avgAmount ? 'mayor' : 'menor';
  const percentage = Math.round(((amount - profile.avgAmount) / profile.avgAmount) * 100);

  return {
    severity,
    confidence,
    description: `Monto ${Math.abs(percentage)}% ${direction} al promedio del cliente (${deviation.toFixed(1)} desviaciones estándar)`,
    deviation,
  };
}

/**
 * Check for unusual payment method
 */
function checkUnusualMethod(
  payment: any,
  profile: ClientPaymentProfile
): { confidence: number; description: string; usedMethod: string } | null {
  if (profile.preferredMethods.length === 0) return null;

  // Determine the primary method used in this payment
  const methods = [
    { name: 'efectivo', amount: Number(payment.efectivo) },
    { name: 'transferencia', amount: Number(payment.transferencia) },
    { name: 'chequesTerceros', amount: Number(payment.chequesTerceros) },
    { name: 'chequesPropios', amount: Number(payment.chequesPropios) },
    { name: 'tarjetaCredito', amount: Number(payment.tarjetaCredito) },
    { name: 'tarjetaDebito', amount: Number(payment.tarjetaDebito) },
  ];

  const primaryMethod = methods.reduce((max, m) => (m.amount > max.amount ? m : max), methods[0]);

  if (primaryMethod.amount === 0) return null;

  // Check if primary method is in preferred methods
  if (profile.preferredMethods.includes(primaryMethod.name)) {
    return null;
  }

  const methodNames: Record<string, string> = {
    efectivo: 'efectivo',
    transferencia: 'transferencia bancaria',
    chequesTerceros: 'cheque de terceros',
    chequesPropios: 'cheque propio',
    tarjetaCredito: 'tarjeta de crédito',
    tarjetaDebito: 'tarjeta de débito',
  };

  return {
    confidence: 0.7,
    description: `Cliente usó ${methodNames[primaryMethod.name] || primaryMethod.name} cuando usualmente paga con ${profile.preferredMethods.map(m => methodNames[m] || m).join(' o ')}`,
    usedMethod: primaryMethod.name,
  };
}

/**
 * Check for unusual timing
 */
function checkUnusualTiming(
  payment: any,
  profile: ClientPaymentProfile
): { confidence: number; description: string } | null {
  if (profile.typicalDaysOfWeek.length === 0 && profile.typicalHours.length === 0) {
    return null;
  }

  const dayOfWeek = getDay(payment.fechaPago);
  const hour = getHours(payment.fechaPago);

  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  const unusualDay = profile.typicalDaysOfWeek.length > 0 && !profile.typicalDaysOfWeek.includes(dayOfWeek);
  const unusualHour = profile.typicalHours.length > 0 && !profile.typicalHours.includes(hour);

  if (!unusualDay && !unusualHour) return null;

  let description = '';
  if (unusualDay && unusualHour) {
    description = `Pago registrado ${dayNames[dayOfWeek]} a las ${hour}:00 - fuera del patrón habitual`;
  } else if (unusualDay) {
    description = `Pago registrado un ${dayNames[dayOfWeek]} - fuera del día habitual`;
  } else {
    description = `Pago registrado a las ${hour}:00 - fuera del horario habitual`;
  }

  return {
    confidence: unusualDay && unusualHour ? 0.75 : 0.6,
    description,
  };
}

/**
 * Check for suspiciously round numbers
 */
function checkRoundNumber(payment: any): { confidence: number; description: string; isExactRound: boolean } | null {
  const amount = Number(payment.totalPago);

  // Check if it's a very round number
  const isExactThousand = amount % 1000 === 0 && amount >= 10000;
  const isExactHundredThousand = amount % 100000 === 0 && amount >= 100000;

  if (!isExactThousand) return null;

  // Round numbers are more suspicious for larger amounts
  let confidence = 0.5;
  let description = 'Monto es un número redondo';

  if (isExactHundredThousand) {
    confidence = 0.7;
    description = 'Monto es un número muy redondo (múltiplo de $100.000)';
  } else if (amount >= 50000) {
    confidence = 0.6;
  }

  return {
    confidence,
    description,
    isExactRound: isExactHundredThousand,
  };
}

/**
 * Check for rapid payment sequence (multiple payments in short time)
 */
function checkRapidSequence(
  payment: any,
  allPayments: any[]
): { confidence: number; description: string; count: number } | null {
  // Count payments from same client in 24-hour window
  const count = allPayments.filter(other => {
    if (other.clientId !== payment.clientId) return false;
    const hoursDiff = Math.abs(
      (payment.fechaPago.getTime() - other.fechaPago.getTime()) / (1000 * 60 * 60)
    );
    return hoursDiff <= 24;
  }).length;

  if (count <= 2) return null;

  return {
    confidence: count >= 5 ? 0.9 : count >= 4 ? 0.8 : 0.7,
    description: `${count} pagos del mismo cliente en 24 horas`,
    count,
  };
}

/**
 * Record anomaly review result
 */
export async function reviewAnomaly(
  anomalyId: number,
  status: 'confirmed' | 'dismissed',
  reviewedBy: number,
  notes?: string
): Promise<void> {
  // This would update an AnomalyLog table if we had one
  // For now, we'll log to the payment's internal notes
  console.log(`Anomaly ${anomalyId} marked as ${status} by user ${reviewedBy}`);
}

/**
 * Get anomaly detection statistics
 */
export async function getAnomalyStats(companyId: number, days: number = 30): Promise<{
  totalDetected: number;
  byType: Record<string, number>;
  falsePositiveRate: number;
  topClients: Array<{ clientId: string; clientName: string; anomalyCount: number }>;
}> {
  const result = await detectPaymentAnomalies(companyId, { daysToCheck: days });

  // Count by client
  const clientCounts = new Map<string, { name: string; count: number }>();
  for (const anomaly of result.anomalies) {
    if (!clientCounts.has(anomaly.clientId)) {
      clientCounts.set(anomaly.clientId, { name: anomaly.clientName, count: 0 });
    }
    clientCounts.get(anomaly.clientId)!.count++;
  }

  const topClients = Array.from(clientCounts.entries())
    .map(([clientId, data]) => ({
      clientId,
      clientName: data.name,
      anomalyCount: data.count,
    }))
    .sort((a, b) => b.anomalyCount - a.anomalyCount)
    .slice(0, 10);

  return {
    totalDetected: result.summary.totalAnomalies,
    byType: result.summary.byType,
    falsePositiveRate: 0, // Would be calculated from reviewed anomalies
    topClients,
  };
}
