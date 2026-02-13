import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, DeliveryStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * POST - Marcar entrega como lista para despacho
 * Transición: EN_PREPARACION → LISTA_PARA_DESPACHO
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
      toState: DeliveryStatus.LISTA_PARA_DESPACHO,
      userId: user!.id,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Actualizar estado
    const updated = await prisma.saleDelivery.update({
      where: { id },
      data: { estado: DeliveryStatus.LISTA_PARA_DESPACHO },
    });

    // Registrar en auditoría
    await logSalesStatusChange({
      entidad: 'delivery',
      entidadId: id,
      estadoAnterior: delivery.estado,
      estadoNuevo: DeliveryStatus.LISTA_PARA_DESPACHO,
      companyId: user!.companyId,
      userId: user!.id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error marking delivery as ready:', error);
    return NextResponse.json({ error: 'Error al marcar como lista' }, { status: 500 });
  }
}
