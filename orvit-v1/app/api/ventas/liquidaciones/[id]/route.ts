import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Detalle de liquidación con items y desglose
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LIQUIDACIONES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { id } = await params;
    const liquidacionId = parseInt(id);
    if (isNaN(liquidacionId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const liquidacion = await prisma.sellerLiquidacion.findFirst({
      where: { id: liquidacionId, companyId },
      include: {
        seller: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true } },
        confirmadoByUser: { select: { id: true, name: true } },
        pagadoByUser: { select: { id: true, name: true } },
        items: {
          include: {
            sale: {
              select: {
                id: true,
                numero: true,
                estado: true,
                fechaEmision: true,
                total: true,
                client: { select: { id: true, legalName: true } },
                invoices: {
                  select: {
                    id: true,
                    numeroCompleto: true,
                    estado: true,
                    total: true,
                    saldoPendiente: true,
                    fechaEmision: true,
                    fechaVencimiento: true,
                  },
                },
                items: {
                  select: {
                    id: true,
                    descripcion: true,
                    cantidad: true,
                    precioUnitario: true,
                    subtotal: true,
                    costBreakdown: {
                      select: { id: true, concepto: true, monto: true, orden: true },
                      orderBy: { orden: 'asc' as const },
                    },
                  },
                },
              },
            },
          },
          orderBy: { fechaVenta: 'asc' },
        },
      },
    });

    if (!liquidacion) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    return NextResponse.json(liquidacion);
  } catch (error) {
    console.error('Error fetching liquidación:', error);
    return NextResponse.json({ error: 'Error al obtener la liquidación' }, { status: 500 });
  }
}

// PATCH - Editar liquidación (solo BORRADOR)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LIQUIDACIONES_EDIT);
    if (error) return error;

    const companyId = user!.companyId;
    const { id } = await params;
    const liquidacionId = parseInt(id);
    if (isNaN(liquidacionId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.sellerLiquidacion.findFirst({
      where: { id: liquidacionId, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    if (existing.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden editar liquidaciones en BORRADOR' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { ajustes, notas, notasInternas } = body;

    const updated = await prisma.sellerLiquidacion.update({
      where: { id: liquidacionId },
      data: {
        ...(ajustes !== undefined && {
          ajustes: parseFloat(String(ajustes)),
          totalLiquidacion: Number(existing.totalComisiones) + parseFloat(String(ajustes)),
        }),
        ...(notas !== undefined && { notas }),
        ...(notasInternas !== undefined && { notasInternas }),
      },
      include: {
        seller: { select: { id: true, name: true } },
        items: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating liquidación:', error);
    return NextResponse.json({ error: 'Error al actualizar la liquidación' }, { status: 500 });
  }
}

// DELETE - Eliminar liquidación (solo BORRADOR)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LIQUIDACIONES_DELETE);
    if (error) return error;

    const companyId = user!.companyId;
    const { id } = await params;
    const liquidacionId = parseInt(id);
    if (isNaN(liquidacionId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.sellerLiquidacion.findFirst({
      where: { id: liquidacionId, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    if (existing.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar liquidaciones en BORRADOR' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.sellerLiquidacionItem.deleteMany({ where: { liquidacionId } });
      await tx.sellerLiquidacion.delete({ where: { id: liquidacionId } });
    });

    return NextResponse.json({ message: 'Liquidación eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting liquidación:', error);
    return NextResponse.json({ error: 'Error al eliminar la liquidación' }, { status: 500 });
  }
}
