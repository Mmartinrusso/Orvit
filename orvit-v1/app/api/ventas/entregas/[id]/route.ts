import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logDeliveryCompleted, logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import {
  notifyDeliveryScheduled,
  notifyDeliveryDispatched,
  notifyDeliveryCompleted,
} from '@/lib/ventas/delivery-notifications';

export const dynamic = 'force-dynamic';

// GET - Obtener entrega por ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    // Buscar CON filtro de ViewMode
    const entrega = await prisma.saleDelivery.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: {
        sale: {
          select: {
            id: true,
            numero: true,
            client: { select: { id: true, legalName: true, address: true, phone: true } }
          }
        },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            saleItem: { select: { cantidad: true, cantidadEntregada: true } }
          }
        },
        evidences: true,
        remitos: { select: { id: true, numero: true } },
        createdByUser: { select: { id: true, name: true } }
      }
    });

    if (!entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });

    return NextResponse.json(entrega);
  } catch (error) {
    console.error('Error fetching entrega:', error);
    return NextResponse.json({ error: 'Error al obtener entrega' }, { status: 500 });
  }
}

// PUT - Actualizar entrega (programar, despachar, completar)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_EDIT);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    // Verificar que existe y es accesible en el ViewMode actual
    const entrega = await prisma.saleDelivery.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: { items: true, sale: { include: { items: true } } }
    });

    if (!entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });

    const body = await request.json();
    const { accion, fechaProgramada, transportista, costoFlete, direccionEntrega, gpsEntrega, firmaCliente, notas } = body;

    let nuevoEstado = entrega.estado;
    const updateData: any = {};

    switch (accion) {
      case 'programar':
        // Programar solo actualiza la fecha programada y datos logísticos, no cambia estado
        // El estado debe cambiarse usando los endpoints específicos (preparar, listar, etc.)
        updateData.fechaProgramada = fechaProgramada ? new Date(fechaProgramada) : null;
        updateData.transportista = transportista;
        updateData.costoFlete = costoFlete ? parseFloat(costoFlete) : null;
        updateData.direccionEntrega = direccionEntrega;
        break;

      case 'despachar':
        // DEPRECATED: Use POST /api/ventas/entregas/[id]/despachar instead
        if (!['PENDIENTE', 'EN_PREPARACION', 'LISTA_PARA_DESPACHO'].includes(entrega.estado)) {
          return NextResponse.json({ error: 'Estado inválido para despachar' }, { status: 400 });
        }
        nuevoEstado = 'EN_TRANSITO';
        // No hay campo fechaDespacho, el estado indica el cambio
        break;

      case 'completar':
        if (entrega.estado !== 'EN_TRANSITO') {
          return NextResponse.json({ error: 'Solo se pueden completar entregas en tránsito' }, { status: 400 });
        }
        nuevoEstado = 'ENTREGADA';
        updateData.fechaEntrega = new Date();
        // Parse GPS coordinates if provided (format: "lat,lng")
        if (gpsEntrega) {
          const [lat, lng] = gpsEntrega.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            updateData.latitudEntrega = lat;
            updateData.longitudEntrega = lng;
          }
        }
        updateData.firmaRecepcion = firmaCliente;
        break;

      default:
        // Actualización simple
        if (fechaProgramada !== undefined) updateData.fechaProgramada = fechaProgramada ? new Date(fechaProgramada) : null;
        if (transportista !== undefined) updateData.transportista = transportista;
        if (costoFlete !== undefined) updateData.costoFlete = costoFlete ? parseFloat(costoFlete) : null;
        if (direccionEntrega !== undefined) updateData.direccionEntrega = direccionEntrega;
        if (notas !== undefined) updateData.notas = notas;
    }

    updateData.estado = nuevoEstado;

    // Actualizar en transacción
    const entregaActualizada = await prisma.$transaction(async (tx) => {
      const updated = await tx.saleDelivery.update({
        where: { id },
        data: updateData
      });

      // Si se completó, actualizar cantidades entregadas en la orden
      if (accion === 'completar') {
        for (const item of entrega.items) {
          await tx.saleItem.update({
            where: { id: item.saleItemId },
            data: {
              cantidadEntregada: { increment: item.cantidad },
              cantidadPendiente: { decrement: item.cantidad }
            }
          });
        }

        // Verificar si la orden está completamente entregada
        const ordenActualizada = await tx.sale.findUnique({
          where: { id: entrega.saleId },
          include: { items: true }
        });

        const todoEntregado = ordenActualizada?.items.every(i => Number(i.cantidadPendiente) <= 0);
        if (todoEntregado) {
          await tx.sale.update({
            where: { id: entrega.saleId },
            data: { estado: 'ENTREGADA' }
          });
        }
      }

      return updated;
    });

    // Auditoría
    if (accion === 'completar') {
      await logDeliveryCompleted({
        deliveryId: id,
        companyId: user!.companyId,
        userId: user!.id,
        estadoAnterior: entrega.estado,
      });
    } else if (nuevoEstado !== entrega.estado) {
      await logSalesStatusChange({
        entidad: 'delivery',
        entidadId: id,
        estadoAnterior: entrega.estado,
        estadoNuevo: nuevoEstado,
        companyId: user!.companyId,
        userId: user!.id,
      });
    }

    // Enviar notificaciones automáticas
    try {
      if (accion === 'programar') {
        await notifyDeliveryScheduled(id);
      } else if (accion === 'despachar') {
        await notifyDeliveryDispatched(id);
      } else if (accion === 'completar') {
        await notifyDeliveryCompleted(id);
      }
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
      // No fallar la request si falla la notificación
    }

    return NextResponse.json(entregaActualizada);
  } catch (error) {
    console.error('Error updating entrega:', error);
    return NextResponse.json({ error: 'Error al actualizar entrega' }, { status: 500 });
  }
}

// DELETE - Cancelar/eliminar entrega pendiente
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_DELETE);
    if (error) return error;

    const viewMode = getViewMode(request);

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const entrega = await prisma.saleDelivery.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: { remitos: true }
    });

    if (!entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });

    // Solo se pueden eliminar entregas pendientes o programadas
    if (!['PENDIENTE', 'PROGRAMADA', 'EN_PREPARACION'].includes(entrega.estado)) {
      return NextResponse.json({ error: 'Solo se pueden cancelar entregas pendientes' }, { status: 400 });
    }

    // No eliminar si tiene remitos emitidos
    if (entrega.remitos.length > 0) {
      return NextResponse.json({ error: 'No se puede eliminar, tiene remitos asociados' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.saleDeliveryItem.deleteMany({ where: { deliveryId: id } });
      await tx.saleDelivery.delete({ where: { id } });
    });

    await logSalesStatusChange({
      entidad: 'delivery',
      entidadId: id,
      estadoAnterior: entrega.estado,
      estadoNuevo: 'CANCELADA',
      companyId: user!.companyId,
      userId: user!.id,
    });

    return NextResponse.json({ message: 'Entrega cancelada' });
  } catch (error) {
    console.error('Error deleting entrega:', error);
    return NextResponse.json({ error: 'Error al cancelar entrega' }, { status: 500 });
  }
}
