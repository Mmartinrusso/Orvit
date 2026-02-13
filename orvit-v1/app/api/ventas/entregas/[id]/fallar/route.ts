import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, DeliveryStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * POST - Marcar entrega como fallida
 * Transición: EN_TRANSITO → ENTREGA_FALLIDA
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
    });

    if (!delivery) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
    }

    // Validar transición usando state machine
    const validation = validateTransition({
      documentType: 'delivery',
      documentId: id,
      fromState: delivery.estado,
      toState: DeliveryStatus.ENTREGA_FALLIDA,
      userId: user!.id,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Requiere motivo de falla
    if (!body.motivo && !body.notas) {
      return NextResponse.json(
        { error: 'Debe especificar el motivo de la falla' },
        { status: 400 }
      );
    }

    // Preparar datos de actualización
    const updateData: any = {
      estado: DeliveryStatus.ENTREGA_FALLIDA,
    };

    // Agregar motivo a las notas
    const motivoText = body.motivo || 'No especificado';
    const notasActuales = delivery.notas || '';
    const timestamp = new Date().toLocaleString('es-AR');
    updateData.notas = `[${timestamp}] ENTREGA FALLIDA - Motivo: ${motivoText}\n${body.notas || ''}\n\n${notasActuales}`.trim();

    // Capturar coordenadas GPS donde falló si se proveen
    if (body.latitud && body.longitud) {
      updateData.latitudEntrega = parseFloat(body.latitud);
      updateData.longitudEntrega = parseFloat(body.longitud);
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
      estadoNuevo: DeliveryStatus.ENTREGA_FALLIDA,
      companyId: user!.companyId,
      userId: user!.id,
      notas: `Motivo: ${motivoText}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error marking delivery as failed:', error);
    return NextResponse.json({ error: 'Error al marcar entrega como fallida' }, { status: 500 });
  }
}
