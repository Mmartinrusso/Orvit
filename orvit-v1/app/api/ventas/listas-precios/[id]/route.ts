import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

// GET - Obtener una lista de precios con sus items
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LISTAS_PRECIOS_VIEW);
    if (error) return error;

    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    try {
      const list = await (prisma as any).salesPriceList.findFirst({
        where: { id: listId, companyId: user!.companyId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  costPrice: true,
                  unit: true,
                  category: { select: { id: true, name: true } }
                }
              }
            },
            orderBy: { product: { name: 'asc' } }
          }
        }
      });

      if (!list) {
        return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
      }

      return NextResponse.json(list);
    } catch (error: any) {
      if (error.message?.includes('Unknown model')) {
        const lists = await prisma.$queryRaw`
          SELECT * FROM "sales_price_lists" WHERE id = ${listId} AND "companyId" = ${user!.companyId}
        ` as any[];

        if (lists.length === 0) {
          return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
        }

        const items = await prisma.$queryRaw`
          SELECT
            spli.*,
            p.code as "productCode",
            p.name as "productName",
            p."costPrice" as "productCostPrice",
            p.unit as "productUnit",
            c.name as "categoryName"
          FROM "sales_price_list_items" spli
          LEFT JOIN "Product" p ON p.id = spli."productId"
          LEFT JOIN "Category" c ON c.id = p."categoryId"
          WHERE spli."priceListId" = ${listId}
          ORDER BY p.name ASC
        ` as any[];

        return NextResponse.json({
          ...lists[0],
          items: items.map((i: any) => ({
            ...i,
            product: {
              id: i.productId,
              code: i.productCode,
              name: i.productName,
              costPrice: i.productCostPrice,
              unit: i.productUnit,
              category: { name: i.categoryName }
            }
          }))
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al obtener lista de precios:', error);
    return NextResponse.json(
      { error: 'Error al obtener lista de precios', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Actualizar una lista de precios
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LISTAS_PRECIOS_EDIT);
    if (error) return error;

    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { nombre, descripcion, moneda, porcentajeBase, esDefault, isActive, validFrom, validUntil } = body;

    try {
      // Verify the price list exists and belongs to the company
      const existing = await (prisma as any).salesPriceList.findFirst({
        where: { id: listId, companyId: user!.companyId }
      });

      if (!existing) {
        return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
      }

      // Use transaction to ensure atomicity when setting default flag
      const updated = await prisma.$transaction(async (tx: any) => {
        // Si se marca como default, quitar el default de las demás (dentro de la transacción)
        if (esDefault && !existing.esDefault) {
          await tx.salesPriceList.updateMany({
            where: { companyId: user!.companyId, esDefault: true, NOT: { id: listId } },
            data: { esDefault: false }
          });
        }

        return await tx.salesPriceList.update({
          where: { id: listId },
          data: {
            ...(nombre && { nombre: nombre.trim() }),
            ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
            ...(moneda && { moneda }),
            ...(porcentajeBase !== undefined && { porcentajeBase: porcentajeBase ? parseFloat(porcentajeBase) : null }),
            ...(esDefault !== undefined && { esDefault }),
            ...(isActive !== undefined && { isActive }),
            ...(validFrom !== undefined && { validFrom: validFrom ? new Date(validFrom) : null }),
            ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
          }
        });
      });

      return NextResponse.json(updated);
    } catch (error: any) {
      if (error.message?.includes('Unknown model')) {
        // Check if exists first
        const existing = await prisma.$queryRaw`
          SELECT * FROM "sales_price_lists" WHERE id = ${listId} AND "companyId" = ${user!.companyId}
        ` as any[];

        if (existing.length === 0) {
          return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
        }

        // Use transaction for atomicity
        await prisma.$transaction(async (tx: any) => {
          if (esDefault && !existing[0].esDefault) {
            await tx.$executeRaw`
              UPDATE "sales_price_lists" SET "esDefault" = false
              WHERE "companyId" = ${user!.companyId} AND "esDefault" = true AND id != ${listId}
            `;
          }

          await tx.$executeRaw`
            UPDATE "sales_price_lists" SET
              nombre = COALESCE(${nombre?.trim()}, nombre),
              descripcion = ${descripcion?.trim() || null},
              moneda = COALESCE(${moneda}, moneda),
              "porcentajeBase" = ${porcentajeBase ? parseFloat(porcentajeBase) : null},
              "esDefault" = COALESCE(${esDefault}, "esDefault"),
              "isActive" = COALESCE(${isActive}, "isActive"),
              "validFrom" = ${validFrom ? new Date(validFrom) : null},
              "validUntil" = ${validUntil ? new Date(validUntil) : null},
              "updatedAt" = NOW()
            WHERE id = ${listId} AND "companyId" = ${user!.companyId}
          `;
        });

        const updated = await prisma.$queryRaw`
          SELECT * FROM "sales_price_lists" WHERE id = ${listId}
        ` as any[];

        return NextResponse.json(updated[0]);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al actualizar lista de precios:', error);
    return NextResponse.json(
      { error: 'Error al actualizar lista de precios', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar una lista de precios
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LISTAS_PRECIOS_DELETE);
    if (error) return error;

    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    try {
      // Verificar que la lista existe y pertenece a la compañía
      const lista = await (prisma as any).salesPriceList.findFirst({
        where: { id: listId, companyId: user!.companyId }
      });

      if (!lista) {
        return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
      }

      // Verificar si hay clientes usando esta lista
      const clientsCount = await prisma.client.count({
        where: {
          companyId: user!.companyId,
          defaultPriceListId: listId,
        },
      });

      if (clientsCount > 0) {
        return NextResponse.json({
          error: 'No se puede eliminar la lista de precios',
          details: `Hay ${clientsCount} cliente(s) que tienen asignada esta lista como predeterminada. Primero debe cambiar la lista de precios de estos clientes.`,
          clientsCount,
        }, { status: 409 });
      }

      // Si no hay clientes usándola, eliminar
      await (prisma as any).salesPriceList.delete({
        where: { id: listId }
      });

      return NextResponse.json({ success: true, message: 'Lista eliminada correctamente' });
    } catch (error: any) {
      if (error.message?.includes('Unknown model')) {
        // Verificar si existe la lista
        const lista = await prisma.$queryRaw`
          SELECT * FROM "sales_price_lists" WHERE id = ${listId} AND "companyId" = ${user!.companyId}
        ` as any[];

        if (lista.length === 0) {
          return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
        }

        // Verificar clientes usando esta lista
        const clients = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "Client"
          WHERE "companyId" = ${user!.companyId} AND "defaultPriceListId" = ${listId}
        ` as any[];

        const clientsCount = parseInt(clients[0].count || '0');

        if (clientsCount > 0) {
          return NextResponse.json({
            error: 'No se puede eliminar la lista de precios',
            details: `Hay ${clientsCount} cliente(s) que tienen asignada esta lista como predeterminada. Primero debe cambiar la lista de precios de estos clientes.`,
            clientsCount,
          }, { status: 409 });
        }

        // Eliminar
        await prisma.$executeRaw`
          DELETE FROM "sales_price_lists" WHERE id = ${listId} AND "companyId" = ${user!.companyId}
        `;
        return NextResponse.json({ success: true, message: 'Lista eliminada correctamente' });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al eliminar lista de precios:', error);
    return NextResponse.json(
      { error: 'Error al eliminar lista de precios', details: error.message },
      { status: 500 }
    );
  }
}
