import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, LoadOrderStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * POST - Iniciar proceso de carga
 * Transición: PENDIENTE → CARGANDO
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
    });

    if (!loadOrder) {
      return NextResponse.json({ error: 'Orden de carga no encontrada' }, { status: 404 });
    }

    // Validate transition using state machine
    const validation = validateTransition({
      documentType: 'loadOrder',
      documentId: id,
      fromState: loadOrder.estado,
      toState: LoadOrderStatus.CARGANDO,
      userId: user!.id,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Update state
    const updated = await prisma.loadOrder.update({
      where: { id },
      data: { estado: LoadOrderStatus.CARGANDO },
    });

    // Audit log
    await logSalesStatusChange({
      entidad: 'loadOrder',
      entidadId: id,
      estadoAnterior: loadOrder.estado,
      estadoNuevo: LoadOrderStatus.CARGANDO,
      companyId: user!.companyId,
      userId: user!.id,
      notas: 'Proceso de carga iniciado',
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error starting load:', error);
    return NextResponse.json({ error: 'Error al iniciar carga' }, { status: 500 });
  }
}
