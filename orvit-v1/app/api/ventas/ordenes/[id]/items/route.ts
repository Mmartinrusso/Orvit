/**
 * POST /api/ventas/ordenes/[id]/items
 * Add item to existing sale order
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { Prisma } from '@prisma/client';
import { logDetailedAudit } from '@/lib/ventas/detailed-audit-logger';

export const dynamic = 'force-dynamic';

interface AddItemRequest {
  productId?: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  descuento?: number;
  notas?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    const saleId = parseInt(params.id);
    const companyId = user!.companyId;
    const body: AddItemRequest = await request.json();

    // Validate sale exists and is editable
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, companyId },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    if (!['BORRADOR', 'CONFIRMADA', 'EN_PREPARACION'].includes(sale.estado)) {
      return NextResponse.json(
        { error: 'No se pueden agregar items en este estado' },
        { status: 400 }
      );
    }

    // Calculate subtotal
    const cantidad = new Prisma.Decimal(body.cantidad);
    const precioUnitario = new Prisma.Decimal(body.precioUnitario);
    const descuento = new Prisma.Decimal(body.descuento || 0);

    const subtotal = precioUnitario
      .mul(cantidad)
      .mul(new Prisma.Decimal(1).minus(descuento.div(100)));

    // Create item
    const newItem = await prisma.$transaction(async (tx) => {
      const item = await tx.saleItem.create({
        data: {
          saleId,
          productId: body.productId,
          codigo: body.codigo,
          descripcion: body.descripcion,
          cantidad,
          unidad: body.unidad,
          precioUnitario,
          descuento,
          subtotal,
          notas: body.notas,
        },
      });

      // Recalculate sale totals
      const items = await tx.saleItem.findMany({
        where: { saleId },
      });

      const newSubtotal = items.reduce(
        (sum, i) => sum.plus(i.subtotal),
        new Prisma.Decimal(0)
      );

      const newImpuestos = newSubtotal.mul(sale.tasaIva.div(100));
      const newTotal = newSubtotal.plus(newImpuestos);

      await tx.sale.update({
        where: { id: saleId },
        data: {
          subtotal: newSubtotal,
          impuestos: newImpuestos,
          total: newTotal,
        },
      });

      return item;
    });

    // Audit log
    await logDetailedAudit({
      entityType: 'sale_item',
      entityId: newItem.id,
      action: 'CREATE',
      userId: user!.id,
      companyId,
      reason: `Item agregado a orden ${sale.numero}`,
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error('[ADD-ITEM] Error:', error);
    return NextResponse.json({ error: 'Error al agregar item' }, { status: 500 });
  }
}
