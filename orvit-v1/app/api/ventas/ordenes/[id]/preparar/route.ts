import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// POST - Iniciar preparación de orden de venta (CONFIRMADA → EN_PREPARACION)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    const companyId = user!.companyId;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe
    const orden = await prisma.sale.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true }
            }
          }
        },
        client: {
          select: { id: true, legalName: true }
        }
      }
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de venta no encontrada' }, { status: 404 });
    }

    // Solo se pueden pasar a preparación órdenes CONFIRMADAS
    if (orden.estado !== 'CONFIRMADA') {
      return NextResponse.json(
        { error: `No se puede iniciar preparación de una orden en estado ${orden.estado}. Debe estar en estado CONFIRMADA.` },
        { status: 400 }
      );
    }

    // Iniciar preparación
    const ordenEnPreparacion = await prisma.sale.update({
      where: { id },
      data: {
        estado: 'EN_PREPARACION',
        fechaPreparacion: new Date(),
      }
    });

    // Registrar auditoría
    await logSalesStatusChange({
      entidad: 'sale',
      entidadId: id,
      estadoAnterior: 'CONFIRMADA',
      estadoNuevo: 'EN_PREPARACION',
      companyId,
      userId: user!.id,
    });

    return NextResponse.json({
      message: 'Preparación de orden iniciada correctamente',
      orden: ordenEnPreparacion
    });
  } catch (error) {
    console.error('Error iniciando preparación de orden:', error);
    return NextResponse.json(
      { error: 'Error al iniciar la preparación de la orden' },
      { status: 500 }
    );
  }
}
