import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, LoadOrderStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * POST - Cancelar orden de carga
 * Transición: PENDIENTE | CARGANDO → CANCELADA
 * Note: Cannot cancel CARGADA or DESPACHADA (stock already decremented)
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
    const body = await request.json().catch(() => ({}));

    // Verify load order exists and is accessible
    const loadOrder = await prisma.loadOrder.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
    });

    if (!loadOrder) {
      return NextResponse.json({ error: 'Orden de carga no encontrada' }, { status: 404 });
    }

    // Validate transition using state machine
    const validation = validateTransition({
      documentType: 'loadOrder',
      documentId: id,
      fromState: loadOrder.estado,
      toState: LoadOrderStatus.CANCELADA,
      userId: user!.id,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Cannot cancel if already confirmed (stock decremented)
    if (loadOrder.confirmadoAt) {
      return NextResponse.json(
        {
          error:
            'No se puede cancelar una orden confirmada. El stock ya fue decrementado. Contacte con un administrador.',
        },
        { status: 400 }
      );
    }

    // Require reason for cancellation
    if (!body.motivo && !body.observaciones) {
      return NextResponse.json(
        { error: 'Debe especificar un motivo de cancelación' },
        { status: 400 }
      );
    }

    // Update state with cancellation notes
    const timestamp = new Date().toLocaleString('es-AR');
    const motivoText = body.motivo || 'No especificado';
    const observacionesActuales = loadOrder.observaciones || '';
    const nuevasObservaciones = `[${timestamp}] CANCELADA - Motivo: ${motivoText}\n${
      body.observaciones || ''
    }\n\n${observacionesActuales}`.trim();

    const updated = await prisma.loadOrder.update({
      where: { id },
      data: {
        estado: LoadOrderStatus.CANCELADA,
        observaciones: nuevasObservaciones,
      },
    });

    // Audit log
    await logSalesStatusChange({
      entidad: 'loadOrder',
      entidadId: id,
      estadoAnterior: loadOrder.estado,
      estadoNuevo: LoadOrderStatus.CANCELADA,
      companyId: user!.companyId,
      userId: user!.id,
      notas: `Motivo: ${motivoText}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error canceling load order:', error);
    return NextResponse.json({ error: 'Error al cancelar orden de carga' }, { status: 500 });
  }
}
