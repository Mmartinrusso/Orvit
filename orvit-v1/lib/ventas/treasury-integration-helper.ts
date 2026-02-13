/**
 * Treasury Integration Helper for Ventas Module
 *
 * Handles creation of CashMovement/BankMovement from ClientPayment
 * Fixes the critical bug where payment-service.ts tried to use
 * non-existent TreasuryMovement model.
 */

import { PrismaClient, Prisma } from '@prisma/client';

export interface CreateMovementFromPaymentInput {
  paymentId: number;
  cashAccountId?: number;
  bankAccountId?: number;
  chequeId?: number;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  fecha: Date;
  fechaValor?: Date; // Para transferencias
  descripcion: string;
  companyId: number;
  userId: number;
  // Prisma transaction client
  tx: Prisma.TransactionClient;
}

/**
 * Creates a CashMovement for a client payment
 */
export async function createCashMovementFromPayment(
  input: CreateMovementFromPaymentInput
): Promise<{ id: number; saldoPosterior: number }> {
  const { cashAccountId, paymentId, monto, tipo, fecha, descripcion, companyId, tx } = input;

  if (!cashAccountId) {
    throw new Error('cashAccountId is required for cash movements');
  }

  // Get current balance
  const cashAccount = await tx.cashAccount.findUnique({
    where: { id: cashAccountId },
    select: { saldoActual: true },
  });

  if (!cashAccount) {
    throw new Error(`Cash account ${cashAccountId} not found`);
  }

  const saldoAnterior = Number(cashAccount.saldoActual);
  const saldoPosterior =
    tipo === 'INGRESO' ? saldoAnterior + monto : saldoAnterior - monto;

  // Create movement
  const movement = await tx.cashMovement.create({
    data: {
      cashAccountId,
      companyId,
      clientPaymentId: paymentId,
      tipo,
      ingreso: tipo === 'INGRESO' ? monto : 0,
      egreso: tipo === 'EGRESO' ? monto : 0,
      saldoAnterior,
      saldoPosterior,
      fecha,
      descripcion,
    },
  });

  // Update cash account balance
  await tx.cashAccount.update({
    where: { id: cashAccountId },
    data: { saldoActual: saldoPosterior },
  });

  return { id: movement.id, saldoPosterior };
}

/**
 * Creates a BankMovement for a client payment
 */
export async function createBankMovementFromPayment(
  input: CreateMovementFromPaymentInput
): Promise<{ id: number; saldoPosterior: number }> {
  const {
    bankAccountId,
    paymentId,
    chequeId,
    monto,
    tipo,
    fecha,
    fechaValor,
    descripcion,
    companyId,
    tx,
  } = input;

  if (!bankAccountId) {
    throw new Error('bankAccountId is required for bank movements');
  }

  // Get current balance
  const bankAccount = await tx.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: { saldoContable: true },
  });

  if (!bankAccount) {
    throw new Error(`Bank account ${bankAccountId} not found`);
  }

  const saldoAnterior = Number(bankAccount.saldoContable);
  const saldoPosterior =
    tipo === 'INGRESO' ? saldoAnterior + monto : saldoAnterior - monto;

  // Create movement
  const movement = await tx.bankMovement.create({
    data: {
      bankAccountId,
      companyId,
      clientPaymentId: paymentId,
      chequeId: chequeId || null,
      tipo,
      ingreso: tipo === 'INGRESO' ? monto : 0,
      egreso: tipo === 'EGRESO' ? monto : 0,
      saldoAnterior,
      saldoPosterior,
      fecha,
      fechaValor: fechaValor || null,
      descripcion,
    },
  });

  // Update bank account balance
  await tx.bankAccount.update({
    where: { id: bankAccountId },
    data: { saldoContable: saldoPosterior },
  });

  return { id: movement.id, saldoPosterior };
}

/**
 * Reverses a CashMovement (for payment void/cancellation)
 */
export async function reverseCashMovement(
  movementId: number,
  reason: string,
  companyId: number,
  userId: number,
  tx: Prisma.TransactionClient
): Promise<{ id: number }> {
  // Get original movement
  const original = await tx.cashMovement.findUnique({
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
  const saldoPosterior =
    reversalTipo === 'INGRESO' ? saldoAnterior + monto : saldoAnterior - monto;

  const reversal = await tx.cashMovement.create({
    data: {
      cashAccountId: original.cashAccountId,
      companyId,
      clientPaymentId: original.clientPaymentId,
      tipo: reversalTipo,
      ingreso: reversalTipo === 'INGRESO' ? monto : 0,
      egreso: reversalTipo === 'EGRESO' ? monto : 0,
      saldoAnterior,
      saldoPosterior,
      fecha: new Date(),
      descripcion: `REVERSIÓN: ${reason} (Mov Original #${movementId})`,
    },
  });

  // Update cash account balance
  await tx.cashAccount.update({
    where: { id: original.cashAccountId },
    data: { saldoActual: saldoPosterior },
  });

  return { id: reversal.id };
}

/**
 * Reverses a BankMovement (for payment void/cancellation)
 */
export async function reverseBankMovement(
  movementId: number,
  reason: string,
  companyId: number,
  userId: number,
  tx: Prisma.TransactionClient
): Promise<{ id: number }> {
  // Get original movement
  const original = await tx.bankMovement.findUnique({
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
  const saldoPosterior =
    reversalTipo === 'INGRESO' ? saldoAnterior + monto : saldoAnterior - monto;

  const reversal = await tx.bankMovement.create({
    data: {
      bankAccountId: original.bankAccountId,
      companyId,
      clientPaymentId: original.clientPaymentId,
      chequeId: original.chequeId,
      tipo: reversalTipo,
      ingreso: reversalTipo === 'INGRESO' ? monto : 0,
      egreso: reversalTipo === 'EGRESO' ? monto : 0,
      saldoAnterior,
      saldoPosterior,
      fecha: new Date(),
      fechaValor: new Date(),
      descripcion: `REVERSIÓN: ${reason} (Mov Original #${movementId})`,
    },
  });

  // Update bank account balance
  await tx.bankAccount.update({
    where: { id: original.bankAccountId },
    data: { saldoContable: saldoPosterior },
  });

  return { id: reversal.id };
}

/**
 * Gets all movements for a client payment
 */
export async function getMovementsForPayment(
  paymentId: number,
  prisma: PrismaClient
): Promise<{
  cashMovements: any[];
  bankMovements: any[];
  total: number;
}> {
  const [cashMovements, bankMovements] = await Promise.all([
    prisma.cashMovement.findMany({
      where: { clientPaymentId: paymentId },
      include: { cashAccount: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
    }),
    prisma.bankMovement.findMany({
      where: { clientPaymentId: paymentId },
      include: { bankAccount: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
    }),
  ]);

  return {
    cashMovements,
    bankMovements,
    total: cashMovements.length + bankMovements.length,
  };
}
