import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { liquidacionActionSchema } from '@/lib/ventas/validation-schemas';

export const dynamic = 'force-dynamic';

// POST - Ejecutar acción sobre liquidación (confirmar, pagar, anular)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const liquidacionId = parseInt(id);
    if (isNaN(liquidacionId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const validation = liquidacionActionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { action, medioPago, referenciaPago } = validation.data;

    // Verificar permisos según acción
    let permiso: string;
    switch (action) {
      case 'confirmar':
        permiso = VENTAS_PERMISSIONS.LIQUIDACIONES_CONFIRM;
        break;
      case 'pagar':
        permiso = VENTAS_PERMISSIONS.LIQUIDACIONES_PAY;
        break;
      case 'anular':
        permiso = VENTAS_PERMISSIONS.LIQUIDACIONES_EDIT;
        break;
      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    const { user, error } = await requirePermission(permiso);
    if (error) return error;

    const companyId = user!.companyId;

    const liquidacion = await prisma.sellerLiquidacion.findFirst({
      where: { id: liquidacionId, companyId },
      include: { items: true },
    });

    if (!liquidacion) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    // Máquina de estados
    switch (action) {
      case 'confirmar': {
        if (liquidacion.estado !== 'BORRADOR') {
          return NextResponse.json(
            { error: 'Solo se pueden confirmar liquidaciones en BORRADOR' },
            { status: 400 }
          );
        }

        const updated = await prisma.sellerLiquidacion.update({
          where: { id: liquidacionId },
          data: {
            estado: 'CONFIRMADA',
            confirmadoPor: user!.id,
            confirmadoAt: new Date(),
          },
        });

        return NextResponse.json({ message: 'Liquidación confirmada', liquidacion: updated });
      }

      case 'pagar': {
        if (liquidacion.estado !== 'CONFIRMADA') {
          return NextResponse.json(
            { error: 'Solo se pueden pagar liquidaciones CONFIRMADAS' },
            { status: 400 }
          );
        }

        const updated = await prisma.$transaction(async (tx) => {
          const liq = await tx.sellerLiquidacion.update({
            where: { id: liquidacionId },
            data: {
              estado: 'PAGADA',
              pagadoPor: user!.id,
              pagadoAt: new Date(),
              medioPago: medioPago || null,
              referenciaPago: referenciaPago || null,
            },
          });

          // Marcar comisiones como pagadas en cada venta incluida
          const saleIds = liquidacion.items
            .filter(i => i.incluido)
            .map(i => i.saleId);

          if (saleIds.length > 0) {
            await tx.sale.updateMany({
              where: { id: { in: saleIds } },
              data: {
                comisionPagada: true,
                comisionPagadaAt: new Date(),
              },
            });
          }

          return liq;
        });

        return NextResponse.json({ message: 'Liquidación pagada', liquidacion: updated });
      }

      case 'anular': {
        if (!['BORRADOR', 'CONFIRMADA'].includes(liquidacion.estado)) {
          return NextResponse.json(
            { error: 'Solo se pueden anular liquidaciones en BORRADOR o CONFIRMADAS' },
            { status: 400 }
          );
        }

        const updated = await prisma.sellerLiquidacion.update({
          where: { id: liquidacionId },
          data: { estado: 'ANULADA' },
        });

        return NextResponse.json({ message: 'Liquidación anulada', liquidacion: updated });
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error en acción de liquidación:', error);
    return NextResponse.json(
      { error: 'Error al ejecutar la acción' },
      { status: 500 }
    );
  }
}
