/**
 * Reconciliation Matcher Service - O2C Phase 4
 *
 * Auto-matches bank statement items with treasury movements.
 * Supports exact, fuzzy, and reference-based matching.
 */

import { prisma } from '@/lib/prisma';
import { Prisma, MatchType, DocType, TreasuryMovementType } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MatchResult {
  itemId: number;
  movementId: number | null;
  matchType: MatchType | null;
  confidence: number;
  reason: string;
}

export interface AutoMatchResult {
  statementId: number;
  totalItems: number;
  matched: number;
  unmatched: number;
  suspense: number;
  results: MatchResult[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-MATCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Auto-match all unmatched items in a bank statement.
 * Uses an interactive transaction to ensure atomicity — if any match
 * operation fails, all changes are rolled back to prevent inconsistent statistics.
 */
export async function autoMatchStatementItems(
  statementId: number
): Promise<AutoMatchResult> {
  const statement = await prisma.bankStatement.findUnique({
    where: { id: statementId },
    include: {
      items: {
        where: { conciliado: false },
        orderBy: { lineNumber: 'asc' },
      },
    },
  });

  if (!statement) {
    throw new Error('Statement not found');
  }

  const results: MatchResult[] = await prisma.$transaction(async (tx) => {
    const matchResults: MatchResult[] = [];

    for (const item of statement.items) {
      const result = await matchSingleItem(item, statement, tx);
      matchResults.push(result);
    }

    // Update statistics atomically within the same transaction
    const matched = matchResults.filter((r) => r.movementId !== null).length;
    const unmatched = matchResults.filter((r) => r.movementId === null).length;
    const suspense = matchResults.filter(
      (r) => r.movementId === null && r.reason === 'Sin match en sistema'
    ).length;

    await tx.bankStatement.update({
      where: { id: statementId },
      data: {
        itemsConciliados: { increment: matched },
        itemsPendientes: unmatched,
        itemsSuspense: suspense,
        estado: matched === statement.items.length ? 'COMPLETADA' : 'EN_PROCESO',
      },
    });

    return matchResults;
  });

  const matched = results.filter((r) => r.movementId !== null).length;
  const unmatched = results.filter((r) => r.movementId === null).length;
  const suspense = results.filter(
    (r) => r.movementId === null && r.reason === 'Sin match en sistema'
  ).length;

  return {
    statementId,
    totalItems: statement.items.length,
    matched,
    unmatched,
    suspense,
    results,
  };
}

// Type for Prisma interactive transaction client
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Match a single statement item.
 * Accepts an optional transaction client for atomicity.
 */
async function matchSingleItem(
  item: {
    id: number;
    fecha: Date;
    debito: Prisma.Decimal;
    credito: Prisma.Decimal;
    referencia: string | null;
    descripcion: string;
  },
  statement: {
    bankAccountId: number;
    toleranciaMonto: Prisma.Decimal;
    toleranciaDias: number;
    docType: DocType;
    companyId: number;
  },
  tx?: TxClient
): Promise<MatchResult> {
  const db = tx ?? prisma;
  const monto = item.debito.greaterThan(0) ? item.debito : item.credito;
  const tipo = item.debito.greaterThan(0) ? 'EGRESO' : 'INGRESO';

  // 1. Try EXACT match (amount and date exact)
  let movement = await db.treasuryMovement.findFirst({
    where: {
      bankAccountId: statement.bankAccountId,
      monto,
      fecha: item.fecha,
      conciliado: false,
      tipo,
      companyId: statement.companyId,
    },
    select: { id: true },
  });

  if (movement) {
    await markAsMatched(item.id, movement.id, 'EXACT', 1.0, db);
    return {
      itemId: item.id,
      movementId: movement.id,
      matchType: 'EXACT',
      confidence: 1.0,
      reason: 'Monto y fecha exactos',
    };
  }

  // 2. Try FUZZY match (within tolerance)
  const montoMin = monto.minus(statement.toleranciaMonto);
  const montoMax = monto.plus(statement.toleranciaMonto);
  const fechaMin = new Date(item.fecha);
  fechaMin.setDate(fechaMin.getDate() - statement.toleranciaDias);
  const fechaMax = new Date(item.fecha);
  fechaMax.setDate(fechaMax.getDate() + statement.toleranciaDias);

  movement = await db.treasuryMovement.findFirst({
    where: {
      bankAccountId: statement.bankAccountId,
      monto: { gte: montoMin, lte: montoMax },
      fecha: { gte: fechaMin, lte: fechaMax },
      conciliado: false,
      tipo,
      companyId: statement.companyId,
    },
    select: { id: true, monto: true, fecha: true },
  });

  if (movement) {
    const montoDiff = Math.abs(Number(movement.monto) - Number(monto));
    const diasDiff = Math.abs(
      Math.floor(
        (item.fecha.getTime() - movement.fecha.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    const confidence =
      1 -
      (Number(monto) > 0 ? (montoDiff / Number(monto)) * 0.5 : 0) -
      (statement.toleranciaDias > 0 ? (diasDiff / statement.toleranciaDias) * 0.5 : 0);

    await markAsMatched(item.id, movement.id, 'FUZZY', confidence, db);
    return {
      itemId: item.id,
      movementId: movement.id,
      matchType: 'FUZZY',
      confidence: Math.max(0, Math.min(1, confidence)),
      reason: `Diferencia: $${montoDiff.toFixed(2)}, ${diasDiff} días`,
    };
  }

  // 3. Try REFERENCE match (by reference or description)
  if (item.referencia) {
    movement = await db.treasuryMovement.findFirst({
      where: {
        bankAccountId: statement.bankAccountId,
        conciliado: false,
        companyId: statement.companyId,
        OR: [
          { numeroComprobante: { contains: item.referencia } },
          { descripcion: { contains: item.referencia } },
        ],
      },
      select: { id: true },
    });

    if (movement) {
      await markAsMatched(item.id, movement.id, 'REFERENCE', 0.7, db);
      return {
        itemId: item.id,
        movementId: movement.id,
        matchType: 'REFERENCE',
        confidence: 0.7,
        reason: `Match por referencia: ${item.referencia}`,
      };
    }
  }

  // 4. No match - mark as suspense
  await db.bankStatementItem.update({
    where: { id: item.id },
    data: {
      esSuspense: true,
    },
  });

  return {
    itemId: item.id,
    movementId: null,
    matchType: null,
    confidence: 0,
    reason: 'Sin match en sistema',
  };
}

/**
 * Mark an item as matched with a movement.
 * Accepts an optional db client (transaction or prisma) for atomicity.
 */
async function markAsMatched(
  itemId: number,
  movementId: number,
  matchType: MatchType,
  confidence: number,
  db: TxClient | typeof prisma = prisma
): Promise<void> {
  // Update statement item
  await db.bankStatementItem.update({
    where: { id: itemId },
    data: {
      conciliado: true,
      treasuryMovementId: movementId,
      matchType,
      matchConfidence: confidence,
      conciliadoAt: new Date(),
      esSuspense: false,
    },
  });

  // Update treasury movement
  await db.treasuryMovement.update({
    where: { id: movementId },
    data: {
      conciliado: true,
      conciliadoAt: new Date(),
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANUAL RECONCILIATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Manually match a statement item with a movement
 */
export async function manualMatch(
  itemId: number,
  movementId: number,
  userId: number
): Promise<MatchResult> {
  // Verify item exists and is not already matched
  const item = await prisma.bankStatementItem.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    throw new Error('Statement item not found');
  }

  if (item.conciliado) {
    throw new Error('Item already reconciled');
  }

  // Verify movement exists and is not already matched
  const movement = await prisma.treasuryMovement.findUnique({
    where: { id: movementId },
  });

  if (!movement) {
    throw new Error('Treasury movement not found');
  }

  if (movement.conciliado) {
    throw new Error('Movement already reconciled');
  }

  // Match them
  await prisma.$transaction([
    prisma.bankStatementItem.update({
      where: { id: itemId },
      data: {
        conciliado: true,
        treasuryMovementId: movementId,
        matchType: 'MANUAL',
        matchConfidence: 1.0,
        conciliadoAt: new Date(),
        conciliadoBy: userId,
        esSuspense: false,
        suspenseResuelto: item.esSuspense,
      },
    }),
    prisma.treasuryMovement.update({
      where: { id: movementId },
      data: {
        conciliado: true,
        conciliadoAt: new Date(),
        conciliadoBy: userId,
      },
    }),
    // Update statement statistics
    prisma.bankStatement.update({
      where: { id: item.statementId },
      data: {
        itemsConciliados: { increment: 1 },
        itemsPendientes: { decrement: 1 },
        itemsSuspense: item.esSuspense ? { decrement: 1 } : undefined,
      },
    }),
  ]);

  return {
    itemId,
    movementId,
    matchType: 'MANUAL',
    confidence: 1.0,
    reason: 'Conciliado manualmente',
  };
}

/**
 * Unmatch a statement item
 */
export async function unmatch(itemId: number): Promise<void> {
  const item = await prisma.bankStatementItem.findUnique({
    where: { id: itemId },
    include: { statement: true },
  });

  if (!item) {
    throw new Error('Statement item not found');
  }

  if (!item.conciliado) {
    throw new Error('Item is not reconciled');
  }

  await prisma.$transaction([
    // Update statement item
    prisma.bankStatementItem.update({
      where: { id: itemId },
      data: {
        conciliado: false,
        treasuryMovementId: null,
        matchType: null,
        matchConfidence: null,
        conciliadoAt: null,
        conciliadoBy: null,
      },
    }),
    // Update treasury movement if linked
    ...(item.treasuryMovementId
      ? [
          prisma.treasuryMovement.update({
            where: { id: item.treasuryMovementId },
            data: {
              conciliado: false,
              conciliadoAt: null,
              conciliadoBy: null,
            },
          }),
        ]
      : []),
    // Update statement statistics
    prisma.bankStatement.update({
      where: { id: item.statementId },
      data: {
        itemsConciliados: { decrement: 1 },
        itemsPendientes: { increment: 1 },
        itemsSuspense: item.esSuspense ? { increment: 1 } : undefined,
      },
    }),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUSPENSE HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mark a suspense item as resolved (e.g., bank fee that won't be matched)
 */
export async function resolveSuspense(
  itemId: number,
  notas: string,
  userId: number
): Promise<void> {
  const item = await prisma.bankStatementItem.findUnique({
    where: { id: itemId },
    select: { statementId: true, esSuspense: true },
  });

  if (!item) {
    throw new Error('Statement item not found');
  }

  await prisma.$transaction([
    prisma.bankStatementItem.update({
      where: { id: itemId },
      data: {
        suspenseResuelto: true,
        suspenseNotas: notas,
        conciliadoBy: userId,
        conciliadoAt: new Date(),
      },
    }),
    // Decrement itemsSuspense on the parent BankStatement to keep stats consistent
    ...(item.esSuspense
      ? [
          prisma.bankStatement.update({
            where: { id: item.statementId },
            data: {
              itemsSuspense: { decrement: 1 },
            },
          }),
        ]
      : []),
  ]);
}

/**
 * Create a treasury movement from a suspense item
 * (for bank fees, interest, etc. that need to be recorded)
 */
export async function createMovementFromSuspense(
  itemId: number,
  referenceType: string,
  descripcion: string,
  userId: number
): Promise<number> {
  const item = await prisma.bankStatementItem.findUnique({
    where: { id: itemId },
    include: { statement: true },
  });

  if (!item) {
    throw new Error('Statement item not found');
  }

  const monto = item.debito.greaterThan(0) ? item.debito : item.credito;
  const tipo = item.debito.greaterThan(0) ? 'EGRESO' : 'INGRESO';

  // Determine medio based on description
  let medio: 'COMISION' | 'INTERES' | 'AJUSTE' = 'AJUSTE';
  const descLower = item.descripcion.toLowerCase();
  if (descLower.includes('comision') || descLower.includes('cargo')) {
    medio = 'COMISION';
  } else if (descLower.includes('interes')) {
    medio = 'INTERES';
  }

  const movement = await prisma.treasuryMovement.create({
    data: {
      fecha: item.fecha,
      fechaValor: item.fechaValor,
      tipo,
      medio,
      monto,
      accountType: 'BANK',
      bankAccountId: item.statement.bankAccountId,
      referenceType,
      descripcion: descripcion || item.descripcion,
      conciliado: true,
      conciliadoAt: new Date(),
      conciliadoBy: userId,
      docType: item.statement.docType,
      companyId: item.statement.companyId,
      createdBy: userId,
    },
  });

  // Match the item with the new movement
  await prisma.bankStatementItem.update({
    where: { id: itemId },
    data: {
      conciliado: true,
      treasuryMovementId: movement.id,
      matchType: 'MANUAL',
      matchConfidence: 1.0,
      conciliadoAt: new Date(),
      conciliadoBy: userId,
      esSuspense: false,
      suspenseResuelto: true,
      suspenseNotas: `Movimiento creado: ${descripcion}`,
    },
  });

  // Update statement statistics
  await prisma.bankStatement.update({
    where: { id: item.statementId },
    data: {
      itemsConciliados: { increment: 1 },
      itemsPendientes: { decrement: 1 },
      itemsSuspense: { decrement: 1 },
    },
  });

  return movement.id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get unmatched movements for a bank account (for manual matching)
 */
export async function getUnmatchedMovements(
  bankAccountId: number,
  filters?: {
    fechaDesde?: Date;
    fechaHasta?: Date;
    tipo?: 'INGRESO' | 'EGRESO';
    montoMin?: number;
    montoMax?: number;
    companyId?: number;
  }
): Promise<
  Array<{
    id: number;
    fecha: Date;
    tipo: string;
    monto: Prisma.Decimal;
    descripcion: string | null;
    referenceType: string | null;
  }>
> {
  return prisma.treasuryMovement.findMany({
    where: {
      bankAccountId,
      conciliado: false,
      ...(filters?.companyId && { companyId: filters.companyId }),
      ...(filters?.fechaDesde || filters?.fechaHasta
        ? {
            fecha: {
              ...(filters?.fechaDesde && { gte: filters.fechaDesde }),
              ...(filters?.fechaHasta && { lte: filters.fechaHasta }),
            },
          }
        : {}),
      ...(filters?.tipo && { tipo: filters.tipo }),
      ...(filters?.montoMin !== undefined || filters?.montoMax !== undefined
        ? {
            monto: {
              ...(filters?.montoMin !== undefined && { gte: filters.montoMin }),
              ...(filters?.montoMax !== undefined && { lte: filters.montoMax }),
            },
          }
        : {}),
    },
    select: {
      id: true,
      fecha: true,
      tipo: true,
      monto: true,
      descripcion: true,
      referenceType: true,
    },
    orderBy: { fecha: 'desc' },
  });
}

/**
 * Get reconciliation summary for a statement
 */
export async function getReconciliationSummary(statementId: number): Promise<{
  totalItems: number;
  matched: number;
  pending: number;
  suspense: number;
  suspenseResolved: number;
  matchBreakdown: Record<MatchType, number>;
}> {
  const statement = await prisma.bankStatement.findUnique({
    where: { id: statementId },
    include: {
      items: {
        select: {
          conciliado: true,
          matchType: true,
          esSuspense: true,
          suspenseResuelto: true,
        },
      },
    },
  });

  if (!statement) {
    throw new Error('Statement not found');
  }

  const matchBreakdown: Record<MatchType, number> = {
    EXACT: 0,
    FUZZY: 0,
    REFERENCE: 0,
    MANUAL: 0,
  };

  let matched = 0;
  let pending = 0;
  let suspense = 0;
  let suspenseResolved = 0;

  for (const item of statement.items) {
    if (item.conciliado) {
      matched++;
      if (item.matchType) {
        matchBreakdown[item.matchType]++;
      }
    } else {
      pending++;
      if (item.esSuspense) {
        if (item.suspenseResuelto) {
          suspenseResolved++;
        } else {
          suspense++;
        }
      }
    }
  }

  return {
    totalItems: statement.items.length,
    matched,
    pending,
    suspense,
    suspenseResolved,
    matchBreakdown,
  };
}
