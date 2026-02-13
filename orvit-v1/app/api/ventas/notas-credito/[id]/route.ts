/**
 * Credit/Debit Note Detail API - O2C Phase 5
 *
 * Get, emit (AFIP), or cancel a credit/debit note.
 * All state changes are idempotent and validated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { creditNoteActionSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
  type VentasOperation,
} from '@/lib/ventas/idempotency-helper';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getOperationType(action: string): VentasOperation {
  switch (action) {
    case 'emit':
      return 'EMIT_CREDIT_NOTE';
    case 'cancel':
      return 'CANCEL_CREDIT_NOTE';
    case 'retry':
      return 'RETRY_CREDIT_NOTE';
    default:
      return 'EMIT_CREDIT_NOTE';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get note detail
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.NOTAS_VIEW);
    if (error) return error;

    const { id } = await params;
    const noteId = parseInt(id);

    if (!noteId || isNaN(noteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const note = await prisma.salesCreditDebitNote.findFirst({
      where: { id: noteId, companyId: user!.companyId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            cuit: true,
            email: true,
            address: true,
          },
        },
        invoice: {
          select: { id: true, numero: true, fecha: true, total: true },
        },
        returnRequest: {
          select: { id: true, numero: true, estado: true },
        },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        ledgerEntry: true,
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error('Error fetching note:', error);
    return NextResponse.json(
      { error: 'Error al obtener nota' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH - Update note status (emit, cancel, retry)
// ═══════════════════════════════════════════════════════════════════════════════

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.NOTAS_EMIT);
    if (error) return error;

    const { id } = await params;
    const noteId = parseInt(id);

    if (!noteId || isNaN(noteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = creditNoteActionSchema.safeParse(rawBody);

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
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      user!.companyId,
      operation,
      async () => {
        const note = await prisma.salesCreditDebitNote.findFirst({
          where: { id: noteId, companyId: user!.companyId },
          include: {
            client: true,
            invoice: true,
          },
        });

        if (!note) {
          throw new Error('NOT_FOUND');
        }

        switch (body.action) {
          case 'emit': {
            if (note.fiscalStatus !== 'DRAFT') {
              throw new Error('INVALID_STATE:emit:Solo se pueden emitir notas en borrador');
            }

            // TODO: Integrate with AFIP service to get CAE
            // For now, simulate successful emission
            const mockCae = `70${Date.now()}`;
            const caeVencimiento = new Date();
            caeVencimiento.setDate(caeVencimiento.getDate() + 10);

            await prisma.$transaction(async (tx) => {
              // Update note with CAE
              await tx.salesCreditDebitNote.update({
                where: { id: noteId },
                data: {
                  fiscalStatus: 'AUTHORIZED',
                  cae: mockCae,
                  caeVencimiento,
                  emitidoAt: new Date(),
                  emitidoPor: user!.id,
                },
              });

              // Create ledger entry
              const isCredit = note.tipo === 'NOTA_CREDITO';
              const ledgerEntry = await tx.clientLedgerEntry.create({
                data: {
                  clientId: note.clientId,
                  fecha: note.fecha,
                  tipo: isCredit ? 'NC' : 'ND',
                  debe: isCredit ? new Prisma.Decimal(0) : note.total,
                  haber: isCredit ? note.total : new Prisma.Decimal(0),
                  comprobante: note.numero,
                  descripcion: note.descripcion || `${note.tipo} - ${note.motivo}`,
                  referenceType: 'CREDIT_NOTE',
                  referenceId: noteId,
                  docType: note.docType,
                  companyId: note.companyId,
                  createdBy: user!.id,
                },
              });

              // Link ledger entry to note
              await tx.salesCreditDebitNote.update({
                where: { id: noteId },
                data: { ledgerEntryId: ledgerEntry.id },
              });

              // Update client balance
              await tx.client.update({
                where: { id: note.clientId },
                data: {
                  currentBalance: isCredit
                    ? { decrement: note.total }
                    : { increment: note.total },
                },
              });

              // If linked to invoice, update invoice saldo
              if (note.invoiceId && isCredit) {
                const invoice = await tx.salesInvoice.findUnique({
                  where: { id: note.invoiceId },
                  select: { saldoPendiente: true, totalCobrado: true, total: true },
                });

                if (invoice) {
                  const newSaldo = invoice.saldoPendiente.sub(note.total);
                  await tx.salesInvoice.update({
                    where: { id: note.invoiceId },
                    data: {
                      saldoPendiente: newSaldo.lessThan(0)
                        ? new Prisma.Decimal(0)
                        : newSaldo,
                      estado: newSaldo.lessThanOrEqualTo(0) ? 'COBRADA' : undefined,
                    },
                  });
                }
              }
            });

            return {
              success: true,
              cae: mockCae,
              caeVencimiento,
              message: 'Nota emitida exitosamente',
            };
          }

          case 'cancel': {
            if (note.fiscalStatus === 'CANCELLED') {
              throw new Error('INVALID_STATE:cancel:Nota ya está cancelada');
            }

            if (note.fiscalStatus === 'AUTHORIZED') {
              throw new Error(
                'INVALID_STATE:cancel:No se puede cancelar una nota autorizada. Debe emitir una nota contraria.'
              );
            }

            await prisma.salesCreditDebitNote.update({
              where: { id: noteId },
              data: {
                fiscalStatus: 'CANCELLED',
              },
            });

            return {
              success: true,
              message: 'Nota cancelada',
            };
          }

          case 'retry': {
            if (note.fiscalStatus !== 'REJECTED') {
              throw new Error('INVALID_STATE:retry:Solo se pueden reintentar notas rechazadas');
            }

            await prisma.salesCreditDebitNote.update({
              where: { id: noteId },
              data: {
                fiscalStatus: 'DRAFT',
                afipRetries: { increment: 1 },
                afipError: null,
              },
            });

            return {
              success: true,
              message: 'Nota lista para reintentar',
            };
          }

          default:
            throw new Error('INVALID_ACTION');
        }
      },
      {
        entityType: 'CreditDebitNote',
        getEntityId: () => noteId,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      headers: idempotencyHeaders(
        idempotencyResult.idempotencyKey,
        idempotencyResult.isReplay
      ),
    });
  } catch (error) {
    // Handle idempotency errors
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
      }
      if (error.message.startsWith('INVALID_STATE:')) {
        const [, , mensaje] = error.message.split(':');
        return NextResponse.json({ error: mensaje }, { status: 422 });
      }
      if (error.message === 'INVALID_ACTION') {
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
      }
    }

    console.error('Error updating note:', error);
    return NextResponse.json(
      { error: 'Error al actualizar nota' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Delete note (only if draft)
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.NOTAS_EMIT);
    if (error) return error;

    const { id } = await params;
    const noteId = parseInt(id);

    if (!noteId || isNaN(noteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const note = await prisma.salesCreditDebitNote.findFirst({
      where: { id: noteId, companyId: user!.companyId },
    });

    if (!note) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    if (note.fiscalStatus !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar notas en borrador' },
        { status: 422 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Delete items first
      await tx.salesCreditDebitNoteItem.deleteMany({
        where: { noteId },
      });
      // Delete note
      await tx.salesCreditDebitNote.delete({
        where: { id: noteId },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Nota eliminada',
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { error: 'Error al eliminar nota' },
      { status: 500 }
    );
  }
}
