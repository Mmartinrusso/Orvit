/**
 * Treasury Movement Service - CORRECTED
 *
 * Handles all treasury operations using the ACTUAL models:
 * - CashMovement (for cash account movements)
 * - BankMovement (for bank account movements)
 *
 * REPLACES: treasury-movement-service.ts (which used non-existent TreasuryMovement)
 */

import prisma from '@/lib/prisma';
import { Prisma, DocType } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateCashMovementInput {
  cashAccountId: number;
  fecha: Date;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  descripcion: string;
  referenceType?: string;
  referenceId?: number;
  numeroComprobante?: string;
  comprobanteUrl?: string;
  docType: DocType;
  companyId: number;
  createdBy: number;
}

export interface CreateBankMovementInput {
  bankAccountId: number;
  fecha: Date;
  fechaValor?: Date;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  descripcion: string;
  referenceType?: string;
  referenceId?: number;
  numeroComprobante?: string;
  comprobanteUrl?: string;
  chequeId?: number;
  docType: DocType;
  companyId: number;
  createdBy: number;
}

export interface MovementResult {
  id: number;
  tipo: 'INGRESO' | 'EGRESO';
  monto: Prisma.Decimal;
  saldoPosterior: Prisma.Decimal;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE CASH MOVEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a cash movement (manual or automatic)
 */
export async function createCashMovement(
  input: CreateCashMovementInput,
  tx?: Prisma.TransactionClient
): Promise<MovementResult> {
  const client = tx || prisma;

  // Get current balance
  const cashAccount = await client.cashAccount.findUnique({
    where: { id: input.cashAccountId },
    select: { saldoActual: true },
  });

  if (!cashAccount) {
    throw new Error(`Cash account ${input.cashAccountId} not found`);
  }

  const saldoAnterior = Number(cashAccount.saldoActual);
  const monto = Number(input.monto);
  const saldoPosterior = input.tipo === 'INGRESO' ? saldoAnterior + monto : saldoAnterior - monto;

  // Validate sufficient balance for EGRESO
  if (input.tipo === 'EGRESO' && saldoPosterior < 0) {
    throw new Error(`Insufficient balance in cash account. Available: $${saldoAnterior}, Required: $${monto}`);
  }

  // Create movement
  const movement = await client.cashMovement.create({
    data: {
      cashAccountId: input.cashAccountId,
      companyId: input.companyId,
      tipo: input.tipo,
      ingreso: input.tipo === 'INGRESO' ? monto : 0,
      egreso: input.tipo === 'EGRESO' ? monto : 0,
      saldoAnterior,
      saldoPosterior,
      fecha: input.fecha,
      descripcion: input.descripcion,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      numeroComprobante: input.numeroComprobante,
      comprobanteUrl: input.comprobanteUrl,
      docType: input.docType,
      createdBy: input.createdBy,
    },
    select: {
      id: true,
      tipo: true,
      ingreso: true,
      egreso: true,
      saldoPosterior: true,
    },
  });

  // Update cash account balance
  await client.cashAccount.update({
    where: { id: input.cashAccountId },
    data: { saldoActual: saldoPosterior },
  });

  return {
    id: movement.id,
    tipo: movement.tipo as 'INGRESO' | 'EGRESO',
    monto: movement.tipo === 'INGRESO' ? movement.ingreso : movement.egreso,
    saldoPosterior: movement.saldoPosterior,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE BANK MOVEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a bank movement (manual or automatic)
 */
export async function createBankMovement(
  input: CreateBankMovementInput,
  tx?: Prisma.TransactionClient
): Promise<MovementResult> {
  const client = tx || prisma;

  // Get current balance
  const bankAccount = await client.bankAccount.findUnique({
    where: { id: input.bankAccountId },
    select: { saldoContable: true },
  });

  if (!bankAccount) {
    throw new Error(`Bank account ${input.bankAccountId} not found`);
  }

  const saldoAnterior = Number(bankAccount.saldoContable);
  const monto = Number(input.monto);
  const saldoPosterior = input.tipo === 'INGRESO' ? saldoAnterior + monto : saldoAnterior - monto;

  // Validate sufficient balance for EGRESO
  if (input.tipo === 'EGRESO' && saldoPosterior < 0) {
    throw new Error(`Insufficient balance in bank account. Available: $${saldoAnterior}, Required: $${monto}`);
  }

  // Create movement
  const movement = await client.bankMovement.create({
    data: {
      bankAccountId: input.bankAccountId,
      companyId: input.companyId,
      tipo: input.tipo,
      ingreso: input.tipo === 'INGRESO' ? monto : 0,
      egreso: input.tipo === 'EGRESO' ? monto : 0,
      saldoAnterior,
      saldoPosterior,
      fecha: input.fecha,
      fechaValor: input.fechaValor || input.fecha,
      descripcion: input.descripcion,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      numeroComprobante: input.numeroComprobante,
      comprobanteUrl: input.comprobanteUrl,
      chequeId: input.chequeId,
      docType: input.docType,
      createdBy: input.createdBy,
    },
    select: {
      id: true,
      tipo: true,
      ingreso: true,
      egreso: true,
      saldoPosterior: true,
    },
  });

  // Update bank account balance
  await client.bankAccount.update({
    where: { id: input.bankAccountId },
    data: { saldoContable: saldoPosterior },
  });

  return {
    id: movement.id,
    tipo: movement.tipo as 'INGRESO' | 'EGRESO',
    monto: movement.tipo === 'INGRESO' ? movement.ingreso : movement.egreso,
    saldoPosterior: movement.saldoPosterior,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVERSE MOVEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reverse a cash movement
 */
export async function reverseCashMovement(
  movementId: number,
  reason: string,
  userId: number,
  tx?: Prisma.TransactionClient
): Promise<MovementResult> {
  const client = tx || prisma;

  // Get original movement
  const original = await client.cashMovement.findUnique({
    where: { id: movementId },
    include: { cashAccount: true },
  });

  if (!original) {
    throw new Error(`Cash movement ${movementId} not found`);
  }

  // Create reversal (opposite tipo)
  const reversalTipo = original.tipo === 'INGRESO' ? 'EGRESO' : 'INGRESO';
  const monto = Number(original.ingreso || original.egreso);

  const saldoAnterior = Number(original.cashAccount.saldoActual);
  const saldoPosterior = reversalTipo === 'INGRESO' ? saldoAnterior + monto : saldoAnterior - monto;

  const reversal = await client.cashMovement.create({
    data: {
      cashAccountId: original.cashAccountId,
      companyId: original.companyId,
      tipo: reversalTipo,
      ingreso: reversalTipo === 'INGRESO' ? monto : 0,
      egreso: reversalTipo === 'EGRESO' ? monto : 0,
      saldoAnterior,
      saldoPosterior,
      fecha: new Date(),
      descripcion: `REVERSIÓN: ${reason} (Mov Original #${movementId})`,
      referenceType: original.referenceType,
      referenceId: original.referenceId,
      docType: original.docType,
      createdBy: userId,
    },
    select: {
      id: true,
      tipo: true,
      ingreso: true,
      egreso: true,
      saldoPosterior: true,
    },
  });

  // Update cash account balance
  await client.cashAccount.update({
    where: { id: original.cashAccountId },
    data: { saldoActual: saldoPosterior },
  });

  return {
    id: reversal.id,
    tipo: reversal.tipo as 'INGRESO' | 'EGRESO',
    monto: reversal.tipo === 'INGRESO' ? reversal.ingreso : reversal.egreso,
    saldoPosterior: reversal.saldoPosterior,
  };
}

/**
 * Reverse a bank movement
 */
export async function reverseBankMovement(
  movementId: number,
  reason: string,
  userId: number,
  tx?: Prisma.TransactionClient
): Promise<MovementResult> {
  const client = tx || prisma;

  // Get original movement
  const original = await client.bankMovement.findUnique({
    where: { id: movementId },
    include: { bankAccount: true },
  });

  if (!original) {
    throw new Error(`Bank movement ${movementId} not found`);
  }

  // Create reversal (opposite tipo)
  const reversalTipo = original.tipo === 'INGRESO' ? 'EGRESO' : 'INGRESO';
  const monto = Number(original.ingreso || original.egreso);

  const saldoAnterior = Number(original.bankAccount.saldoContable);
  const saldoPosterior = reversalTipo === 'INGRESO' ? saldoAnterior + monto : saldoAnterior - monto;

  const reversal = await client.bankMovement.create({
    data: {
      bankAccountId: original.bankAccountId,
      companyId: original.companyId,
      tipo: reversalTipo,
      ingreso: reversalTipo === 'INGRESO' ? monto : 0,
      egreso: reversalTipo === 'EGRESO' ? monto : 0,
      saldoAnterior,
      saldoPosterior,
      fecha: new Date(),
      fechaValor: new Date(),
      descripcion: `REVERSIÓN: ${reason} (Mov Original #${movementId})`,
      referenceType: original.referenceType,
      referenceId: original.referenceId,
      chequeId: original.chequeId,
      docType: original.docType,
      createdBy: userId,
    },
    select: {
      id: true,
      tipo: true,
      ingreso: true,
      egreso: true,
      saldoPosterior: true,
    },
  });

  // Update bank account balance
  await client.bankAccount.update({
    where: { id: original.bankAccountId },
    data: { saldoContable: saldoPosterior },
  });

  return {
    id: reversal.id,
    tipo: reversal.tipo as 'INGRESO' | 'EGRESO',
    monto: reversal.tipo === 'INGRESO' ? reversal.ingreso : reversal.egreso,
    saldoPosterior: reversal.saldoPosterior,
  };
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
 * Create a cash deposit (cash → bank transfer)
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

  // Create deposit record
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

  // Create EGRESO from cash
  const egresoMovement = await createCashMovement(
    {
      cashAccountId: input.cashAccountId,
      fecha: input.fecha,
      tipo: 'EGRESO',
      monto: total,
      descripcion: `Depósito ${numero}`,
      referenceType: 'CASH_DEPOSIT',
      referenceId: deposit.id,
      numeroComprobante: input.numeroComprobante,
      docType: input.docType,
      companyId: input.companyId,
      createdBy: input.createdBy,
    },
    client
  );

  // Create INGRESO to bank
  const ingresoMovement = await createBankMovement(
    {
      bankAccountId: input.bankAccountId,
      fecha: input.fecha,
      tipo: 'INGRESO',
      monto: total,
      descripcion: `Depósito ${numero}`,
      referenceType: 'CASH_DEPOSIT',
      referenceId: deposit.id,
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

  return { closing };
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
    const tipo: 'INGRESO' | 'EGRESO' = closing.diferencia.greaterThan(0) ? 'INGRESO' : 'EGRESO';
    const monto = closing.diferencia.abs();

    ajusteMovement = await createCashMovement(
      {
        cashAccountId: closing.cashAccountId,
        fecha: closing.fecha,
        tipo,
        monto: Number(monto),
        descripcion: `Ajuste cierre de caja: ${notas}`,
        referenceType: 'CASH_CLOSING',
        referenceId: closing.id,
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
