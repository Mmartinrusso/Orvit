import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { cancelOrderSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Estados desde los que se puede cancelar
const ESTADOS_CANCELABLES = ['BORRADOR', 'CONFIRMADA', 'EN_PREPARACION'];

// POST - Cancelar orden de venta
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_DELETE);
    if (error) return error;

    const companyId = user!.companyId;
    const { id } = await params;
    const saleId = parseInt(id);

    if (isNaN(saleId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse and validate body
    const rawBody = await request.json();
    const validationResult = cancelOrderSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos de solicitud inválidos',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { motivo } = validationResult.data;
    const idempotencyKey = getIdempotencyKey(request);

    // Execute with idempotency
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CANCEL_SALE',
      async () => {
        // Verificar que existe
        const orden = await prisma.sale.findFirst({
          where: { id: saleId, companyId },
          include: {
            deliveries: { select: { id: true, estado: true } },
            invoices: { select: { id: true, estado: true } },
            stockReservations: { select: { id: true, estado: true } },
            client: { select: { id: true, legalName: true } },
          },
        });

        if (!orden) {
          throw new Error('NOT_FOUND');
        }

        // Si ya está cancelada, retornar idempotente
        if (orden.estado === 'CANCELADA') {
          return {
            message: 'Orden de venta ya estaba cancelada',
            orden,
            alreadyCancelled: true,
          };
        }

        // Verificar estado cancelable
        if (!ESTADOS_CANCELABLES.includes(orden.estado)) {
          throw new Error(`INVALID_STATE:${orden.estado}`);
        }

        // Verificar que no tiene entregas confirmadas
        const entregasConfirmadas = orden.deliveries.filter(
          (d) => d.estado === 'ENTREGADA' || d.estado === 'EN_TRANSITO'
        );
        if (entregasConfirmadas.length > 0) {
          throw new Error('HAS_DELIVERIES');
        }

        // Verificar que no tiene facturas emitidas
        const facturasEmitidas = orden.invoices.filter(
          (i) =>
            i.estado === 'EMITIDA' ||
            i.estado === 'COBRADA' ||
            i.estado === 'PARCIALMENTE_COBRADA'
        );
        if (facturasEmitidas.length > 0) {
          throw new Error('HAS_INVOICES');
        }

        const estadoAnterior = orden.estado;

        // Cancelar orden en transacción
        const ordenCancelada = await prisma.$transaction(async (tx) => {
          // Liberar reservas de stock si existen
          const reservasActivas = orden.stockReservations.filter(
            (r) => r.estado === 'RESERVADO' || r.estado === 'PARCIAL'
          );

          if (reservasActivas.length > 0) {
            await tx.stockReservation.updateMany({
              where: {
                saleId,
                estado: { in: ['RESERVADO', 'PARCIAL'] },
              },
              data: {
                estado: 'LIBERADA',
                liberadaAt: new Date(),
              },
            });
          }

          // Cancelar entregas pendientes
          await tx.saleDelivery.updateMany({
            where: {
              saleId,
              estado: 'PENDIENTE',
            },
            data: {
              estado: 'CANCELADA',
            },
          });

          // Cancelar facturas en borrador
          await tx.salesInvoice.updateMany({
            where: {
              saleId,
              estado: 'BORRADOR',
            },
            data: {
              estado: 'ANULADA',
            },
          });

          // Actualizar estado de la orden
          const updated = await tx.sale.update({
            where: { id: saleId },
            data: {
              estado: 'CANCELADA',
              motivoCancelacion: motivo,
              fechaCancelacion: new Date(),
              canceladaPor: user!.id,
            },
          });

          return updated;
        });

        // Registrar auditoría
        await logSalesStatusChange({
          entidad: 'sale',
          entidadId: saleId,
          estadoAnterior,
          estadoNuevo: 'CANCELADA',
          companyId,
          userId: user!.id,
          detalles: { motivo },
        });

        return {
          message: 'Orden de venta cancelada correctamente',
          orden: ordenCancelada,
        };
      },
      {
        entityType: 'Sale',
        getEntityId: () => saleId,
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
        return NextResponse.json(
          { error: 'Orden de venta no encontrada' },
          { status: 404 }
        );
      }
      if (error.message.startsWith('INVALID_STATE:')) {
        const estado = error.message.split(':')[1];
        return NextResponse.json(
          {
            error: `No se puede cancelar una orden en estado ${estado}. Solo se pueden cancelar órdenes en: ${ESTADOS_CANCELABLES.join(', ')}.`,
          },
          { status: 422 }
        );
      }
      if (error.message === 'HAS_DELIVERIES') {
        return NextResponse.json(
          {
            error:
              'No se puede cancelar la orden porque tiene entregas en curso o completadas',
          },
          { status: 422 }
        );
      }
      if (error.message === 'HAS_INVOICES') {
        return NextResponse.json(
          { error: 'No se puede cancelar la orden porque tiene facturas emitidas' },
          { status: 422 }
        );
      }
    }

    console.error('Error cancelando orden de venta:', error);
    return NextResponse.json(
      { error: 'Error al cancelar la orden de venta' },
      { status: 500 }
    );
  }
}
