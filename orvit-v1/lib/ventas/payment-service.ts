/**
 * Payment Service - O2C Phase 3
 *
 * Handles client payments with treasury integration.
 * Creates CashMovement/BankMovement entries automatically for each payment medium.
 *
 * FIXED: Was using non-existent TreasuryMovement model. Now uses CashMovement and BankMovement.
 */

import { prisma } from '@/lib/prisma';
import { getNextNumber } from '@/lib/ventas/sequence-generator';
import { Prisma } from '@prisma/client';
import {
  createCashMovementFromPayment,
  createBankMovementFromPayment,
  reverseCashMovement,
  reverseBankMovement,
} from '@/lib/ventas/treasury-integration-helper';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PaymentMedium {
  tipo: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE_TERCERO' | 'CHEQUE_PROPIO' | 'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'OTRO';
  monto: number;
  accountId?: number; // cashAccountId or bankAccountId
  accountType?: 'CASH' | 'BANK';
  // For transfers
  numeroComprobante?: string;
  fechaAcreditacion?: Date;
  // For checks
  chequeData?: ChequeInput;
}

export interface ChequeInput {
  numero: string;
  banco: string;
  titular?: string;
  cuit?: string;
  fechaEmision: Date;
  fechaVencimiento: Date;
  monto: number;
  tipo?: 'FISICO' | 'ECHEQ';
}

export interface InvoiceAllocation {
  invoiceId: number;
  monto: number;
}

export interface CreatePaymentInput {
  clientId: string;
  fechaPago: Date;
  medios: PaymentMedium[];
  allocations?: InvoiceAllocation[];
  // Retenciones
  retIVA?: number;
  retGanancias?: number;
  retIngBrutos?: number;
  // Config
  notas?: string;
  docType: 'T1' | 'T2';
  companyId: number;
  userId: number;
  // Estado inicial (PENDIENTE para aprobación, CONFIRMADO para confirmación inmediata)
  estadoInicial?: 'PENDIENTE' | 'CONFIRMADO';
  // Idempotency
  idempotencyKey?: string;
}

export interface PaymentResult {
  id: number;
  numero: string;
  totalPago: number;
  cashMovementIds: number[];
  bankMovementIds: number[];
  chequeIds: number[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

export async function createClientPayment(
  input: CreatePaymentInput
): Promise<PaymentResult> {
  const {
    clientId,
    fechaPago,
    medios,
    allocations = [],
    retIVA = 0,
    retGanancias = 0,
    retIngBrutos = 0,
    notas,
    docType,
    companyId,
    userId,
    estadoInicial = 'CONFIRMADO', // Default: confirmación inmediata (legacy behavior)
    idempotencyKey,
  } = input;

  // Check idempotency
  if (idempotencyKey) {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });
    if (existing && existing.status === 'COMPLETED') {
      return JSON.parse(existing.response as string) as PaymentResult;
    }
  }

  // Calculate totals
  const totalPago = medios.reduce((sum, m) => sum + m.monto, 0);
  const efectivo = medios
    .filter((m) => m.tipo === 'EFECTIVO')
    .reduce((sum, m) => sum + m.monto, 0);
  const transferencia = medios
    .filter((m) => m.tipo === 'TRANSFERENCIA')
    .reduce((sum, m) => sum + m.monto, 0);
  const chequesTerceros = medios
    .filter((m) => m.tipo === 'CHEQUE_TERCERO')
    .reduce((sum, m) => sum + m.monto, 0);
  const chequesPropios = medios
    .filter((m) => m.tipo === 'CHEQUE_PROPIO')
    .reduce((sum, m) => sum + m.monto, 0);
  const tarjetaCredito = medios
    .filter((m) => m.tipo === 'TARJETA_CREDITO')
    .reduce((sum, m) => sum + m.monto, 0);
  const tarjetaDebito = medios
    .filter((m) => m.tipo === 'TARJETA_DEBITO')
    .reduce((sum, m) => sum + m.monto, 0);
  const otrosMedios = medios
    .filter((m) => m.tipo === 'OTRO')
    .reduce((sum, m) => sum + m.monto, 0);

  if (totalPago <= 0) {
    throw new Error('El monto total debe ser mayor a 0');
  }

  // Validate client
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId },
  });
  if (!client) {
    throw new Error('Cliente no encontrado');
  }

  // Validate allocations
  let totalAplicado = 0;
  for (const alloc of allocations) {
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: alloc.invoiceId, clientId, companyId },
      select: { id: true, numero: true, saldoPendiente: true },
    });
    if (!invoice) {
      throw new Error(`Factura ${alloc.invoiceId} no encontrada`);
    }
    if (Number(invoice.saldoPendiente) < alloc.monto) {
      throw new Error(
        `El monto a aplicar (${alloc.monto}) excede el saldo pendiente de la factura ${invoice.numero}`
      );
    }
    totalAplicado += alloc.monto;
  }

  // Create payment in transaction
  const result = await prisma.$transaction(
    async (tx) => {
      // Generate receipt number
      const sequence = await getNextNumber(companyId, 'RECEIPT');

      // Create payment with initial state
      const payment = await tx.clientPayment.create({
        data: {
          numero: sequence.formatted,
          clientId,
          fechaPago,
          totalPago,
          efectivo,
          transferencia,
          chequesTerceros,
          chequesPropios,
          tarjetaCredito,
          tarjetaDebito,
          otrosMedios,
          retIVA,
          retGanancias,
          retIngBrutos,
          notas,
          estado: estadoInicial,
          esRecibo: true,
          reciboNumero: sequence.formatted,
          mediosData: medios as any, // Store medios array for creating treasury movements when approving PENDIENTE payments
          docType,
          companyId,
          createdBy: userId,
        },
      });

      const cashMovementIds: number[] = [];
      const bankMovementIds: number[] = [];
      const chequeIds: number[] = [];

      // Create treasury movements ONLY if payment is CONFIRMADO
      // If PENDIENTE, movements will be created when payment is approved
      if (estadoInicial === 'CONFIRMADO') {
        // Create treasury movements for each payment medium
        for (const medio of medios) {
          if (medio.monto <= 0) continue;

          // EFECTIVO → CashMovement
          if (medio.tipo === 'EFECTIVO' && medio.accountId) {
          const { id } = await createCashMovementFromPayment({
            paymentId: payment.id,
            cashAccountId: medio.accountId,
            tipo: 'INGRESO',
            monto: medio.monto,
            fecha: fechaPago,
            descripcion: `Cobro ${sequence.formatted} - ${client.name || client.legalName}`,
            companyId,
            userId,
            tx,
          });
          cashMovementIds.push(id);
        }

        // TRANSFERENCIA → BankMovement
        if (medio.tipo === 'TRANSFERENCIA' && medio.accountId) {
          const { id } = await createBankMovementFromPayment({
            paymentId: payment.id,
            bankAccountId: medio.accountId,
            tipo: 'INGRESO',
            monto: medio.monto,
            fecha: fechaPago,
            fechaValor: medio.fechaAcreditacion || fechaPago,
            descripcion: `Transferencia ${sequence.formatted} - ${client.name || client.legalName}${
              medio.numeroComprobante ? ` (Comp: ${medio.numeroComprobante})` : ''
            }`,
            companyId,
            userId,
            tx,
          });
          bankMovementIds.push(id);
        }

        // CHEQUE → Create Cheque record (already correct, no treasury movement needed - tracked via Cheque model)
        if (
          (medio.tipo === 'CHEQUE_TERCERO' || medio.tipo === 'CHEQUE_PROPIO') &&
          medio.chequeData
        ) {
          const cheque = await tx.cheque.create({
            data: {
              numero: medio.chequeData.numero,
              banco: medio.chequeData.banco,
              titular: medio.chequeData.titular,
              cuit: medio.chequeData.cuit,
              fechaEmision: medio.chequeData.fechaEmision,
              fechaVencimiento: medio.chequeData.fechaVencimiento,
              monto: medio.chequeData.monto,
              tipo: medio.chequeData.tipo || 'FISICO',
              origen: medio.tipo === 'CHEQUE_TERCERO' ? 'RECIBIDO' : 'PROPIO',
              estado: 'CARTERA',
              clientPaymentId: payment.id,
              docType,
              companyId,
              createdBy: userId,
            },
          });
          chequeIds.push(cheque.id);
          // Note: Cheque movement to bank account happens when deposited via app/api/tesoreria/cheques/[id]/acciones
        }

        // TARJETA_CREDITO → BankMovement
        if (medio.tipo === 'TARJETA_CREDITO' && medio.accountId) {
          const { id } = await createBankMovementFromPayment({
            paymentId: payment.id,
            bankAccountId: medio.accountId,
            tipo: 'INGRESO',
            monto: medio.monto,
            fecha: fechaPago,
            fechaValor: medio.fechaAcreditacion || undefined, // Cards may have delayed settlement
            descripcion: `Tarjeta Crédito ${sequence.formatted} - ${client.name || client.legalName}`,
            companyId,
            userId,
            tx,
          });
          bankMovementIds.push(id);
        }

        // TARJETA_DEBITO → BankMovement
        if (medio.tipo === 'TARJETA_DEBITO' && medio.accountId) {
          const { id } = await createBankMovementFromPayment({
            paymentId: payment.id,
            bankAccountId: medio.accountId,
            tipo: 'INGRESO',
            monto: medio.monto,
            fecha: fechaPago,
            descripcion: `Tarjeta Débito ${sequence.formatted} - ${client.name || client.legalName}`,
            companyId,
            userId,
            tx,
          });
          bankMovementIds.push(id);
        }
      }
      } // End if (estadoInicial === 'CONFIRMADO') for treasury movements

      // Create allocations
      for (const alloc of allocations) {
        await tx.invoicePaymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: alloc.invoiceId,
            montoAplicado: alloc.monto,
          },
        });

        // Only update invoices if payment is CONFIRMADO
        if (estadoInicial === 'CONFIRMADO') {
          const invoice = await tx.salesInvoice.findUnique({
            where: { id: alloc.invoiceId },
          });
          const nuevoSaldo = Number(invoice!.saldoPendiente) - alloc.monto;

          await tx.salesInvoice.update({
            where: { id: alloc.invoiceId },
            data: {
              saldoPendiente: nuevoSaldo <= 0 ? 0 : nuevoSaldo,
              totalCobrado: { increment: alloc.monto },
              estado: nuevoSaldo <= 0 ? 'COBRADA' : 'PARCIALMENTE_COBRADA',
            },
          });
        }
      }

      // Only create ledger entry and update balance if payment is CONFIRMADO
      // If PENDIENTE, this will be done when payment is approved
      if (estadoInicial === 'CONFIRMADO') {
        // Create ledger entry
        await tx.clientLedgerEntry.create({
          data: {
            clientId,
            fecha: fechaPago,
            tipo: 'PAGO',
            debe: new Prisma.Decimal(0),
            haber: new Prisma.Decimal(totalPago),
            comprobante: sequence.formatted,
            descripcion: `Cobro ${sequence.formatted}`,
            referenceType: 'CLIENT_PAYMENT',
            referenceId: payment.id,
            docType,
            companyId,
            createdBy: userId,
          },
        });

        // Update client balance
        await tx.client.update({
          where: { id: clientId },
          data: { currentBalance: { decrement: totalPago } },
        });
      }

      return {
        id: payment.id,
        numero: sequence.formatted,
        totalPago,
        cashMovementIds,
        bankMovementIds,
        chequeIds,
      };
    },
    { timeout: 15000 }
  );

  // Save idempotency key
  if (idempotencyKey) {
    await prisma.idempotencyKey.upsert({
      where: { key: idempotencyKey },
      create: {
        key: idempotencyKey,
        response: JSON.stringify(result),
        status: 'COMPLETED',
        companyId,
        operation: 'CREATE_PAYMENT',
        entityType: 'ClientPayment',
        entityId: result.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      update: {
        response: JSON.stringify(result),
        status: 'COMPLETED',
        entityId: result.id,
      },
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVE PAYMENT (PENDIENTE → CONFIRMADO)
// ═══════════════════════════════════════════════════════════════════════════════

export async function approveClientPayment(
  paymentId: number,
  userId: number,
  notas?: string
): Promise<void> {
  const payment = await prisma.clientPayment.findUnique({
    where: { id: paymentId },
    include: {
      allocations: {
        include: {
          invoice: true,
        },
      },
      client: true,
    },
  });

  if (!payment) {
    throw new Error('Pago no encontrado');
  }

  if (payment.estado !== 'PENDIENTE') {
    throw new Error(`El pago ya está ${payment.estado}. Solo se pueden aprobar pagos PENDIENTES.`);
  }

  await prisma.$transaction(
    async (tx) => {
      // Update payment to CONFIRMADO
      await tx.clientPayment.update({
        where: { id: paymentId },
        data: {
          estado: 'CONFIRMADO',
          notas: notas ? `${payment.notas || ''}\nAprobado: ${notas}`.trim() : payment.notas,
          updatedAt: new Date(),
        },
      });

      // Update allocated invoices
      for (const alloc of payment.allocations) {
        const invoice = alloc.invoice!;
        const nuevoSaldo = Number(invoice.saldoPendiente) - Number(alloc.montoAplicado);

        await tx.salesInvoice.update({
          where: { id: invoice.id },
          data: {
            saldoPendiente: nuevoSaldo <= 0 ? 0 : nuevoSaldo,
            totalCobrado: { increment: Number(alloc.montoAplicado) },
            estado: nuevoSaldo <= 0 ? 'COBRADA' : 'PARCIALMENTE_COBRADA',
          },
        });
      }

      // Create ledger entry
      await tx.clientLedgerEntry.create({
        data: {
          clientId: payment.clientId,
          fecha: payment.fechaPago,
          tipo: 'PAGO',
          debe: new Prisma.Decimal(0),
          haber: payment.totalPago,
          comprobante: payment.numero,
          descripcion: `Cobro ${payment.numero} (Aprobado)`,
          referenceType: 'CLIENT_PAYMENT',
          referenceId: payment.id,
          docType: payment.docType,
          companyId: payment.companyId,
          createdBy: userId,
        },
      });

      // Update client balance
      await tx.client.update({
        where: { id: payment.clientId },
        data: { currentBalance: { decrement: Number(payment.totalPago) } },
      });

      // Create treasury movements if payment has mediosData
      // This handles PENDIENTE payments that didn't create movements at creation
      if (payment.mediosData && Array.isArray(payment.mediosData)) {
        const medios = payment.mediosData as PaymentMedium[];

        for (const medio of medios) {
          if (medio.monto <= 0) continue;

          // EFECTIVO → CashMovement
          if (medio.tipo === 'EFECTIVO' && medio.accountId) {
            await createCashMovementFromPayment({
              paymentId: payment.id,
              cashAccountId: medio.accountId,
              tipo: 'INGRESO',
              monto: medio.monto,
              fecha: payment.fechaPago,
              descripcion: `Cobro ${payment.numero} (Aprobado) - ${payment.client.name || payment.client.legalName}`,
              companyId: payment.companyId,
              userId,
              tx,
            });
          }

          // TRANSFERENCIA → BankMovement
          if (medio.tipo === 'TRANSFERENCIA' && medio.accountId) {
            await createBankMovementFromPayment({
              paymentId: payment.id,
              bankAccountId: medio.accountId,
              tipo: 'INGRESO',
              monto: medio.monto,
              fecha: payment.fechaPago,
              fechaValor: medio.fechaAcreditacion || payment.fechaPago,
              descripcion: `Transferencia ${payment.numero} (Aprobado) - ${payment.client.name || payment.client.legalName}${
                medio.numeroComprobante ? ` (Comp: ${medio.numeroComprobante})` : ''
              }`,
              companyId: payment.companyId,
              userId,
              tx,
            });
          }

          // TARJETA_CREDITO → BankMovement
          if (medio.tipo === 'TARJETA_CREDITO' && medio.accountId) {
            await createBankMovementFromPayment({
              paymentId: payment.id,
              bankAccountId: medio.accountId,
              tipo: 'INGRESO',
              monto: medio.monto,
              fecha: payment.fechaPago,
              fechaValor: medio.fechaAcreditacion || undefined,
              descripcion: `Tarjeta Crédito ${payment.numero} (Aprobado) - ${payment.client.name || payment.client.legalName}`,
              companyId: payment.companyId,
              userId,
              tx,
            });
          }

          // TARJETA_DEBITO → BankMovement
          if (medio.tipo === 'TARJETA_DEBITO' && medio.accountId) {
            await createBankMovementFromPayment({
              paymentId: payment.id,
              bankAccountId: medio.accountId,
              tipo: 'INGRESO',
              monto: medio.monto,
              fecha: payment.fechaPago,
              descripcion: `Tarjeta Débito ${payment.numero} (Aprobado) - ${payment.client.name || payment.client.legalName}`,
              companyId: payment.companyId,
              userId,
              tx,
            });
          }

          // CHEQUE movements are not created here - they're tracked via Cheque model
          // and processed when deposited via /api/tesoreria/cheques/[id]/acciones
        }
      }
    },
    { timeout: 15000 }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REJECT PAYMENT (PENDIENTE → RECHAZADO)
// ═══════════════════════════════════════════════════════════════════════════════

export async function rejectClientPayment(
  paymentId: number,
  reason: string,
  userId: number
): Promise<void> {
  const payment = await prisma.clientPayment.findUnique({
    where: { id: paymentId },
    include: {
      chequesRecibidos: true,
    },
  });

  if (!payment) {
    throw new Error('Pago no encontrado');
  }

  if (payment.estado !== 'PENDIENTE') {
    throw new Error(`El pago ya está ${payment.estado}. Solo se pueden rechazar pagos PENDIENTES.`);
  }

  await prisma.$transaction(async (tx) => {
    // Update payment to RECHAZADO
    await tx.clientPayment.update({
      where: { id: paymentId },
      data: {
        estado: 'RECHAZADO',
        motivoRechazo: reason,
        fechaRechazo: new Date(),
      },
    });

    // Reverse cash movements (if any)
    const cashMovements = await tx.cashMovement.findMany({
      where: { clientPaymentId: paymentId },
    });
    for (const cashMov of cashMovements) {
      await reverseCashMovement(cashMov.id, `Pago rechazado: ${reason}`, payment.companyId, userId, tx);
    }

    // Reverse bank movements (if any)
    const bankMovements = await tx.bankMovement.findMany({
      where: { clientPaymentId: paymentId },
    });
    for (const bankMov of bankMovements) {
      await reverseBankMovement(bankMov.id, `Pago rechazado: ${reason}`, payment.companyId, userId, tx);
    }

    // Cancel cheques
    for (const cheque of payment.chequesRecibidos) {
      await tx.cheque.update({
        where: { id: cheque.id },
        data: {
          estado: 'RECHAZADO',
        },
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOID PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

export async function voidClientPayment(
  paymentId: number,
  reason: string,
  userId: number
): Promise<void> {
  const payment = await prisma.clientPayment.findUnique({
    where: { id: paymentId },
    include: {
      allocations: true,
      chequesRecibidos: true,
    },
  });

  if (!payment) {
    throw new Error('Pago no encontrado');
  }

  if (payment.estado === 'ANULADO') {
    throw new Error('Pago ya está anulado');
  }

  await prisma.$transaction(async (tx) => {
    // Reverse cash movements (if any)
    const cashMovements = await tx.cashMovement.findMany({
      where: { clientPaymentId: paymentId },
    });
    for (const cashMov of cashMovements) {
      await reverseCashMovement(cashMov.id, `Pago anulado: ${reason}`, payment.companyId, userId, tx);
    }

    // Reverse bank movements (if any)
    const bankMovements = await tx.bankMovement.findMany({
      where: { clientPaymentId: paymentId },
    });
    for (const bankMov of bankMovements) {
      await reverseBankMovement(bankMov.id, `Pago anulado: ${reason}`, payment.companyId, userId, tx);
    }

    // Reverse invoice allocations
    for (const alloc of payment.allocations) {
      await tx.salesInvoice.update({
        where: { id: alloc.invoiceId },
        data: {
          saldoPendiente: { increment: alloc.montoAplicado },
          totalCobrado: { decrement: alloc.montoAplicado },
          estado: 'EMITIDA',
        },
      });
    }

    // Update cheques
    for (const cheque of payment.chequesRecibidos) {
      await tx.cheque.update({
        where: { id: cheque.id },
        data: { estado: 'ANULADO' },
      });
    }

    // Create reversal ledger entry
    await tx.clientLedgerEntry.create({
      data: {
        clientId: payment.clientId,
        fecha: new Date(),
        tipo: 'AJUSTE',
        debe: payment.totalPago,
        haber: new Prisma.Decimal(0),
        comprobante: `ANUL-${payment.numero}`,
        descripcion: `Anulación de cobro ${payment.numero}: ${reason}`,
        referenceType: 'PAYMENT_VOID',
        referenceId: paymentId,
        docType: payment.docType,
        companyId: payment.companyId,
        createdBy: userId,
      },
    });

    // Restore client balance
    await tx.client.update({
      where: { id: payment.clientId },
      data: { currentBalance: { increment: payment.totalPago } },
    });

    // Mark payment as voided
    await tx.clientPayment.update({
      where: { id: paymentId },
      data: {
        estado: 'ANULADO',
        notas: `${payment.notas || ''}\n[ANULADO] ${reason}`,
      },
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET PAYMENT SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPaymentSummary(
  companyId: number,
  fechaDesde: Date,
  fechaHasta: Date,
  viewMode: 'S' | 'E'
): Promise<{
  totalCobrado: number;
  cantidadPagos: number;
  porMedio: Record<string, number>;
  porEstado: Record<string, number>;
}> {
  const docTypes = viewMode === 'S' ? ['T1'] : ['T1', 'T2'];

  const payments = await prisma.clientPayment.findMany({
    where: {
      companyId,
      docType: { in: docTypes as any },
      fechaPago: { gte: fechaDesde, lte: fechaHasta },
      estado: { not: 'ANULADO' },
    },
    select: {
      totalPago: true,
      efectivo: true,
      transferencia: true,
      chequesTerceros: true,
      chequesPropios: true,
      tarjetaCredito: true,
      tarjetaDebito: true,
      otrosMedios: true,
      estado: true,
    },
  });

  const porMedio = {
    efectivo: 0,
    transferencia: 0,
    chequesTerceros: 0,
    chequesPropios: 0,
    tarjetaCredito: 0,
    tarjetaDebito: 0,
    otrosMedios: 0,
  };

  const porEstado: Record<string, number> = {};
  let totalCobrado = 0;

  for (const p of payments) {
    totalCobrado += Number(p.totalPago);
    porMedio.efectivo += Number(p.efectivo);
    porMedio.transferencia += Number(p.transferencia);
    porMedio.chequesTerceros += Number(p.chequesTerceros);
    porMedio.chequesPropios += Number(p.chequesPropios);
    porMedio.tarjetaCredito += Number(p.tarjetaCredito);
    porMedio.tarjetaDebito += Number(p.tarjetaDebito);
    porMedio.otrosMedios += Number(p.otrosMedios);
    porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;
  }

  return {
    totalCobrado,
    cantidadPagos: payments.length,
    porMedio,
    porEstado,
  };
}
