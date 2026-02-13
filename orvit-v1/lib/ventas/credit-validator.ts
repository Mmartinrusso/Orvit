/**
 * Credit Validator - O2C Phase 1
 *
 * Validates client credit status before allowing sales operations.
 * Uses ClientLedgerEntry as source of truth, currentDebt as cache.
 *
 * OPTIMIZED FOR:
 * - N+1 queries eliminated (single query with includes)
 * - ViewMode (T1/T2) filtering
 * - Parallel promises where possible
 * - Typed responses with detailed error/warning info
 */

import { Prisma, DocType } from '@prisma/client';
import prisma from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ViewMode = 'S' | 'E'; // Standard (T1) | Extended (T1+T2)

export interface CreditValidationInput {
  clientId: string;
  companyId: number;
  orderAmount: Prisma.Decimal | number;
  viewMode: ViewMode;
  userId: number;
  skipValidation?: boolean; // For users with override permission
}

export interface OverdueInvoiceInfo {
  id: number;
  numero: string;
  amount: Prisma.Decimal;
  daysOverdue: number;
  fechaVencimiento: Date;
  saldoPendiente: Prisma.Decimal;
}

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  amount: Prisma.Decimal;
  count: number;
}

export interface CheckPortfolioStatus {
  totalInCartera: Prisma.Decimal;
  cantidadCheques: number;
  excedeLimite: boolean;
  limiteCheques: Prisma.Decimal | null;
  proximoVencimiento: Date | null;
  chequesPorVencer30Dias: number;
}

export interface CreditStatus {
  limit: Prisma.Decimal;
  usedFromLedger: Prisma.Decimal;  // Calculated from ClientLedgerEntry (source of truth)
  cachedDebt: Prisma.Decimal;      // currentBalance from Client (cache)
  available: Prisma.Decimal;
  utilizationPercent: number;
  needsReconciliation: boolean;    // true if cached != ledger
  differenceAmount: Prisma.Decimal;
}

export interface OverdueStatus {
  hasOverdue: boolean;
  overdueAmount: Prisma.Decimal;
  oldestOverdueDays: number;
  overdueInvoices: OverdueInvoiceInfo[];
  aging: AgingBucket[];
}

export interface BlockStatus {
  isBlocked: boolean;
  blockedReason: string | null;
  blockedAt: Date | null;
  tipoBloqueo: string | null;
}

export interface CreditValidationResult {
  canProceed: boolean;
  requiresOverride: boolean;  // Can continue with special permission
  warnings: string[];
  errors: string[];
  creditStatus: CreditStatus;
  overdueStatus: OverdueStatus;
  checkStatus: CheckPortfolioStatus;
  blockStatus: BlockStatus;
  clientInfo: {
    id: string;
    name: string;
    cuit: string | null;
    paymentTerms: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get DocType filter based on ViewMode
 */
export function getDocTypeFilter(viewMode: ViewMode): DocType[] {
  return viewMode === 'S' ? [DocType.T1] : [DocType.T1, DocType.T2];
}

/**
 * Apply ViewMode to Prisma where clause
 */
export function applyViewMode<T extends Record<string, unknown>>(
  where: T,
  viewMode: ViewMode
): T & { docType: { in: DocType[] } } {
  return {
    ...where,
    docType: { in: getDocTypeFilter(viewMode) },
  };
}

/**
 * Convert to Decimal safely
 */
function toDecimal(value: number | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  return new Prisma.Decimal(value);
}

/**
 * Calculate aging buckets from invoices
 */
function calculateAging(
  invoices: Array<{ saldoPendiente: Prisma.Decimal; fechaVencimiento: Date | null }>,
  bucketDays: number[]
): AgingBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build bucket definitions
  const buckets: AgingBucket[] = [];

  // Current (not overdue)
  buckets.push({
    label: 'Corriente',
    minDays: -Infinity,
    maxDays: 0,
    amount: new Prisma.Decimal(0),
    count: 0,
  });

  // Add configured buckets
  for (let i = 0; i < bucketDays.length; i++) {
    const minDays = i === 0 ? 1 : bucketDays[i - 1] + 1;
    const maxDays = bucketDays[i];
    buckets.push({
      label: `${minDays}-${maxDays} días`,
      minDays,
      maxDays,
      amount: new Prisma.Decimal(0),
      count: 0,
    });
  }

  // Add final bucket (> last configured)
  const lastBucket = bucketDays[bucketDays.length - 1];
  buckets.push({
    label: `> ${lastBucket} días`,
    minDays: lastBucket + 1,
    maxDays: null,
    amount: new Prisma.Decimal(0),
    count: 0,
  });

  // Categorize invoices
  for (const invoice of invoices) {
    if (!invoice.fechaVencimiento) continue;

    const vencimiento = new Date(invoice.fechaVencimiento);
    vencimiento.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - vencimiento.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Find matching bucket
    for (const bucket of buckets) {
      const minOk = diffDays >= bucket.minDays;
      const maxOk = bucket.maxDays === null || diffDays <= bucket.maxDays;

      if (minOk && maxOk) {
        bucket.amount = bucket.amount.plus(invoice.saldoPendiente);
        bucket.count++;
        break;
      }
    }
  }

  return buckets;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN VALIDATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate client credit before allowing a sale
 *
 * @param input - Validation parameters
 * @returns Detailed validation result
 */
export async function validateClientCredit(
  input: CreditValidationInput
): Promise<CreditValidationResult> {
  const { clientId, companyId, orderAmount, viewMode, skipValidation } = input;
  const docTypes = getDocTypeFilter(viewMode);
  const orderAmountDecimal = toDecimal(orderAmount);

  // Initialize result
  const warnings: string[] = [];
  const errors: string[] = [];

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: Parallel data fetching (optimized - single round trip)
  // ─────────────────────────────────────────────────────────────────────────────

  const [client, salesConfig, ledgerBalance, overdueInvoices, checkPortfolio] = await Promise.all([
    // Get client with block info
    prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        legalName: true,
        cuit: true,
        creditLimit: true,
        currentBalance: true,
        paymentTerms: true,
        isBlocked: true,
        blockedReason: true,
        blockedAt: true,
        hasCheckLimit: true,
        checkLimit: true,
        companyId: true,
      },
    }),

    // Get sales config for thresholds
    prisma.salesConfig.findUnique({
      where: { companyId },
      select: {
        validarLimiteCredito: true,
        bloquearVentaSinCredito: true,
        enableBlockByOverdue: true,
        overdueGraceDays: true,
        enableAging: true,
        agingBuckets: true,
        creditAlertThreshold: true,
        enableCheckLimit: true,
        defaultCheckLimit: true,
      },
    }),

    // Calculate balance from ledger (source of truth)
    prisma.clientLedgerEntry.aggregate({
      where: {
        clientId,
        companyId,
        docType: { in: docTypes },
        anulado: false,
      },
      _sum: {
        debe: true,
        haber: true,
      },
    }),

    // Get overdue invoices
    prisma.salesInvoice.findMany({
      where: {
        clientId,
        companyId,
        docType: { in: docTypes },
        estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
        fechaVencimiento: { lt: new Date() },
        saldoPendiente: { gt: 0 },
      },
      select: {
        id: true,
        numero: true,
        total: true,
        saldoPendiente: true,
        fechaVencimiento: true,
      },
      orderBy: { fechaVencimiento: 'asc' },
    }),

    // Get check portfolio
    prisma.cheque.aggregate({
      where: {
        companyId,
        // Client relation through payment
        clientPayment: {
          clientId,
          docType: { in: docTypes },
        },
        estado: 'CARTERA',
      },
      _sum: { monto: true },
      _count: true,
    }),
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: Validate client exists
  // ─────────────────────────────────────────────────────────────────────────────

  if (!client) {
    return {
      canProceed: false,
      requiresOverride: false,
      warnings: [],
      errors: ['Cliente no encontrado'],
      creditStatus: {
        limit: new Prisma.Decimal(0),
        usedFromLedger: new Prisma.Decimal(0),
        cachedDebt: new Prisma.Decimal(0),
        available: new Prisma.Decimal(0),
        utilizationPercent: 0,
        needsReconciliation: false,
        differenceAmount: new Prisma.Decimal(0),
      },
      overdueStatus: {
        hasOverdue: false,
        overdueAmount: new Prisma.Decimal(0),
        oldestOverdueDays: 0,
        overdueInvoices: [],
        aging: [],
      },
      checkStatus: {
        totalInCartera: new Prisma.Decimal(0),
        cantidadCheques: 0,
        excedeLimite: false,
        limiteCheques: null,
        proximoVencimiento: null,
        chequesPorVencer30Dias: 0,
      },
      blockStatus: {
        isBlocked: false,
        blockedReason: null,
        blockedAt: null,
        tipoBloqueo: null,
      },
      clientInfo: {
        id: clientId,
        name: 'Desconocido',
        cuit: null,
        paymentTerms: 0,
      },
    };
  }

  // Validate company match
  if (client.companyId !== companyId) {
    errors.push('Cliente no pertenece a esta empresa');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: Calculate credit status
  // ─────────────────────────────────────────────────────────────────────────────

  const totalDebe = toDecimal(ledgerBalance._sum.debe);
  const totalHaber = toDecimal(ledgerBalance._sum.haber);
  const usedFromLedger = totalDebe.minus(totalHaber); // Positive = client owes money
  const cachedDebt = toDecimal(client.currentBalance);
  const creditLimit = toDecimal(client.creditLimit);

  // Check for reconciliation need (tolerance of 0.01)
  const difference = usedFromLedger.minus(cachedDebt).abs();
  const needsReconciliation = difference.greaterThan(new Prisma.Decimal('0.01'));

  const available = creditLimit.minus(usedFromLedger).minus(orderAmountDecimal);
  const utilizationPercent = creditLimit.isZero()
    ? 100
    : usedFromLedger.plus(orderAmountDecimal).dividedBy(creditLimit).times(100).toNumber();

  const creditStatus: CreditStatus = {
    limit: creditLimit,
    usedFromLedger,
    cachedDebt,
    available: available.lessThan(0) ? new Prisma.Decimal(0) : available,
    utilizationPercent: Math.min(utilizationPercent, 999),
    needsReconciliation,
    differenceAmount: difference,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: Calculate overdue status
  // ─────────────────────────────────────────────────────────────────────────────

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const graceDays = salesConfig?.overdueGraceDays ?? 0;

  const overdueInvoicesInfo: OverdueInvoiceInfo[] = overdueInvoices
    .filter(inv => {
      if (!inv.fechaVencimiento) return false;
      const venc = new Date(inv.fechaVencimiento);
      venc.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > graceDays;
    })
    .map(inv => {
      const venc = new Date(inv.fechaVencimiento!);
      venc.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: inv.id,
        numero: inv.numero,
        amount: toDecimal(inv.total),
        daysOverdue: diffDays,
        fechaVencimiento: inv.fechaVencimiento!,
        saldoPendiente: toDecimal(inv.saldoPendiente),
      };
    });

  const overdueAmount = overdueInvoicesInfo.reduce(
    (sum, inv) => sum.plus(inv.saldoPendiente),
    new Prisma.Decimal(0)
  );

  const oldestOverdueDays = overdueInvoicesInfo.length > 0
    ? Math.max(...overdueInvoicesInfo.map(i => i.daysOverdue))
    : 0;

  // Calculate aging if enabled
  const agingBuckets = salesConfig?.agingBuckets as number[] ?? [30, 60, 90, 120];
  const allPendingInvoices = await prisma.salesInvoice.findMany({
    where: {
      clientId,
      companyId,
      docType: { in: docTypes },
      estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
      saldoPendiente: { gt: 0 },
    },
    select: {
      saldoPendiente: true,
      fechaVencimiento: true,
    },
  });

  const aging = salesConfig?.enableAging
    ? calculateAging(allPendingInvoices, agingBuckets)
    : [];

  const overdueStatus: OverdueStatus = {
    hasOverdue: overdueInvoicesInfo.length > 0,
    overdueAmount,
    oldestOverdueDays,
    overdueInvoices: overdueInvoicesInfo,
    aging,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5: Calculate check portfolio status
  // ─────────────────────────────────────────────────────────────────────────────

  const totalInCartera = toDecimal(checkPortfolio._sum.monto);
  const cantidadCheques = checkPortfolio._count ?? 0;
  const limiteCheques = client.hasCheckLimit
    ? toDecimal(client.checkLimit)
    : toDecimal(salesConfig?.defaultCheckLimit);
  const excedeLimite = limiteCheques && !limiteCheques.isZero()
    ? totalInCartera.greaterThan(limiteCheques)
    : false;

  // Get next check to expire
  const nextCheck = await prisma.cheque.findFirst({
    where: {
      companyId,
      clientPayment: { clientId },
      estado: 'CARTERA',
      fechaVencimiento: { gte: new Date() },
    },
    orderBy: { fechaVencimiento: 'asc' },
    select: { fechaVencimiento: true },
  });

  // Count checks expiring in 30 days
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const checksExpiring = await prisma.cheque.count({
    where: {
      companyId,
      clientPayment: { clientId },
      estado: 'CARTERA',
      fechaVencimiento: {
        gte: new Date(),
        lte: thirtyDaysFromNow,
      },
    },
  });

  const checkStatus: CheckPortfolioStatus = {
    totalInCartera,
    cantidadCheques,
    excedeLimite,
    limiteCheques,
    proximoVencimiento: nextCheck?.fechaVencimiento ?? null,
    chequesPorVencer30Dias: checksExpiring,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6: Get block status
  // ─────────────────────────────────────────────────────────────────────────────

  // Get latest block history entry if client is blocked
  let tipoBloqueo: string | null = null;
  if (client.isBlocked) {
    const lastBlock = await prisma.clientBlockHistory.findFirst({
      where: {
        clientId,
        companyId,
        desbloqueadoAt: null,
      },
      orderBy: { bloqueadoAt: 'desc' },
      select: { tipoBloqueo: true },
    });
    tipoBloqueo = lastBlock?.tipoBloqueo ?? 'MANUAL';
  }

  const blockStatus: BlockStatus = {
    isBlocked: client.isBlocked,
    blockedReason: client.blockedReason,
    blockedAt: client.blockedAt,
    tipoBloqueo,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 7: Generate warnings and errors
  // ─────────────────────────────────────────────────────────────────────────────

  // Skip validation if user has override permission
  if (skipValidation) {
    return {
      canProceed: true,
      requiresOverride: false,
      warnings: ['Validación de crédito omitida por permiso especial'],
      errors: [],
      creditStatus,
      overdueStatus,
      checkStatus,
      blockStatus,
      clientInfo: {
        id: client.id,
        name: client.name || client.legalName,
        cuit: client.cuit,
        paymentTerms: client.paymentTerms ?? 0,
      },
    };
  }

  // Check if client is blocked
  if (blockStatus.isBlocked) {
    errors.push(`Cliente bloqueado: ${blockStatus.blockedReason || 'Sin motivo especificado'}`);
  }

  // Check credit limit
  if (salesConfig?.validarLimiteCredito) {
    if (available.lessThan(0)) {
      const exceededBy = available.abs();
      if (salesConfig.bloquearVentaSinCredito) {
        errors.push(`Límite de crédito excedido por $${exceededBy.toFixed(2)}`);
      } else {
        warnings.push(`Límite de crédito excedido por $${exceededBy.toFixed(2)}`);
      }
    } else if (utilizationPercent >= (salesConfig.creditAlertThreshold?.toNumber() ?? 80)) {
      warnings.push(`Utilización de crédito alta: ${utilizationPercent.toFixed(1)}%`);
    }
  }

  // Check overdue invoices
  if (salesConfig?.enableBlockByOverdue && overdueStatus.hasOverdue) {
    errors.push(
      `Cliente tiene ${overdueInvoicesInfo.length} factura(s) vencida(s) por $${overdueAmount.toFixed(2)}, ` +
      `más antigua: ${oldestOverdueDays} días`
    );
  }

  // Check portfolio status
  if (salesConfig?.enableCheckLimit && checkStatus.excedeLimite) {
    warnings.push(
      `Cartera de cheques excede límite: $${totalInCartera.toFixed(2)} / $${limiteCheques?.toFixed(2)}`
    );
  }

  // Check reconciliation need
  if (needsReconciliation) {
    warnings.push(
      `Diferencia detectada en saldo: cache=$${cachedDebt.toFixed(2)}, ledger=$${usedFromLedger.toFixed(2)}`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 8: Determine final result
  // ─────────────────────────────────────────────────────────────────────────────

  const canProceed = errors.length === 0;
  const requiresOverride = !canProceed && warnings.length > 0;

  return {
    canProceed,
    requiresOverride,
    warnings,
    errors,
    creditStatus,
    overdueStatus,
    checkStatus,
    blockStatus,
    clientInfo: {
      id: client.id,
      name: client.name || client.legalName,
      cuit: client.cuit,
      paymentTerms: client.paymentTerms ?? 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK VALIDATION (for list views, less detail)
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuickCreditStatus {
  hasCredit: boolean;
  isBlocked: boolean;
  hasOverdue: boolean;
  utilizationPercent: number;
  statusColor: 'green' | 'yellow' | 'red';
  statusLabel: string;
}

/**
 * Quick credit check for list views (minimal queries)
 */
export async function getQuickCreditStatus(
  clientId: string,
  companyId: number,
  viewMode: ViewMode
): Promise<QuickCreditStatus> {
  const docTypes = getDocTypeFilter(viewMode);

  const [client, overdueCount] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: {
        creditLimit: true,
        currentBalance: true,
        isBlocked: true,
      },
    }),
    prisma.salesInvoice.count({
      where: {
        clientId,
        companyId,
        docType: { in: docTypes },
        estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
        fechaVencimiento: { lt: new Date() },
        saldoPendiente: { gt: 0 },
      },
    }),
  ]);

  if (!client) {
    return {
      hasCredit: false,
      isBlocked: true,
      hasOverdue: false,
      utilizationPercent: 100,
      statusColor: 'red',
      statusLabel: 'No encontrado',
    };
  }

  const limit = toDecimal(client.creditLimit);
  const used = toDecimal(client.currentBalance);
  const utilizationPercent = limit.isZero()
    ? 100
    : used.dividedBy(limit).times(100).toNumber();

  const hasCredit = limit.greaterThan(0) && used.lessThan(limit);
  const hasOverdue = overdueCount > 0;
  const isBlocked = client.isBlocked;

  let statusColor: 'green' | 'yellow' | 'red' = 'green';
  let statusLabel = 'OK';

  if (isBlocked) {
    statusColor = 'red';
    statusLabel = 'Bloqueado';
  } else if (hasOverdue) {
    statusColor = 'red';
    statusLabel = 'Con mora';
  } else if (!hasCredit) {
    statusColor = 'red';
    statusLabel = 'Sin crédito';
  } else if (utilizationPercent >= 80) {
    statusColor = 'yellow';
    statusLabel = 'Crédito alto';
  }

  return {
    hasCredit,
    isBlocked,
    hasOverdue,
    utilizationPercent: Math.min(utilizationPercent, 999),
    statusColor,
    statusLabel,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH VALIDATION (for bulk operations)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get quick credit status for multiple clients (optimized batch)
 */
export async function getBatchQuickCreditStatus(
  clientIds: string[],
  companyId: number,
  viewMode: ViewMode
): Promise<Map<string, QuickCreditStatus>> {
  const docTypes = getDocTypeFilter(viewMode);

  // Single query for all clients
  const [clients, overdueCounts] = await Promise.all([
    prisma.client.findMany({
      where: {
        id: { in: clientIds },
        companyId,
      },
      select: {
        id: true,
        creditLimit: true,
        currentBalance: true,
        isBlocked: true,
      },
    }),
    prisma.salesInvoice.groupBy({
      by: ['clientId'],
      where: {
        clientId: { in: clientIds },
        companyId,
        docType: { in: docTypes },
        estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
        fechaVencimiento: { lt: new Date() },
        saldoPendiente: { gt: 0 },
      },
      _count: true,
    }),
  ]);

  const overdueMap = new Map(overdueCounts.map(o => [o.clientId, o._count]));
  const result = new Map<string, QuickCreditStatus>();

  for (const client of clients) {
    const limit = toDecimal(client.creditLimit);
    const used = toDecimal(client.currentBalance);
    const utilizationPercent = limit.isZero()
      ? 100
      : used.dividedBy(limit).times(100).toNumber();

    const hasCredit = limit.greaterThan(0) && used.lessThan(limit);
    const hasOverdue = (overdueMap.get(client.id) ?? 0) > 0;
    const isBlocked = client.isBlocked;

    let statusColor: 'green' | 'yellow' | 'red' = 'green';
    let statusLabel = 'OK';

    if (isBlocked) {
      statusColor = 'red';
      statusLabel = 'Bloqueado';
    } else if (hasOverdue) {
      statusColor = 'red';
      statusLabel = 'Con mora';
    } else if (!hasCredit) {
      statusColor = 'red';
      statusLabel = 'Sin crédito';
    } else if (utilizationPercent >= 80) {
      statusColor = 'yellow';
      statusLabel = 'Crédito alto';
    }

    result.set(client.id, {
      hasCredit,
      isBlocked,
      hasOverdue,
      utilizationPercent: Math.min(utilizationPercent, 999),
      statusColor,
      statusLabel,
    });
  }

  // Add "not found" for missing clients
  for (const id of clientIds) {
    if (!result.has(id)) {
      result.set(id, {
        hasCredit: false,
        isBlocked: true,
        hasOverdue: false,
        utilizationPercent: 100,
        statusColor: 'red',
        statusLabel: 'No encontrado',
      });
    }
  }

  return result;
}
