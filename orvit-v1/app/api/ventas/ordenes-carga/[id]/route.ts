import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * GET - Obtener detalle de orden de carga
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    // Fetch load order with all related data
    const loadOrder = await prisma.loadOrder.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                codigo: true,
                unidadMedida: true,
              },
            },
            saleItem: {
              select: {
                id: true,
                cantidad: true,
                precioUnitario: true,
                unidadMedida: true,
              },
            },
          },
          orderBy: { secuencia: 'asc' },
        },
        sale: {
          include: {
            client: {
              select: {
                id: true,
                legalName: true,
                name: true,
                address: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        delivery: {
          select: {
            id: true,
            numero: true,
            estado: true,
            tipo: true,
            fechaProgramada: true,
            fechaEntrega: true,
            direccionEntrega: true,
          },
        },
        confirmedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!loadOrder) {
      return NextResponse.json({ error: 'Orden de carga no encontrada' }, { status: 404 });
    }

    return NextResponse.json(loadOrder);
  } catch (error) {
    console.error('Error fetching load order:', error);
    return NextResponse.json(
      { error: 'Error al obtener orden de carga' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Actualizar orden de carga (solo PENDIENTE)
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);
    const body = await request.json();

    // Verify load order exists and is editable
    const loadOrder = await prisma.loadOrder.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
    });

    if (!loadOrder) {
      return NextResponse.json({ error: 'Orden de carga no encontrada' }, { status: 404 });
    }

    if (loadOrder.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { error: 'Solo se pueden editar órdenes en estado PENDIENTE' },
        { status: 400 }
      );
    }

    // Update basic fields
    const updateData: any = {};
    if (body.vehiculo !== undefined) updateData.vehiculo = body.vehiculo;
    if (body.vehiculoPatente !== undefined) updateData.vehiculoPatente = body.vehiculoPatente;
    if (body.chofer !== undefined) updateData.chofer = body.chofer;
    if (body.choferDNI !== undefined) updateData.choferDNI = body.choferDNI;
    if (body.transportista !== undefined) updateData.transportista = body.transportista;
    if (body.observaciones !== undefined) updateData.observaciones = body.observaciones;

    const updated = await prisma.loadOrder.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating load order:', error);
    return NextResponse.json(
      { error: 'Error al actualizar orden de carga' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Eliminar orden de carga (solo PENDIENTE y no confirmadas)
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_DELETE);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    // Verify load order exists and is deletable
    const loadOrder = await prisma.loadOrder.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
    });

    if (!loadOrder) {
      return NextResponse.json({ error: 'Orden de carga no encontrada' }, { status: 404 });
    }

    if (loadOrder.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar órdenes en estado PENDIENTE' },
        { status: 400 }
      );
    }

    if (loadOrder.confirmadoAt) {
      return NextResponse.json(
        { error: 'No se puede eliminar una orden confirmada' },
        { status: 400 }
      );
    }

    // Delete (will cascade to items)
    await prisma.loadOrder.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Orden de carga eliminada' });
  } catch (error) {
    console.error('Error deleting load order:', error);
    return NextResponse.json(
      { error: 'Error al eliminar orden de carga' },
      { status: 500 }
    );
  }
}
