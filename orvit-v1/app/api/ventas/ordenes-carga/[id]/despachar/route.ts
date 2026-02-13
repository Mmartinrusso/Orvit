import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, LoadOrderStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * POST - Despachar vehículo cargado
 * Transición: CARGADA → DESPACHADA
 * Side effect: Updates associated delivery to EN_TRANSITO
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    // Verify load order exists and is accessible
    const loadOrder = await prisma.loadOrder.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: {
        delivery: true,
      },
    });

    if (!loadOrder) {
      return NextResponse.json({ error: 'Orden de carga no encontrada' }, { status: 404 });
    }

    // Validate transition using state machine
    const validation = validateTransition({
      documentType: 'loadOrder',
      documentId: id,
      fromState: loadOrder.estado,
      toState: LoadOrderStatus.DESPACHADA,
      userId: user!.id,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check if load was confirmed
    if (!loadOrder.confirmadoAt) {
      return NextResponse.json(
        { error: 'La carga debe estar confirmada antes de despachar' },
        { status: 400 }
      );
    }

    // Execute in transaction: update load order + delivery
    const updated = await prisma.$transaction(async (tx) => {
      // Update load order
      const updatedLoad = await tx.loadOrder.update({
        where: { id },
        data: { estado: LoadOrderStatus.DESPACHADA },
      });

      // Update associated delivery if exists and in correct state
      if (loadOrder.delivery && loadOrder.delivery.estado === 'LISTA_PARA_DESPACHO') {
        await tx.saleDelivery.update({
          where: { id: loadOrder.delivery.id },
          data: { estado: 'EN_TRANSITO' },
        });

        // Audit log for delivery
        await logSalesStatusChange({
          entidad: 'delivery',
          entidadId: loadOrder.delivery.id,
          estadoAnterior: 'LISTA_PARA_DESPACHO',
          estadoNuevo: 'EN_TRANSITO',
          companyId: user!.companyId,
          userId: user!.id,
          notas: `Despachada desde orden de carga ${loadOrder.numero}`,
        });
      }

      return updatedLoad;
    });

    // Audit log for load order
    await logSalesStatusChange({
      entidad: 'loadOrder',
      entidadId: id,
      estadoAnterior: loadOrder.estado,
      estadoNuevo: LoadOrderStatus.DESPACHADA,
      companyId: user!.companyId,
      userId: user!.id,
      notas: 'Vehículo despachado',
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error dispatching load:', error);
    return NextResponse.json({ error: 'Error al despachar carga' }, { status: 500 });
  }
}
