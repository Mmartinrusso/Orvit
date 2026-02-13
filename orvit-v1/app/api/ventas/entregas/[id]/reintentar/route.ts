import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, DeliveryStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { notifyDeliveryDispatched, prepareNotificationData } from '@/lib/ventas/delivery-notifications';

export const dynamic = 'force-dynamic';

/**
 * POST - Reintentar entrega fallida
 * Transición: ENTREGA_FALLIDA → EN_TRANSITO
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
        sale: {
          include: {
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
      toState: DeliveryStatus.EN_TRANSITO,
      userId: user!.id,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Preparar datos de actualización
    const updateData: any = {
      estado: DeliveryStatus.EN_TRANSITO,
    };

    // Actualizar fecha programada si se provee
    if (body.nuevaFechaProgramada) {
      updateData.fechaProgramada = new Date(body.nuevaFechaProgramada);
    }

    // Actualizar conductor/vehículo si se proveen (opcional)
    if (body.conductorNombre) updateData.conductorNombre = body.conductorNombre;
    if (body.conductorDNI) updateData.conductorDNI = body.conductorDNI;
    if (body.vehiculo) updateData.vehiculo = body.vehiculo;

    // Agregar nota de reintento
    if (body.motivoReintento) {
      const notasActuales = delivery.notas || '';
      const timestamp = new Date().toLocaleString('es-AR');
      const notaReintento = `[${timestamp}] REINTENTO - ${body.motivoReintento}\n\n${notasActuales}`.trim();
      updateData.notas = notaReintento;
    }

    // Actualizar estado
    const updated = await prisma.saleDelivery.update({
      where: { id },
      data: updateData,
    });

    // Registrar en auditoría
    await logSalesStatusChange({
      entidad: 'delivery',
      entidadId: id,
      estadoAnterior: delivery.estado,
      estadoNuevo: DeliveryStatus.EN_TRANSITO,
      companyId: user!.companyId,
      userId: user!.id,
    });

    // Send customer notification
    try {
      if (delivery.sale?.client) {
        const updatedDelivery = { ...delivery, ...updateData, estado: DeliveryStatus.EN_TRANSITO };
        const notificationData = prepareNotificationData(updatedDelivery, delivery.sale.client);
        await notifyDeliveryDispatched(notificationData);
      }
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error retrying delivery:', error);
    return NextResponse.json({ error: 'Error al reintentar entrega' }, { status: 500 });
  }
}
