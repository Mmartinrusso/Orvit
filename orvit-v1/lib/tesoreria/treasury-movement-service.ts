/**
 * Treasury Movement Service - DEPRECATED ❌
 *
 * @deprecated This file is DEPRECATED and should NOT be used.
 *
 * PROBLEM: This service tries to use a TreasuryMovement model that DOES NOT EXIST
 * in the database schema. It was never implemented.
 *
 * USE INSTEAD: lib/tesoreria/movement-service.ts
 *
 * The correct models are:
 * - CashMovement (for cash account movements)
 * - BankMovement (for bank account movements)
 *
 * This file is kept for reference only. All imports have been updated to use
 * movement-service.ts instead.
 *
 * See: CRITICAL_DISCOVERY_TREASURY_MODULE_BROKEN.md for full details.
 */

import prisma from '@/lib/prisma';
import { Prisma, DocType, TreasuryMovementType, PaymentMedium, TreasuryAccountType, TreasuryMovementStatus } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateMovementInput {
  fecha: Date;
  fechaValor?: Date;
  tipo: TreasuryMovementType;
  medio: PaymentMedium;
  monto: number | Prisma.Decimal;
  moneda?: string;
  accountType: TreasuryAccountType;
  cashAccountId?: number;
  bankAccountId?: number;
  referenceType?: string;
  referenceId?: number;
  chequeId?: number;
  descripcion?: string;
  numeroComprobante?: string;
  docType: DocType;
  companyId: number;
  createdBy: number;
  comprobanteUrl?: string;
}

export interface MovementResult {
  id: number;
  monto: Prisma.Decimal;
  accountType: TreasuryAccountType;
  tipo: TreasuryMovementType;
}

export interface PaymentMovementsResult {
  movements: MovementResult[];
  totalEfectivo: Prisma.Decimal;
  totalTransferencia: Prisma.Decimal;
  totalCheques: Prisma.Decimal;
  total: Prisma.Decimal;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE SINGLE MOVEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a single treasury movement
 */
export async function createTreasuryMovement(
  input: CreateMovementInput,
  tx?: Prisma.TransactionClient
): Promise<MovementResult> {
  const client = tx || prisma;

  const movement = await client.treasuryMovement.create({
    data: {
      fecha: input.fecha,
      fechaValor: input.fechaValor,
      tipo: input.tipo,
      medio: input.medio,
      monto: new Prisma.Decimal(input.monto.toString()),
      moneda: input.moneda || 'ARS',
      accountType: input.accountType,
      cashAccountId: input.cashAccountId,
      bankAccountId: input.bankAccountId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      chequeId: input.chequeId,
      descripcion: input.descripcion,
      numeroComprobante: input.numeroComprobante,
      estado: 'CONFIRMADO',
      docType: input.docType,
      companyId: input.companyId,
      createdBy: input.createdBy,
      comprobanteUrl: input.comprobanteUrl,
    },
    select: {
      id: true,
      monto: true,
      accountType: true,
      tipo: true,
    },
  });

  // Update account balance
  if (input.accountType === 'CASH' && input.cashAccountId) {
    const increment = input.tipo === 'INGRESO' ? input.monto : -Number(input.monto);
    await client.cashAccount.update({
      where: { id: input.cashAccountId },
      data: { saldoActual: { increment } },
    });
  } else if (input.accountType === 'BANK' && input.bankAccountId) {
    const increment = input.tipo === 'INGRESO' ? input.monto : -Number(input.monto);
    await client.bankAccount.update({
      where: { id: input.bankAccountId },
      data: { saldoContable: { increment } },
    });
  }

  return movement;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE MOVEMENTS FOR CLIENT PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface PaymentData {
  id: number;
  fecha: Date;
  clientId: string;
  efectivo?: number;
  transferencia?: number;
  cheques?: Array<{
    id: number;
    monto: number;
  }>;
  cashAccountId?: number;
  bankAccountId?: number;
  reciboNumero?: string;
  docType: DocType;
  companyId: number;
  createdBy: number;
}

/**
 * Create treasury movements for a client payment
 */
export async function createPaymentMovements(
  payment: PaymentData,
  tx?: Prisma.TransactionClient
): Promise<PaymentMovementsResult> {
  const client = tx || prisma;
  const movements: MovementResult[] = [];
  let totalEfectivo = new Prisma.Decimal(0);
  let totalTransferencia = new Prisma.Decimal(0);
  let totalCheques = new Prisma.Decimal(0);

  // 1. Cash payment
  if (payment.efectivo && payment.efectivo > 0 && payment.cashAccountId) {
    const mov = await createTreasuryMovement(
      {
        fecha: payment.fecha,
        tipo: 'INGRESO',
        medio: 'EFECTIVO',
        monto: payment.efectivo,
        accountType: 'CASH',
        cashAccountId: payment.cashAccountId,
        referenceType: 'CLIENT_PAYMENT',
        referenceId: payment.id,
        descripcion: `Cobro efectivo - Recibo ${payment.reciboNumero || payment.id}`,
        docType: payment.docType,
        companyId: payment.companyId,
        createdBy: payment.createdBy,
      },
      client
    );
    movements.push(mov);
    totalEfectivo = new Prisma.Decimal(payment.efectivo);
  }

  // 2. Bank transfer
  if (payment.transferencia && payment.transferencia > 0 && payment.bankAccountId) {
    const mov = await createTreasuryMovement(
      {
        fecha: payment.fecha,
        tipo: 'INGRESO',
        medio: 'TRANSFERENCIA',
        monto: payment.transferencia,
        accountType: 'BANK',
        bankAccountId: payment.bankAccountId,
        referenceType: 'CLIENT_PAYMENT',
        referenceId: payment.id,
        descripcion: `Transferencia recibida - Recibo ${payment.reciboNumero || payment.id}`,
        estado: 'PENDIENTE', // Pending until confirmed in bank
        docType: payment.docType,
        companyId: payment.companyId,
        createdBy: payment.createdBy,
      } as any,
      client
    );
    movements.push(mov);
    totalTransferencia = new Prisma.Decimal(payment.transferencia);
  }

  // 3. Checks
  if (payment.cheques && payment.cheques.length > 0) {
    for (const cheque of payment.cheques) {
      const mov = await createTreasuryMovement(
        {
          fecha: payment.fecha,
          tipo: 'INGRESO',
          medio: 'CHEQUE_TERCERO',
          monto: cheque.monto,
          accountType: 'CHECK_PORTFOLIO',
          chequeId: cheque.id,
          referenceType: 'CLIENT_PAYMENT',
          referenceId: payment.id,
          descripcion: `Cheque recibido - Recibo ${payment.reciboNumero || payment.id}`,
          docType: payment.docType,
          companyId: payment.companyId,
          createdBy: payment.createdBy,
        },
        client
      );
      movements.push(mov);
      totalCheques = totalCheques.plus(cheque.monto);
    }
  }

  return {
    movements,
    totalEfectivo,
    totalTransferencia,
    totalCheques,
    total: totalEfectivo.plus(totalTransferencia).plus(totalCheques),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVERSE MOVEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reverse a treasury movement (for payment cancellation, check rejection, etc.)
 */
export async function reverseTreasuryMovement(
  movementId: number,
  reason: string,
  userId: number,
  tx?: Prisma.TransactionClient
): Promise<MovementResult> {
  const client = tx || prisma;

  // Get original movement
  const original = await client.treasuryMovement.findUnique({
    where: { id: movementId },
  });

  if (!original) {
    throw new Error('Movement not found');
  }

  if (original.estado === 'REVERSADO') {
    throw new Error('Movement already reversed');
  }

  // Create reversal movement
  const reversalTipo: TreasuryMovementType =
    original.tipo === 'INGRESO' ? 'EGRESO' : 'INGRESO';

  const reversal = await client.treasuryMovement.create({
    data: {
      fecha: new Date(),
      fechaValor: original.fechaValor,
      tipo: reversalTipo,
      medio: original.medio,
      monto: original.monto,
      moneda: original.moneda,
      accountType: original.accountType,
      cashAccountId: original.cashAccountId,
      bankAccountId: original.bankAccountId,
      referenceType: original.referenceType,
      referenceId: original.referenceId,
      chequeId: original.chequeId,
      descripcion: `Reversa: ${reason}`,
      reversaDeId: original.id,
      estado: 'CONFIRMADO',
      docType: original.docType,
      companyId: original.companyId,
      createdBy: userId,
    },
    select: {
      id: true,
      monto: true,
      accountType: true,
      tipo: true,
    },
  });

  // Mark original as reversed
  await client.treasuryMovement.update({
    where: { id: movementId },
    data: {
      estado: 'REVERSADO',
      reversadoPorId: reversal.id,
    },
  });

  // Update account balance (reverse the original effect)
  if (original.accountType === 'CASH' && original.cashAccountId) {
    const increment = reversalTipo === 'INGRESO' ? original.monto : original.monto.negated();
    await client.cashAccount.update({
      where: { id: original.cashAccountId },
      data: { saldoActual: { increment } },
    });
  } else if (original.accountType === 'BANK' && original.bankAccountId) {
    const increment = reversalTipo === 'INGRESO' ? original.monto : original.monto.negated();
    await client.bankAccount.update({
      where: { id: original.bankAccountId },
      data: { saldoContable: { increment } },
    });
  }

  return reversal;
}

/**
 * Reverse all movements for a payment
 */
export async function reversePaymentMovements(
  paymentId: number,
  reason: string,
  userId: number,
  tx?: Prisma.TransactionClient
): Promise<MovementResult[]> {
  const client = tx || prisma;

  // Find all movements for this payment
  const movements = await client.treasuryMovement.findMany({
    where: {
      referenceType: 'CLIENT_PAYMENT',
      referenceId: paymentId,
      estado: 'CONFIRMADO',
    },
  });

  const reversals: MovementResult[] = [];

  for (const movement of movements) {
    const reversal = await reverseTreasuryMovement(movement.id, reason, userId, client);
    reversals.push(reversal);
  }

  return reversals;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPOSIT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateDepositInput {
  fecha: Date;
  cashAccountId: number;
  bankAccountId: number;
  efectivo: number;
  cheques: number;
  chequeIds?: number[];
  numeroComprobante?: string;
  docType: DocType;
  companyId: number;
  createdBy: number;
}

/**
 * Create a cash deposit (cash + checks from cash account to bank)
 */
export async function createCashDeposit(
  input: CreateDepositInput,
  tx?: Prisma.TransactionClient
): Promise<{
  deposit: { id: number; numero: string };
  egresoMovement: MovementResult;
  ingresoMovement: MovementResult;
}> {
  const client = tx || prisma;
  const total = input.efectivo + input.cheques;

  // Get next deposit number
  const lastDeposit = await client.cashDeposit.findFirst({
    where: { companyId: input.companyId },
    orderBy: { id: 'desc' },
    select: { numero: true },
  });

  const nextNumber = lastDeposit
    ? parseInt(lastDeposit.numero.split('-').pop() || '0') + 1
    : 1;
  const numero = `DEP-${String(nextNumber).padStart(8, '0')}`;

  // Create deposit
  const deposit = await client.cashDeposit.create({
    data: {
      numero,
      fecha: input.fecha,
      estado: 'CONFIRMADO',
      cashAccountId: input.cashAccountId,
      bankAccountId: input.bankAccountId,
      efectivo: new Prisma.Decimal(input.efectivo),
      cheques: new Prisma.Decimal(input.cheques),
      total: new Prisma.Decimal(total),
      numeroComprobante: input.numeroComprobante,
      chequeIds: input.chequeIds ? JSON.stringify(input.chequeIds) : null,
      docType: input.docType,
      companyId: input.companyId,
      createdBy: input.createdBy,
      confirmedBy: input.createdBy,
      confirmedAt: new Date(),
    },
    select: { id: true, numero: true },
  });

  // Create egreso from cash
  const egresoMovement = await createTreasuryMovement(
    {
      fecha: input.fecha,
      tipo: 'EGRESO',
      medio: 'DEPOSITO',
      monto: total,
      accountType: 'CASH',
      cashAccountId: input.cashAccountId,
      referenceType: 'CASH_DEPOSIT',
      referenceId: deposit.id,
      descripcion: `Depósito ${numero}`,
      numeroComprobante: input.numeroComprobante,
      docType: input.docType,
      companyId: input.companyId,
      createdBy: input.createdBy,
    },
    client
  );

  // Create ingreso to bank
  const ingresoMovement = await createTreasuryMovement(
    {
      fecha: input.fecha,
      tipo: 'INGRESO',
      medio: 'DEPOSITO',
      monto: total,
      accountType: 'BANK',
      bankAccountId: input.bankAccountId,
      referenceType: 'CASH_DEPOSIT',
      referenceId: deposit.id,
      descripcion: `Depósito ${numero}`,
      numeroComprobante: input.numeroComprobante,
      docType: input.docType,
      companyId: input.companyId,
      createdBy: input.createdBy,
    },
    client
  );

  // Update deposit with movement IDs
  await client.cashDeposit.update({
    where: { id: deposit.id },
    data: {
      egresoMovementId: egresoMovement.id,
      ingresoMovementId: ingresoMovement.id,
    },
  });

  // Update check states if any
  if (input.chequeIds && input.chequeIds.length > 0) {
    await client.cheque.updateMany({
      where: { id: { in: input.chequeIds } },
      data: {
        estado: 'DEPOSITADO',
        fechaDeposito: input.fecha,
        depositadoEnBancoId: input.bankAccountId,
      },
    });
  }

  return { deposit, egresoMovement, ingresoMovement };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASH CLOSING
// ═══════════════════════════════════════════════════════════════════════════════

export interface CashClosingInput {
  cashAccountId: number;
  fecha: Date;
  arqueoEfectivo: number;
  arqueoCheques: number;
  desglose?: Record<string, number>;
  docType: DocType;
  companyId: number;
  createdBy: number;
}

/**
 * Create a cash closing (arqueo de caja)
 */
export async function createCashClosing(
  input: CashClosingInput,
  tx?: Prisma.TransactionClient
): Promise<{
  closing: { id: number; diferencia: Prisma.Decimal };
  ajusteMovement?: MovementResult;
}> {
  const client = tx || prisma;

  // Calculate system balance
  const cashAccount = await client.cashAccount.findUnique({
    where: { id: input.cashAccountId },
    select: { saldoActual: true },
  });

  // Get check portfolio for this cash account (in cartera)
  const chequesEnCartera = await client.cheque.aggregate({
    where: {
      companyId: input.companyId,
      estado: 'CARTERA',
    },
    _sum: { monto: true },
  });

  const saldoSistemaEfectivo = cashAccount?.saldoActual || new Prisma.Decimal(0);
  const saldoSistemaCheques = chequesEnCartera._sum.monto || new Prisma.Decimal(0);
  const saldoSistemaTotal = saldoSistemaEfectivo.plus(saldoSistemaCheques);

  const arqueoTotal = input.arqueoEfectivo + input.arqueoCheques;
  const diferencia = new Prisma.Decimal(arqueoTotal).minus(saldoSistemaTotal);

  // Create closing
  const closing = await client.cashClosing.create({
    data: {
      cashAccountId: input.cashAccountId,
      fecha: input.fecha,
      saldoSistemaEfectivo,
      saldoSistemaCheques,
      saldoSistemaTotal,
      arqueoEfectivo: new Prisma.Decimal(input.arqueoEfectivo),
      arqueoCheques: new Prisma.Decimal(input.arqueoCheques),
      arqueoTotal: new Prisma.Decimal(arqueoTotal),
      desglose: input.desglose ? input.desglose : null,
      diferencia,
      estado: diferencia.equals(0) ? 'APROBADO' : 'PENDIENTE',
      docType: input.docType,
      companyId: input.companyId,
      createdBy: input.createdBy,
    },
    select: { id: true, diferencia: true },
  });

  // If there's a difference and it should be adjusted automatically
  let ajusteMovement: MovementResult | undefined;

  // Note: Adjustment should be created only after manual approval
  // This is just the closing record, adjustment comes later

  return { closing, ajusteMovement };
}

/**
 * Approve cash closing with adjustment
 */
export async function approveCashClosingWithAdjustment(
  closingId: number,
  notas: string,
  approvedBy: number,
  tx?: Prisma.TransactionClient
): Promise<{ closing: { id: number }; ajusteMovement?: MovementResult }> {
  const client = tx || prisma;

  const closing = await client.cashClosing.findUnique({
    where: { id: closingId },
    include: { cashAccount: true },
  });

  if (!closing) {
    throw new Error('Cash closing not found');
  }

  let ajusteMovement: MovementResult | undefined;

  // Create adjustment if there's a difference
  if (!closing.diferencia.equals(0)) {
    const tipo: TreasuryMovementType = closing.diferencia.greaterThan(0) ? 'INGRESO' : 'EGRESO';
    const monto = closing.diferencia.abs();

    ajusteMovement = await createTreasuryMovement(
      {
        fecha: closing.fecha,
        tipo,
        medio: 'AJUSTE',
        monto,
        accountType: 'CASH',
        cashAccountId: closing.cashAccountId,
        referenceType: 'CASH_CLOSING',
        referenceId: closing.id,
        descripcion: `Ajuste cierre de caja: ${notas}`,
        docType: closing.docType,
        companyId: closing.companyId,
        createdBy: approvedBy,
      },
      client
    );
  }

  // Update closing
  await client.cashClosing.update({
    where: { id: closingId },
    data: {
      estado: closing.diferencia.equals(0) ? 'APROBADO' : 'CON_DIFERENCIA_APROBADA',
      diferenciaNotas: notas,
      ajusteMovementId: ajusteMovement?.id,
      aprobadoPor: approvedBy,
      aprobadoAt: new Date(),
    },
  });

  return { closing: { id: closingId }, ajusteMovement };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get treasury position (all accounts balances)
 */
export async function getTreasuryPosition(
  companyId: number,
  docTypes: DocType[] = ['T1']
): Promise<{
  cash: Array<{ id: number; nombre: string; saldo: Prisma.Decimal }>;
  bank: Array<{ id: number; nombre: string; saldo: Prisma.Decimal }>;
  checkPortfolio: Prisma.Decimal;
  total: Prisma.Decimal;
}> {
  // Cash accounts
  const cashAccounts = await prisma.cashAccount.findMany({
    where: { companyId, isActive: true },
    select: { id: true, nombre: true, saldoActual: true },
  });

  // Bank accounts
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { companyId, isActive: true },
    select: { id: true, nombre: true, saldoContable: true },
  });

  // Check portfolio (cheques en cartera)
  const checkPortfolio = await prisma.cheque.aggregate({
    where: {
      companyId,
      estado: 'CARTERA',
      docType: { in: docTypes },
    },
    _sum: { monto: true },
  });

  const cash = cashAccounts.map((ca) => ({
    id: ca.id,
    nombre: ca.nombre,
    saldo: ca.saldoActual,
  }));

  const bank = bankAccounts.map((ba) => ({
    id: ba.id,
    nombre: ba.nombre,
    saldo: ba.saldoContable,
  }));

  const cashTotal = cash.reduce((sum, c) => sum.plus(c.saldo), new Prisma.Decimal(0));
  const bankTotal = bank.reduce((sum, b) => sum.plus(b.saldo), new Prisma.Decimal(0));
  const checksTotal = checkPortfolio._sum.monto || new Prisma.Decimal(0);

  return {
    cash,
    bank,
    checkPortfolio: checksTotal,
    total: cashTotal.plus(bankTotal).plus(checksTotal),
  };
}
