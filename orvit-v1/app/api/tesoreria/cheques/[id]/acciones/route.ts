/**
 * Cheque Actions API - O2C Phase 3
 *
 * Handles cheque operations: deposit, endorse, reject, return to portfolio, cash.
 * All financial operations are idempotent and validated.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAnyPermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { chequeActionSchema } from '@/lib/tesoreria/validation-schemas';
import {
  withIdempotency,
  getIdempotencyKey,
  handleIdempotencyError,
  idempotencyHeaders,
  type TesoreriaOperation,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Map action to idempotency operation
function getOperationType(action: string): TesoreriaOperation {
  switch (action) {
    case 'deposit':
      return 'DEPOSIT_CHEQUE';
    case 'endorse':
      return 'ENDORSE_CHEQUE';
    case 'reject':
      return 'REJECT_CHEQUE';
    case 'cash':
      return 'CASH_CHEQUE';
    default:
      return 'UPDATE_CHEQUE';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Execute cheque action
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // Check any of the action-related permissions
    const { user, error } = await requireAnyPermission([
      TESORERIA_PERMISSIONS.CHEQUES_DEPOSIT,
      TESORERIA_PERMISSIONS.CHEQUES_ENDORSE,
      TESORERIA_PERMISSIONS.CHEQUES_REJECT,
      TESORERIA_PERMISSIONS.CHEQUES_EDIT,
    ]);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const chequeId = parseInt(id);

    if (!chequeId || isNaN(chequeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = chequeActionSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos de solicitud inválidos',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = validationResult.data;
    const idempotencyKey = getIdempotencyKey(req);
    const operation = getOperationType(body.action);

    // Execute with idempotency
    const { response, isReplay, idempotencyKey: usedKey } = await withIdempotency(
      idempotencyKey,
      companyId,
      operation,
      async () => {
        // Fetch cheque
        const cheque = await prisma.cheque.findFirst({
          where: { id: chequeId, companyId },
          include: {
            clientPayment: true,
          },
        });

        if (!cheque) {
          throw new Error('Cheque no encontrado');
        }

        switch (body.action) {
          // ═══════════════════════════════════════════════════════════════════════
          // DEPOSIT - Deposit check to bank account
          // ═══════════════════════════════════════════════════════════════════════
          case 'deposit': {
            if (cheque.estado !== 'CARTERA') {
              throw new Error('Solo se pueden depositar cheques en cartera');
            }

            await prisma.$transaction(async (tx) => {
              // Update cheque
              await tx.cheque.update({
                where: { id: chequeId },
                data: {
                  estado: 'DEPOSITADO',
                  depositadoEn: body.bankAccountId,
                  fechaDeposito: body.fechaDeposito
                    ? new Date(body.fechaDeposito)
                    : new Date(),
                },
              });

              // Create treasury movement (egreso from check portfolio)
              await tx.treasuryMovement.create({
                data: {
                  fecha: body.fechaDeposito ? new Date(body.fechaDeposito) : new Date(),
                  tipo: 'EGRESO',
                  medio: cheque.tipo === 'ECHEQ' ? 'ECHEQ' : 'CHEQUE_TERCERO',
                  monto: cheque.monto,
                  accountType: 'CHECK_PORTFOLIO',
                  chequeId: cheque.id,
                  referenceType: 'CHEQUE_DEPOSIT',
                  referenceId: cheque.id,
                  descripcion: `Depósito cheque ${cheque.numero}`,
                  estado: 'CONFIRMADO',
                  docType: cheque.docType,
                  companyId: cheque.companyId,
                  createdBy: user!.id,
                },
              });

              // Create treasury movement (ingreso to bank - pending until cleared)
              await tx.treasuryMovement.create({
                data: {
                  fecha: body.fechaDeposito ? new Date(body.fechaDeposito) : new Date(),
                  fechaValor: cheque.fechaVencimiento, // Clear date
                  tipo: 'INGRESO',
                  medio: 'DEPOSITO',
                  monto: cheque.monto,
                  accountType: 'BANK',
                  bankAccountId: body.bankAccountId,
                  chequeId: cheque.id,
                  referenceType: 'CHEQUE_DEPOSIT',
                  referenceId: cheque.id,
                  descripcion: `Depósito cheque ${cheque.numero} - ${cheque.banco}`,
                  estado: 'PENDIENTE', // Pending until check clears
                  docType: cheque.docType,
                  companyId: cheque.companyId,
                  createdBy: user!.id,
                },
              });
            });

            return { success: true, message: 'Cheque depositado', chequeId };
          }

          // ═══════════════════════════════════════════════════════════════════════
          // ENDORSE - Endorse check to third party
          // ═══════════════════════════════════════════════════════════════════════
          case 'endorse': {
            if (cheque.estado !== 'CARTERA') {
              throw new Error('Solo se pueden endosar cheques en cartera');
            }

            await prisma.$transaction(async (tx) => {
              // Update cheque
              await tx.cheque.update({
                where: { id: chequeId },
                data: {
                  estado: 'ENDOSADO',
                  endosadoA: body.endosadoA,
                  endosadoACuit: body.cuitEndosatario,
                  fechaEndoso: new Date(),
                },
              });

              // Create treasury movement (egreso from check portfolio)
              await tx.treasuryMovement.create({
                data: {
                  fecha: new Date(),
                  tipo: 'EGRESO',
                  medio: cheque.tipo === 'ECHEQ' ? 'ECHEQ' : 'CHEQUE_TERCERO',
                  monto: cheque.monto,
                  accountType: 'CHECK_PORTFOLIO',
                  chequeId: cheque.id,
                  referenceType: 'CHEQUE_ENDORSE',
                  referenceId: cheque.id,
                  descripcion: `Endoso cheque ${cheque.numero} a ${body.endosadoA}`,
                  estado: 'CONFIRMADO',
                  docType: cheque.docType,
                  companyId: cheque.companyId,
                  createdBy: user!.id,
                },
              });
            });

            return { success: true, message: 'Cheque endosado', chequeId };
          }

          // ═══════════════════════════════════════════════════════════════════════
          // REJECT - Mark check as rejected
          // ═══════════════════════════════════════════════════════════════════════
          case 'reject': {
            if (!['DEPOSITADO', 'CARTERA'].includes(cheque.estado)) {
              throw new Error('No se puede rechazar este cheque');
            }

            await prisma.$transaction(async (tx) => {
              const wasDeposited = cheque.estado === 'DEPOSITADO';

              // Update cheque
              await tx.cheque.update({
                where: { id: chequeId },
                data: {
                  estado: 'RECHAZADO',
                  motivoRechazo: body.motivoRechazo,
                  fechaRechazo: new Date(),
                },
              });

              // If was deposited, reverse the bank ingreso
              if (wasDeposited && cheque.depositadoEn) {
                // Find and reverse the pending ingreso movement
                const ingresoMov = await tx.treasuryMovement.findFirst({
                  where: {
                    chequeId: cheque.id,
                    tipo: 'INGRESO',
                    accountType: 'BANK',
                  },
                });

                if (ingresoMov) {
                  await tx.treasuryMovement.update({
                    where: { id: ingresoMov.id },
                    data: { estado: 'REVERSADO' },
                  });

                  // Create egreso for rejection
                  await tx.treasuryMovement.create({
                    data: {
                      fecha: new Date(),
                      tipo: 'EGRESO',
                      medio: 'DEPOSITO',
                      monto: cheque.monto,
                      accountType: 'BANK',
                      bankAccountId: cheque.depositadoEn,
                      chequeId: cheque.id,
                      referenceType: 'CHEQUE_REJECT',
                      referenceId: cheque.id,
                      descripcion: `Rechazo cheque ${cheque.numero}: ${body.motivoRechazo}`,
                      reversaDeId: ingresoMov.id,
                      estado: 'CONFIRMADO',
                      docType: cheque.docType,
                      companyId: cheque.companyId,
                      createdBy: user!.id,
                    },
                  });
                }

                // Create fee movement if applicable
                const rejectFee = body.gastoRechazo ?? 0;
                if (rejectFee > 0) {
                  await tx.treasuryMovement.create({
                    data: {
                      fecha: new Date(),
                      tipo: 'EGRESO',
                      medio: 'COMISION',
                      monto: rejectFee,
                      accountType: 'BANK',
                      bankAccountId: cheque.depositadoEn,
                      chequeId: cheque.id,
                      referenceType: 'CHEQUE_REJECT_FEE',
                      referenceId: cheque.id,
                      descripcion: `Cargo por rechazo cheque ${cheque.numero}`,
                      estado: 'CONFIRMADO',
                      docType: cheque.docType,
                      companyId: cheque.companyId,
                      createdBy: user!.id,
                    },
                  });
                }
              }

              // If linked to a payment, reverse the payment's AR effect
              if (cheque.clientPaymentId) {
                const payment = cheque.clientPayment;
                if (payment) {
                  // Create reversal ledger entry
                  await tx.clientLedgerEntry.create({
                    data: {
                      clientId: payment.clientId,
                      fecha: new Date(),
                      tipo: 'AJUSTE',
                      debe: cheque.monto,
                      haber: new Prisma.Decimal(0),
                      comprobante: `CHQ-REJ-${cheque.numero}`,
                      descripcion: `Rechazo cheque ${cheque.numero}: ${body.motivoRechazo}`,
                      referenceType: 'CHEQUE_REJECT',
                      referenceId: cheque.id,
                      docType: cheque.docType,
                      companyId: cheque.companyId,
                      createdBy: user!.id,
                    },
                  });

                  // Increase client balance (debt)
                  await tx.client.update({
                    where: { id: payment.clientId },
                    data: { currentBalance: { increment: cheque.monto } },
                  });
                }
              }
            });

            return { success: true, message: 'Cheque rechazado', chequeId };
          }

          // ═══════════════════════════════════════════════════════════════════════
          // CASH - Cash the check directly
          // ═══════════════════════════════════════════════════════════════════════
          case 'cash': {
            if (cheque.estado !== 'CARTERA') {
              throw new Error('Solo se pueden cobrar cheques en cartera');
            }

            await prisma.$transaction(async (tx) => {
              // Update cheque
              await tx.cheque.update({
                where: { id: chequeId },
                data: {
                  estado: 'COBRADO',
                  fechaCobro: body.fechaCobro ? new Date(body.fechaCobro) : new Date(),
                },
              });

              // Egreso from check portfolio
              await tx.treasuryMovement.create({
                data: {
                  fecha: body.fechaCobro ? new Date(body.fechaCobro) : new Date(),
                  tipo: 'EGRESO',
                  medio: cheque.tipo === 'ECHEQ' ? 'ECHEQ' : 'CHEQUE_TERCERO',
                  monto: cheque.monto,
                  accountType: 'CHECK_PORTFOLIO',
                  chequeId: cheque.id,
                  referenceType: 'CHEQUE_CASH',
                  referenceId: cheque.id,
                  descripcion: `Cobro cheque ${cheque.numero}`,
                  estado: 'CONFIRMADO',
                  docType: cheque.docType,
                  companyId: cheque.companyId,
                  createdBy: user!.id,
                },
              });

              // Ingreso to cash
              await tx.treasuryMovement.create({
                data: {
                  fecha: body.fechaCobro ? new Date(body.fechaCobro) : new Date(),
                  tipo: 'INGRESO',
                  medio: 'EFECTIVO',
                  monto: cheque.monto,
                  accountType: 'CASH',
                  cashAccountId: body.cashAccountId,
                  chequeId: cheque.id,
                  referenceType: 'CHEQUE_CASH',
                  referenceId: cheque.id,
                  descripcion: `Cobro cheque ${cheque.numero} - ${cheque.banco}`,
                  estado: 'CONFIRMADO',
                  docType: cheque.docType,
                  companyId: cheque.companyId,
                  createdBy: user!.id,
                },
              });
            });

            return { success: true, message: 'Cheque cobrado', chequeId };
          }

          default:
            throw new Error('Acción no válida');
        }
      },
      {
        entityType: 'Cheque',
        getEntityId: (result) => result.chequeId,
      }
    );

    return NextResponse.json(response, {
      headers: idempotencyHeaders(usedKey, isReplay),
    });
  } catch (error) {
    // Handle idempotency errors
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    console.error('Error in cheque action:', error);
    const message =
      error instanceof Error ? error.message : 'Error en operación de cheque';

    // Return 422 for business logic errors
    const status = message.includes('Solo se pueden') ||
                   message.includes('No se puede') ||
                   message.includes('no encontrado') ? 422 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
