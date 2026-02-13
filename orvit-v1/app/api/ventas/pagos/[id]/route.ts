import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { paymentActionSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
  type VentasOperation,
} from '@/lib/ventas/idempotency-helper';
import { voidClientPayment } from '@/lib/ventas/payment-service';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getOperationType(accion: string): VentasOperation {
  switch (accion) {
    case 'confirmar':
      return 'CONFIRM_PAYMENT';
    case 'anular':
      return 'CANCEL_PAYMENT';
    case 'rechazar':
      return 'REJECT_PAYMENT';
    default:
      return 'CONFIRM_PAYMENT';
  }
}

// GET - Obtener pago por ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PAGOS_VIEW);
    if (error) return error;

    const viewMode = getViewMode(request);
    const { id } = await params;
    const paymentId = parseInt(id);

    if (isNaN(paymentId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const pago = await prisma.clientPayment.findFirst({
      where: applyViewMode({ id: paymentId, companyId: user!.companyId }, viewMode),
      include: {
        client: { select: { id: true, legalName: true, name: true } },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                numero: true,
                total: true,
                saldoPendiente: true,
                estado: true,
              },
            },
          },
        },
        cheques: true,
        createdByUser: { select: { id: true, name: true } },
      },
    });

    if (!pago) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    return NextResponse.json(pago);
  } catch (error) {
    console.error('Error fetching pago:', error);
    return NextResponse.json({ error: 'Error al obtener pago' }, { status: 500 });
  }
}

// PUT - Actualizar pago (confirmar, anular, rechazar)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PAGOS_CANCEL);
    if (error) return error;

    const viewMode = getViewMode(request);
    const { id } = await params;
    const paymentId = parseInt(id);

    if (isNaN(paymentId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = paymentActionSchema.safeParse(rawBody);

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
    const idempotencyKey = getIdempotencyKey(request);
    const operation = getOperationType(body.accion);

    // Execute with idempotency
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      user!.companyId,
      operation,
      async () => {
        // Verificar que existe y es accesible en el ViewMode actual
        const pago = await prisma.clientPayment.findFirst({
          where: applyViewMode(
            { id: paymentId, companyId: user!.companyId },
            viewMode
          ),
          include: {
            client: true,
            allocations: {
              include: {
                invoice: {
                  select: {
                    id: true,
                    numero: true,
                    total: true,
                    saldoPendiente: true,
                    estado: true,
                  },
                },
              },
            },
            cheques: true,
          },
        });

        if (!pago) {
          throw new Error('NOT_FOUND');
        }

        switch (body.accion) {
          case 'confirmar': {
            if (pago.estado !== 'PENDIENTE') {
              throw new Error(`INVALID_STATE:confirmar:${pago.estado}`);
            }

            const pagoConfirmado = await prisma.$transaction(async (tx) => {
              const updated = await tx.clientPayment.update({
                where: { id: paymentId },
                data: { estado: 'CONFIRMADO' },
              });

              // Crear ledger entry
              await tx.clientLedgerEntry.create({
                data: {
                  clientId: pago.clientId,
                  companyId: user!.companyId,
                  tipo: 'PAGO',
                  pagoId: pago.id,
                  fecha: pago.fechaPago,
                  debe: 0,
                  haber: Number(pago.totalPago),
                  comprobante: pago.numero,
                  descripcion: `Cobro ${pago.numero} (confirmado)`,
                  createdBy: user!.id,
                },
              });

              // Actualizar deuda del cliente
              await tx.client.update({
                where: { id: pago.clientId },
                data: { currentBalance: { decrement: Number(pago.totalPago) } },
              });

              return updated;
            });

            return {
              message: 'Pago confirmado',
              pago: pagoConfirmado,
            };
          }

          case 'anular': {
            if (!['CONFIRMADO', 'PENDIENTE'].includes(pago.estado)) {
              throw new Error(`INVALID_STATE:anular:${pago.estado}`);
            }

            const facturasAfectadas = pago.allocations.map((a) => ({
              invoiceId: a.invoice.id,
              numero: a.invoice.numero,
              montoAplicado: Number(a.montoAplicado),
              saldoActual: Number(a.invoice.saldoPendiente),
              estadoActual: a.invoice.estado,
            }));

            // Use payment-service to void payment (includes Treasury reversal)
            await voidClientPayment(paymentId, body.motivo || 'Anulación manual', user!.id);

            // Fetch updated payment
            const pagoAnulado = await prisma.clientPayment.findUnique({
              where: { id: paymentId },
              include: {
                client: true,
                allocations: {
                  include: { invoice: true },
                },
                cheques: true,
              },
            });

            return {
              message: 'Pago anulado correctamente (con reversión de Tesorería)',
              pago: pagoAnulado,
              facturasRestauradas: facturasAfectadas.map((f) => ({
                numero: f.numero,
                montoRestaurado: f.montoAplicado,
              })),
            };
          }

          case 'rechazar': {
            if (pago.estado !== 'CONFIRMADO') {
              throw new Error(`INVALID_STATE:rechazar:${pago.estado}`);
            }

            const pagoRechazado = await prisma.$transaction(async (tx) => {
              const updated = await tx.clientPayment.update({
                where: { id: paymentId },
                data: {
                  estado: 'RECHAZADO',
                  motivoRechazo: body.motivo,
                  fechaRechazo: new Date(),
                },
              });

              // Contraasiento en ledger
              await tx.clientLedgerEntry.create({
                data: {
                  clientId: pago.clientId,
                  companyId: user!.companyId,
                  tipo: 'RECHAZO',
                  pagoId: pago.id,
                  fecha: new Date(),
                  debe: Number(pago.totalPago),
                  haber: 0,
                  comprobante: pago.numero,
                  descripcion: `Rechazo Cobro ${pago.numero}: ${body.motivo}`,
                  createdBy: user!.id,
                },
              });

              // Restaurar deuda
              await tx.client.update({
                where: { id: pago.clientId },
                data: { currentBalance: { increment: Number(pago.totalPago) } },
              });

              // Restaurar facturas
              for (const alloc of pago.allocations) {
                const invoice = alloc.invoice;
                const montoAplicado = Number(alloc.montoAplicado);
                const nuevoSaldo = Number(invoice.saldoPendiente) + montoAplicado;
                const total = Number(invoice.total);

                let nuevoEstado = 'PARCIALMENTE_COBRADA';
                if (nuevoSaldo >= total) {
                  nuevoEstado = 'EMITIDA';
                }

                await tx.salesInvoice.update({
                  where: { id: invoice.id },
                  data: {
                    saldoPendiente: nuevoSaldo,
                    estado: nuevoEstado,
                  },
                });
              }

              // Marcar cheques como rechazados
              if (pago.cheques.length > 0) {
                await tx.clientPaymentCheque.updateMany({
                  where: { paymentId },
                  data: { estado: 'RECHAZADO' },
                });
              }

              return updated;
            });

            return {
              message: 'Pago rechazado',
              pago: pagoRechazado,
            };
          }

          default:
            throw new Error('INVALID_ACTION');
        }
      },
      {
        entityType: 'ClientPayment',
        getEntityId: () => paymentId,
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
        return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
      }
      if (error.message.startsWith('INVALID_STATE:')) {
        const [, accion, estado] = error.message.split(':');
        const mensajes: Record<string, string> = {
          confirmar: 'Solo se pueden confirmar pagos pendientes',
          anular: 'Solo se pueden anular pagos confirmados o pendientes',
          rechazar: 'Solo se pueden rechazar pagos confirmados',
        };
        return NextResponse.json(
          { error: mensajes[accion] || 'Estado inválido', estadoActual: estado },
          { status: 422 }
        );
      }
      if (error.message === 'INVALID_ACTION') {
        return NextResponse.json(
          { error: 'Acción no válida. Use: confirmar, anular, rechazar' },
          { status: 400 }
        );
      }
    }

    console.error('Error updating pago:', error);
    return NextResponse.json({ error: 'Error al actualizar pago' }, { status: 500 });
  }
}

// DELETE - Eliminar pago en pendiente
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PAGOS_CANCEL);
    if (error) return error;

    const viewMode = getViewMode(request);
    const { id } = await params;
    const paymentId = parseInt(id);

    if (isNaN(paymentId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const pago = await prisma.clientPayment.findFirst({
      where: applyViewMode({ id: paymentId, companyId: user!.companyId }, viewMode),
      include: { allocations: true, cheques: true },
    });

    if (!pago) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    if (pago.estado !== 'PENDIENTE') {
      return NextResponse.json(
        {
          error:
            'Solo se pueden eliminar pagos pendientes. Use la acción "anular" para pagos confirmados.',
          estadoActual: pago.estado,
        },
        { status: 422 }
      );
    }

    if (pago.allocations.length > 0) {
      return NextResponse.json(
        {
          error:
            'No se puede eliminar un pago con facturas asociadas. Use la acción "anular" en su lugar.',
        },
        { status: 422 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (pago.cheques.length > 0) {
        await tx.clientPaymentCheque.deleteMany({ where: { paymentId } });
      }
      await tx.clientPayment.delete({ where: { id: paymentId } });
    });

    return NextResponse.json({ message: 'Pago eliminado' });
  } catch (error) {
    console.error('Error deleting pago:', error);
    return NextResponse.json({ error: 'Error al eliminar pago' }, { status: 500 });
  }
}
