import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, DeliveryStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { notifyDeliveryDispatched, prepareNotificationData } from '@/lib/ventas/delivery-notifications';

export const dynamic = 'force-dynamic';

/**
 * POST - Despachar entrega (poner en tránsito)
 * Transición: LISTA_PARA_DESPACHO → EN_TRANSITO
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

    // Validar que tenga conductor y vehículo asignados
    if (!delivery.conductorNombre && !body.conductorNombre) {
      return NextResponse.json(
        { error: 'Debe asignar un conductor antes de despachar' },
        { status: 400 }
      );
    }

    if (!delivery.vehiculo && !body.vehiculo) {
      return NextResponse.json(
        { error: 'Debe asignar un vehículo antes de despachar' },
        { status: 400 }
      );
    }

    // Preparar datos de actualización
    const updateData: any = {
      estado: DeliveryStatus.EN_TRANSITO,
    };

    // Actualizar conductor/vehículo si se proveen
    if (body.conductorNombre) updateData.conductorNombre = body.conductorNombre;
    if (body.conductorDNI) updateData.conductorDNI = body.conductorDNI;
    if (body.vehiculo) updateData.vehiculo = body.vehiculo;

    // Capturar coordenadas GPS de inicio si se proveen
    if (body.latitud && body.longitud) {
      updateData.latitudInicio = parseFloat(body.latitud);
      updateData.longitudInicio = parseFloat(body.longitud);
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
    console.error('Error dispatching delivery:', error);
    return NextResponse.json({ error: 'Error al despachar entrega' }, { status: 500 });
  }
}
