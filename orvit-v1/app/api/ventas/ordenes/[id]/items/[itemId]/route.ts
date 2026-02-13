/**
 * PUT /api/ventas/ordenes/[id]/items/[itemId] - Update specific item
 * DELETE /api/ventas/ordenes/[id]/items/[itemId] - Delete specific item
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { Prisma } from '@prisma/client';
import { logDetailedAudit, generateFieldChanges } from '@/lib/ventas/detailed-audit-logger';

export const dynamic = 'force-dynamic';

// UPDATE item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    const saleId = parseInt(params.id);
    const itemId = parseInt(params.itemId);
    const companyId = user!.companyId;
    const body = await request.json();

    // Get original item
    const originalItem = await prisma.saleItem.findFirst({
      where: { id: itemId, saleId },
      include: { sale: { select: { companyId: true, estado: true, numero: true } } },
    });

    if (!originalItem || originalItem.sale.companyId !== companyId) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
    }

    if (!['BORRADOR', 'CONFIRMADA', 'EN_PREPARACION'].includes(originalItem.sale.estado)) {
      return NextResponse.json(
        { error: 'No se pueden modificar items en este estado' },
        { status: 400 }
      );
    }

    // Calculate new subtotal if quantities/prices changed
    const cantidad = body.cantidad !== undefined
      ? new Prisma.Decimal(body.cantidad)
      : originalItem.cantidad;
    const precioUnitario = body.precioUnitario !== undefined
      ? new Prisma.Decimal(body.precioUnitario)
      : originalItem.precioUnitario;
    const descuento = body.descuento !== undefined
      ? new Prisma.Decimal(body.descuento)
      : originalItem.descuento;

    const subtotal = precioUnitario
      .mul(cantidad)
      .mul(new Prisma.Decimal(1).minus(descuento.div(100)));

    // Update item and recalculate totals
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.saleItem.update({
        where: { id: itemId },
        data: {
          ...(body.cantidad !== undefined && { cantidad }),
          ...(body.precioUnitario !== undefined && { precioUnitario }),
          ...(body.descuento !== undefined && { descuento }),
          ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
          ...(body.notas !== undefined && { notas: body.notas }),
          subtotal,
        },
      });

      // Recalculate sale totals
      const allItems = await tx.saleItem.findMany({ where: { saleId } });
      const newSubtotal = allItems.reduce((sum, i) => sum.plus(i.subtotal), new Prisma.Decimal(0));
      const sale = await tx.sale.findUnique({ where: { id: saleId } });
      const newImpuestos = newSubtotal.mul(sale!.tasaIva.div(100));
      const newTotal = newSubtotal.plus(newImpuestos);

      await tx.sale.update({
        where: { id: saleId },
        data: { subtotal: newSubtotal, impuestos: newImpuestos, total: newTotal },
      });

      return item;
    });

    // Audit log with changes
    const changes = generateFieldChanges(originalItem, updated as any, [
      'cantidad',
      'precioUnitario',
      'descuento',
      'descripcion',
      'subtotal',
    ]);

    await logDetailedAudit({
      entityType: 'sale_item',
      entityId: itemId,
      action: 'UPDATE',
      userId: user!.id,
      companyId,
      changes,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[UPDATE-ITEM] Error:', error);
    return NextResponse.json({ error: 'Error al actualizar item' }, { status: 500 });
  }
}

// DELETE item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    const saleId = parseInt(params.id);
    const itemId = parseInt(params.itemId);
    const companyId = user!.companyId;

    // Verify item exists and belongs to sale
    const item = await prisma.saleItem.findFirst({
      where: { id: itemId, saleId },
      include: { sale: { select: { companyId: true, estado: true, numero: true } } },
    });

    if (!item || item.sale.companyId !== companyId) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
    }

    if (!['BORRADOR', 'CONFIRMADA', 'EN_PREPARACION'].includes(item.sale.estado)) {
      return NextResponse.json(
        { error: 'No se pueden eliminar items en este estado' },
        { status: 400 }
      );
    }

    // Delete and recalculate
    await prisma.$transaction(async (tx) => {
      await tx.saleItem.delete({ where: { id: itemId } });

      // Recalculate totals
      const remainingItems = await tx.saleItem.findMany({ where: { saleId } });

      if (remainingItems.length === 0) {
        // No items left - set totals to 0
        await tx.sale.update({
          where: { id: saleId },
          data: {
            subtotal: new Prisma.Decimal(0),
            impuestos: new Prisma.Decimal(0),
            total: new Prisma.Decimal(0),
          },
        });
      } else {
        const newSubtotal = remainingItems.reduce(
          (sum, i) => sum.plus(i.subtotal),
          new Prisma.Decimal(0)
        );
        const sale = await tx.sale.findUnique({ where: { id: saleId } });
        const newImpuestos = newSubtotal.mul(sale!.tasaIva.div(100));
        const newTotal = newSubtotal.plus(newImpuestos);

        await tx.sale.update({
          where: { id: saleId },
          data: { subtotal: newSubtotal, impuestos: newImpuestos, total: newTotal },
        });
      }
    });

    // Audit log
    await logDetailedAudit({
      entityType: 'sale_item',
      entityId: itemId,
      action: 'DELETE',
      userId: user!.id,
      companyId,
      reason: `Item eliminado de orden ${item.sale.numero}`,
    });

    return NextResponse.json({ message: 'Item eliminado exitosamente' });
  } catch (error) {
    console.error('[DELETE-ITEM] Error:', error);
    return NextResponse.json({ error: 'Error al eliminar item' }, { status: 500 });
  }
}
