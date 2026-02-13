/**
 * Balance Rebuilder - O2C Phase 1
 *
 * Recalculates client balance from ClientLedgerEntry (source of truth).
 * Used to reconcile cached currentBalance when discrepancies are detected.
 *
 * IMPORTANT: ClientLedgerEntry is the SOURCE OF TRUTH for AR (Accounts Receivable).
 * Client.currentBalance is a CACHE that can be rebuilt from ledger entries.
 *
 * OPTIMIZED FOR:
 * - Transactional integrity
 * - ViewMode (T1/T2) support
 * - Batch operations for efficiency
 * - Detailed audit trail
 */

import { Prisma, DocType } from '@prisma/client';
import prisma from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ViewMode = 'S' | 'E'; // Standard (T1) | Extended (T1+T2)

export interface RebuildResult {
  clientId: string;
  clientName: string;
  previousBalance: Prisma.Decimal;
  newBalance: Prisma.Decimal;
  difference: Prisma.Decimal;
  entriesProcessed: number;
  totalDebe: Prisma.Decimal;
  totalHaber: Prisma.Decimal;
  wasUpdated: boolean;
  viewMode: ViewMode;
}

export interface BatchRebuildResult {
  totalClients: number;
  clientsUpdated: number;
  clientsWithDifference: number;
  totalDifference: Prisma.Decimal;
  results: RebuildResult[];
  executionTimeMs: number;
}

export interface LedgerSummary {
  clientId: string;
  totalDebe: Prisma.Decimal;
  totalHaber: Prisma.Decimal;
  balance: Prisma.Decimal;
  entryCount: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  entriesByType: {
    type: string;
    count: number;
    totalDebe: Prisma.Decimal;
    totalHaber: Prisma.Decimal;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getDocTypeFilter(viewMode: ViewMode): DocType[] {
  return viewMode === 'S' ? [DocType.T1] : [DocType.T1, DocType.T2];
}

function toDecimal(value: number | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  return new Prisma.Decimal(value);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE CLIENT REBUILD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rebuild a single client's balance from ledger entries.
 *
 * @param clientId - The client ID to rebuild
 * @param companyId - The company ID
 * @param viewMode - ViewMode for T1/T2 filtering
 * @param updateCache - Whether to update the Client.currentBalance cache
 * @returns RebuildResult with details of the operation
 */
export async function rebuildCustomerBalance(
  clientId: string,
  companyId: number,
  viewMode: ViewMode = 'E', // Default to Extended (all documents)
  updateCache: boolean = true
): Promise<RebuildResult> {
  const docTypes = getDocTypeFilter(viewMode);

  // Get current cached balance
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      legalName: true,
      currentBalance: true,
      companyId: true,
    },
  });

  if (!client) {
    throw new Error(`Cliente ${clientId} no encontrado`);
  }

  if (client.companyId !== companyId) {
    throw new Error(`Cliente ${clientId} no pertenece a la empresa ${companyId}`);
  }

  // Calculate balance from ledger (source of truth)
  const ledgerAggregation = await prisma.clientLedgerEntry.aggregate({
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
    _count: true,
  });

  const totalDebe = toDecimal(ledgerAggregation._sum.debe);
  const totalHaber = toDecimal(ledgerAggregation._sum.haber);
  const newBalance = totalDebe.minus(totalHaber); // Positive = client owes money
  const previousBalance = toDecimal(client.currentBalance);
  const difference = newBalance.minus(previousBalance);
  const entriesProcessed = ledgerAggregation._count;

  // Update cache if requested and there's a difference
  let wasUpdated = false;
  if (updateCache && !difference.isZero()) {
    await prisma.client.update({
      where: { id: clientId },
      data: { currentBalance: newBalance.toNumber() },
    });
    wasUpdated = true;
  }

  return {
    clientId,
    clientName: client.name || client.legalName || 'Sin nombre',
    previousBalance,
    newBalance,
    difference,
    entriesProcessed,
    totalDebe,
    totalHaber,
    wasUpdated,
    viewMode,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH REBUILD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rebuild balances for multiple clients efficiently.
 *
 * @param clientIds - Array of client IDs to rebuild (empty = all with discrepancies)
 * @param companyId - The company ID
 * @param viewMode - ViewMode for T1/T2 filtering
 * @param updateCache - Whether to update the Client.currentBalance cache
 * @param onlyWithDiscrepancies - If true and clientIds is empty, only rebuild clients with differences
 * @returns BatchRebuildResult with summary and individual results
 */
export async function batchRebuildCustomerBalances(
  clientIds: string[],
  companyId: number,
  viewMode: ViewMode = 'E',
  updateCache: boolean = true,
  onlyWithDiscrepancies: boolean = true
): Promise<BatchRebuildResult> {
  const startTime = Date.now();
  const docTypes = getDocTypeFilter(viewMode);
  const results: RebuildResult[] = [];

  // If no specific clients, find all clients (optionally filtering by discrepancy)
  let targetClientIds = clientIds;

  if (targetClientIds.length === 0) {
    // Get all active clients for this company
    const clients = await prisma.client.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: { id: true },
    });
    targetClientIds = clients.map(c => c.id);
  }

  // Get current cached balances for all clients
  const clients = await prisma.client.findMany({
    where: {
      id: { in: targetClientIds },
      companyId,
    },
    select: {
      id: true,
      name: true,
      legalName: true,
      currentBalance: true,
    },
  });

  const clientMap = new Map(clients.map(c => [c.id, c]));

  // Calculate ledger balances for all clients in one query
  const ledgerBalances = await prisma.clientLedgerEntry.groupBy({
    by: ['clientId'],
    where: {
      clientId: { in: targetClientIds },
      companyId,
      docType: { in: docTypes },
      anulado: false,
    },
    _sum: {
      debe: true,
      haber: true,
    },
    _count: true,
  });

  const ledgerMap = new Map(
    ledgerBalances.map(l => [
      l.clientId,
      {
        totalDebe: toDecimal(l._sum.debe),
        totalHaber: toDecimal(l._sum.haber),
        count: l._count,
      },
    ])
  );

  // Process each client
  const clientsToUpdate: { id: string; newBalance: number }[] = [];

  for (const clientId of targetClientIds) {
    const client = clientMap.get(clientId);
    if (!client) continue;

    const ledger = ledgerMap.get(clientId) ?? {
      totalDebe: new Prisma.Decimal(0),
      totalHaber: new Prisma.Decimal(0),
      count: 0,
    };

    const newBalance = ledger.totalDebe.minus(ledger.totalHaber);
    const previousBalance = toDecimal(client.currentBalance);
    const difference = newBalance.minus(previousBalance);

    // Skip if no discrepancy and filtering is enabled
    if (onlyWithDiscrepancies && difference.isZero()) {
      continue;
    }

    const result: RebuildResult = {
      clientId,
      clientName: client.name || client.legalName || 'Sin nombre',
      previousBalance,
      newBalance,
      difference,
      entriesProcessed: ledger.count,
      totalDebe: ledger.totalDebe,
      totalHaber: ledger.totalHaber,
      wasUpdated: false,
      viewMode,
    };

    if (updateCache && !difference.isZero()) {
      clientsToUpdate.push({ id: clientId, newBalance: newBalance.toNumber() });
      result.wasUpdated = true;
    }

    results.push(result);
  }

  // Batch update all clients with differences
  if (clientsToUpdate.length > 0) {
    await prisma.$transaction(
      clientsToUpdate.map(c =>
        prisma.client.update({
          where: { id: c.id },
          data: { currentBalance: c.newBalance },
        })
      )
    );
  }

  const executionTimeMs = Date.now() - startTime;
  const totalDifference = results.reduce(
    (sum, r) => sum.plus(r.difference.abs()),
    new Prisma.Decimal(0)
  );

  return {
    totalClients: targetClientIds.length,
    clientsUpdated: clientsToUpdate.length,
    clientsWithDifference: results.length,
    totalDifference,
    results,
    executionTimeMs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEDGER ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get detailed ledger summary for a client.
 * Useful for debugging and auditing.
 */
export async function getLedgerSummary(
  clientId: string,
  companyId: number,
  viewMode: ViewMode = 'E'
): Promise<LedgerSummary> {
  const docTypes = getDocTypeFilter(viewMode);

  // Get aggregated data
  const [aggregate, entriesByType, dateRange] = await Promise.all([
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
      _count: true,
    }),

    prisma.clientLedgerEntry.groupBy({
      by: ['tipo'],
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
      _count: true,
    }),

    prisma.clientLedgerEntry.aggregate({
      where: {
        clientId,
        companyId,
        docType: { in: docTypes },
        anulado: false,
      },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
  ]);

  const totalDebe = toDecimal(aggregate._sum.debe);
  const totalHaber = toDecimal(aggregate._sum.haber);

  return {
    clientId,
    totalDebe,
    totalHaber,
    balance: totalDebe.minus(totalHaber),
    entryCount: aggregate._count,
    oldestEntry: dateRange._min.createdAt,
    newestEntry: dateRange._max.createdAt,
    entriesByType: entriesByType.map(e => ({
      type: e.tipo || 'SIN_TIPO',
      count: e._count,
      totalDebe: toDecimal(e._sum.debe),
      totalHaber: toDecimal(e._sum.haber),
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISCREPANCY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface DiscrepancyInfo {
  clientId: string;
  clientName: string;
  cachedBalance: Prisma.Decimal;
  ledgerBalance: Prisma.Decimal;
  difference: Prisma.Decimal;
  percentDifference: number;
}

/**
 * Find all clients with balance discrepancies.
 * Useful for scheduled reconciliation checks.
 *
 * @param companyId - Company ID to check
 * @param viewMode - ViewMode for T1/T2 filtering
 * @param tolerance - Minimum difference to report (default 0.01)
 * @returns Array of clients with discrepancies
 */
export async function findBalanceDiscrepancies(
  companyId: number,
  viewMode: ViewMode = 'E',
  tolerance: Prisma.Decimal = new Prisma.Decimal('0.01')
): Promise<DiscrepancyInfo[]> {
  const docTypes = getDocTypeFilter(viewMode);

  // Get all clients with their cached balance
  const clients = await prisma.client.findMany({
    where: {
      companyId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      legalName: true,
      currentBalance: true,
    },
  });

  // Get ledger balances for all clients
  const ledgerBalances = await prisma.clientLedgerEntry.groupBy({
    by: ['clientId'],
    where: {
      companyId,
      docType: { in: docTypes },
      anulado: false,
    },
    _sum: {
      debe: true,
      haber: true,
    },
  });

  const ledgerMap = new Map(
    ledgerBalances.map(l => [
      l.clientId,
      toDecimal(l._sum.debe).minus(toDecimal(l._sum.haber)),
    ])
  );

  const discrepancies: DiscrepancyInfo[] = [];

  for (const client of clients) {
    const cachedBalance = toDecimal(client.currentBalance);
    const ledgerBalance = ledgerMap.get(client.id) ?? new Prisma.Decimal(0);
    const difference = ledgerBalance.minus(cachedBalance);

    if (difference.abs().greaterThan(tolerance)) {
      const percentDifference = cachedBalance.isZero()
        ? 100
        : difference.abs().dividedBy(cachedBalance.abs()).times(100).toNumber();

      discrepancies.push({
        clientId: client.id,
        clientName: client.name || client.legalName || 'Sin nombre',
        cachedBalance,
        ledgerBalance,
        difference,
        percentDifference: Math.min(percentDifference, 9999),
      });
    }
  }

  // Sort by absolute difference descending
  discrepancies.sort((a, b) =>
    b.difference.abs().minus(a.difference.abs()).toNumber()
  );

  return discrepancies;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED RECONCILIATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run scheduled balance reconciliation for a company.
 * Called by cron job or manually from admin panel.
 *
 * @param companyId - Company ID
 * @param viewMode - ViewMode for T1/T2 filtering
 * @param autoFix - Whether to automatically fix discrepancies
 * @returns Summary of reconciliation run
 */
export async function runScheduledReconciliation(
  companyId: number,
  viewMode: ViewMode = 'E',
  autoFix: boolean = false
): Promise<{
  discrepanciesFound: number;
  discrepanciesFixed: number;
  totalDifferenceAmount: Prisma.Decimal;
  details: DiscrepancyInfo[];
}> {
  // Find all discrepancies
  const discrepancies = await findBalanceDiscrepancies(companyId, viewMode);

  let discrepanciesFixed = 0;

  if (autoFix && discrepancies.length > 0) {
    // Fix all discrepancies in a single batch
    const result = await batchRebuildCustomerBalances(
      discrepancies.map(d => d.clientId),
      companyId,
      viewMode,
      true,
      false // Don't filter, we already have the list
    );
    discrepanciesFixed = result.clientsUpdated;
  }

  const totalDifferenceAmount = discrepancies.reduce(
    (sum, d) => sum.plus(d.difference.abs()),
    new Prisma.Decimal(0)
  );

  return {
    discrepanciesFound: discrepancies.length,
    discrepanciesFixed,
    totalDifferenceAmount,
    details: discrepancies,
  };
}
