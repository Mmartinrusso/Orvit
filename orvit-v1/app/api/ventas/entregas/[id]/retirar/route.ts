import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, DeliveryStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * POST - Marcar entrega como retirada (pickup por cliente)
 * Transición: LISTA_PARA_DESPACHO → RETIRADA
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
      toState: DeliveryStatus.RETIRADA,
      userId: user!.id,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Validar que sea tipo RETIRO
    if (delivery.tipo !== 'RETIRO') {
      return NextResponse.json(
        { error: 'Solo entregas tipo RETIRO pueden marcarse como retiradas' },
        { status: 400 }
      );
    }

    // Requiere identificación de quien retira
    if (!body.recibeNombre && !body.recibeDNI) {
      return NextResponse.json(
        { error: 'Debe especificar quien retira (nombre y/o DNI)' },
        { status: 400 }
      );
    }

    // Preparar datos de actualización
    const updateData: any = {
      estado: DeliveryStatus.RETIRADA,
      fechaEntrega: new Date(), // Fecha de retiro
    };

    // Capturar datos de quien retira
    if (body.recibeNombre) {
      updateData.recibeNombre = body.recibeNombre;
    }

    if (body.recibeDNI) {
      updateData.recibeDNI = body.recibeDNI;
    }

    // Capturar firma si se provee
    if (body.firmaCliente) {
      updateData.firmaRecepcion = body.firmaCliente;
    }

    // Agregar nota sobre el retiro
    if (body.notas) {
      const timestamp = new Date().toLocaleString('es-AR');
      const notasActuales = delivery.notas || '';
      updateData.notas = `[${timestamp}] RETIRADA - ${body.notas}\n\n${notasActuales}`.trim();
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
      estadoNuevo: DeliveryStatus.RETIRADA,
      companyId: user!.companyId,
      userId: user!.id,
      notas: `Retirado por: ${body.recibeNombre || body.recibeDNI}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error marking delivery as picked up:', error);
    return NextResponse.json({ error: 'Error al marcar entrega como retirada' }, { status: 500 });
  }
}
