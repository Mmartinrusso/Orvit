import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import * as cache from '../cache';
import { JWT_SECRET } from '@/lib/auth';
import { invalidateSolicitudesCache } from '@/app/api/compras/solicitudes/route';
import { logDeletion } from '@/lib/compras/audit-helper';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: { company: true },
        },
      },
    });

    return user;
  } catch (error) {
    console.error('[ORDENES PAGO] Error obteniendo usuario desde JWT (DELETE):', error);
    return null;
  }
}

// DELETE /api/compras/ordenes-pago/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const id = Number(params.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Obtener recibos asociados ANTES de borrar (con los montos aplicados)
      const recibos = await tx.paymentOrderReceipt.findMany({
        where: { paymentOrderId: id },
        select: {
          receiptId: true,
          montoAplicado: true,
        },
      });

      // Obtener los IDs únicos de facturas afectadas
      const uniqueReceiptIds = Array.from(new Set(recibos.map((r) => r.receiptId)));

      // Obtener los montos totales aplicados por esta orden para cada factura
      const montosPorFactura = new Map<number, number>();
      recibos.forEach(r => {
        const current = montosPorFactura.get(r.receiptId) || 0;
        montosPorFactura.set(r.receiptId, current + Number(r.montoAplicado || 0));
      });

      // Borrar la orden (los receipt se borran por onDelete: Cascade en Prisma)
      await tx.paymentOrder.delete({
        where: { id },
      });

      // Recalcular estado de las facturas afectadas DESPUÉS de eliminar
      // Ahora buscamos los pagos restantes (sin incluir la orden eliminada)
      for (const receiptId of uniqueReceiptIds) {
        const recibo = await tx.purchaseReceipt.findFirst({
          where: { id: receiptId, companyId },
          select: { total: true, estado: true },
        });
        if (!recibo) {
          console.log(`[DELETE ORDEN] Factura ${receiptId} no encontrada, omitiendo`);
          continue;
        }

        // Obtener el total pagado DESPUÉS de eliminar esta orden
        // (ya no incluirá los recibos de esta orden porque fueron eliminados por cascade)
        const pagosRestantes = await tx.paymentOrderReceipt.aggregate({
          where: { receiptId },
          _sum: { montoAplicado: true },
        });

        const pagado = Number(pagosRestantes._sum.montoAplicado || 0);
        const total = Number(recibo.total || 0);

        let nuevoEstado: string = 'pendiente';
        if (pagado >= total && total > 0) {
          nuevoEstado = 'pagada';
        } else if (pagado > 0 && pagado < total) {
          nuevoEstado = 'parcial';
        } else {
          nuevoEstado = 'pendiente';
        }

        console.log(`[DELETE ORDEN] Actualizando factura ${receiptId}:`, {
          total,
          pagado,
          estadoAnterior: recibo.estado,
          estadoNuevo: nuevoEstado
        });

        await tx.purchaseReceipt.update({
          where: { id: receiptId },
          data: { estado: nuevoEstado },
        });
      }
    });

    // Invalidar caché después de eliminar
    cache.invalidateCache(companyId);

    // Actualizar estado de solicitudes de pago afectadas
    // Si alguna factura vuelve a estar pendiente, la solicitud debe volver a SOLICITADA
    try {
      const solicitudesAfectadas = await prisma.paymentRequest.findMany({
        where: {
          companyId: companyId,
          estado: 'PAGADA',
          facturas: {
            some: {
              receiptId: { in: uniqueReceiptIds }
            }
          }
        },
        include: {
          facturas: {
            select: { receiptId: true }
          }
        }
      });

      for (const solicitud of solicitudesAfectadas) {
        const receiptIds = solicitud.facturas.map(f => f.receiptId);
        const facturasEstado = await prisma.purchaseReceipt.findMany({
          where: { id: { in: receiptIds } },
          select: { id: true, estado: true }
        });

        const todasPagadas = facturasEstado.every(f => f.estado === 'pagada');

        if (!todasPagadas) {
          // Revertir a SOLICITADA si ya no están todas pagadas
          await prisma.paymentRequest.update({
            where: { id: solicitud.id },
            data: { estado: 'SOLICITADA' }
          });
          console.log(`[DELETE ORDEN] Solicitud ${solicitud.numero} revertida a SOLICITADA`);
        }
      }
    } catch (error) {
      console.error('[DELETE ORDEN] Error actualizando solicitudes:', error);
    }

    invalidateSolicitudesCache(companyId);

    // Registrar auditoría
    await logDeletion({
      entidad: 'payment_order',
      entidadId: id,
      companyId,
      userId: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ORDENES PAGO] Error en DELETE:', error);
    return NextResponse.json({ error: 'Error al eliminar la orden de pago' }, { status: 500 });
  }
}


