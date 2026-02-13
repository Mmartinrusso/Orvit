import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, DeliveryStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange, logDeliveryCompleted } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { syncDeliveryQuantities } from '@/lib/ventas/partial-delivery-service';
import { notifyDeliveryCompleted, prepareNotificationData } from '@/lib/ventas/delivery-notifications';

export const dynamic = 'force-dynamic';

/**
 * POST - Confirmar entrega completada
 * Transición: EN_TRANSITO | RETIRADA → ENTREGADA
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);
    const body = await request.json().catch(() => ({}));

    // Verificar que la entrega existe y es accesible
    const delivery = await prisma.saleDelivery.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: {
        items: true,
        sale: {
          include: {
            items: true,
            client: true,
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
    }

    // Validar transición usando state machine
    const validation = validateTransition({
      documentType: 'delivery',
      documentId: id,
      fromState: delivery.estado,
      toState: DeliveryStatus.ENTREGADA,
      userId: user!.id,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Ejecutar en transacción para mantener consistencia
    const updated = await prisma.$transaction(async (tx) => {
      // Preparar datos de actualización
      const updateData: any = {
        estado: DeliveryStatus.ENTREGADA,
        fechaEntrega: new Date(),
      };

      // Capturar coordenadas GPS de entrega si se proveen
      if (body.latitud && body.longitud) {
        updateData.latitudEntrega = parseFloat(body.latitud);
        updateData.longitudEntrega = parseFloat(body.longitud);
      }

      // Capturar firma del cliente si se provee (Base64)
      if (body.firmaCliente) {
        updateData.firmaRecepcion = body.firmaCliente;
      }

      // Capturar datos de quien recibe
      if (body.recibeNombre) {
        updateData.recibeNombre = body.recibeNombre;
      }

      if (body.recibeDNI) {
        updateData.recibeDNI = body.recibeDNI;
      }

      // Actualizar entrega
      const deliveryUpdated = await tx.saleDelivery.update({
        where: { id },
        data: updateData,
      });

      // Actualizar cantidades entregadas en los items de la venta
      for (const deliveryItem of delivery.items) {
        await tx.saleItem.update({
          where: { id: deliveryItem.saleItemId },
          data: {
            cantidadEntregada: { increment: deliveryItem.cantidad },
            cantidadPendiente: { decrement: deliveryItem.cantidad },
          },
        });
      }

      return deliveryUpdated;
    });

    // Sincronizar cantidades y actualizar estado de la orden
    await syncDeliveryQuantities(delivery.saleId);

    // Registrar en auditoría
    await logDeliveryCompleted({
      deliveryId: id,
      companyId: user!.companyId,
      userId: user!.id,
      estadoAnterior: delivery.estado,
    });

    // Send customer notification
    try {
      if (delivery.sale?.client) {
        const completedDelivery = { ...delivery, ...updated, estado: DeliveryStatus.ENTREGADA };
        const notificationData = prepareNotificationData(completedDelivery, delivery.sale.client);
        await notifyDeliveryCompleted(notificationData);
      }
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error completing delivery:', error);
    return NextResponse.json({ error: 'Error al confirmar entrega' }, { status: 500 });
  }
}
