import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { priceListItemSchema } from '@/lib/ventas/validation-schemas';
import { logSalePriceChange } from '@/lib/ventas/price-change-alerts';

// GET - Obtener items de una lista de precios
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
      const items = await (prisma as any).salesPriceListItem.findMany({
        where: { priceListId: listId },
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
      });

      return NextResponse.json(items || []);
    } catch (error: any) {
      if (error.message?.includes('Unknown model')) {
        const items = await prisma.$queryRaw`
          SELECT
            spli.*,
            p.id as "productId",
            p.code as "productCode",
            p.name as "productName",
            p."costPrice" as "productCostPrice",
            p.unit as "productUnit",
            c.id as "categoryId",
            c.name as "categoryName"
          FROM "sales_price_list_items" spli
          LEFT JOIN "Product" p ON p.id = spli."productId"
          LEFT JOIN "Category" c ON c.id = p."categoryId"
          WHERE spli."priceListId" = ${listId}
          ORDER BY p.name ASC
        ` as any[];

        return NextResponse.json(items.map((i: any) => ({
          id: i.id,
          priceListId: i.priceListId,
          productId: i.productId,
          precioUnitario: i.precioUnitario,
          porcentaje: i.porcentaje,
          product: {
            id: i.productId,
            code: i.productCode,
            name: i.productName,
            costPrice: parseFloat(i.productCostPrice) || 0,
            unit: i.productUnit,
            category: { id: i.categoryId, name: i.categoryName }
          }
        })));
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al obtener items:', error);
    return NextResponse.json(
      { error: 'Error al obtener items', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Agregar item a una lista de precios
export async function POST(
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

    // Validate request body with Zod
    const validation = priceListItemSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    const { productId, precioUnitario, porcentaje } = validation.data;

    try {
      // Verificar si ya existe el producto en la lista
      const existing = await (prisma as any).salesPriceListItem.findFirst({
        where: { priceListId: listId, productId }
      });

      if (existing) {
        const oldPrice = parseFloat(existing.precioUnitario);
        const newPriceValue = parseFloat(precioUnitario);

        // Actualizar precio existente
        const updated = await (prisma as any).salesPriceListItem.update({
          where: { id: existing.id },
          data: {
            precioUnitario: newPriceValue,
            porcentaje: porcentaje ? parseFloat(porcentaje) : null
          },
          include: {
            product: {
              select: { id: true, code: true, name: true, costPrice: true, unit: true }
            }
          }
        });

        // Log price change
        if (oldPrice !== newPriceValue) {
          await logSalePriceChange({
            productId,
            companyId: user!.companyId,
            previousPrice: oldPrice,
            newPrice: newPriceValue,
            salesPriceListId: listId,
            changeSource: 'PRICE_LIST',
            createdById: user!.id,
          });
        }

        return NextResponse.json(updated);
      }

      const item = await (prisma as any).salesPriceListItem.create({
        data: {
          priceListId: listId,
          productId,
          precioUnitario: parseFloat(precioUnitario),
          porcentaje: porcentaje ? parseFloat(porcentaje) : null
        },
        include: {
          product: {
            select: { id: true, code: true, name: true, costPrice: true, unit: true }
          }
        }
      });

      return NextResponse.json(item, { status: 201 });
    } catch (error: any) {
      if (error.message?.includes('Unknown model')) {
        // Check if exists
        const existing = await prisma.$queryRaw`
          SELECT id FROM "sales_price_list_items"
          WHERE "priceListId" = ${listId} AND "productId" = ${productId}
        ` as any[];

        if (existing.length > 0) {
          // Get old price before update
          const oldItem = await prisma.$queryRaw`
            SELECT "precioUnitario" FROM "sales_price_list_items" WHERE id = ${existing[0].id}
          ` as any[];
          const oldPrice = oldItem.length > 0 ? parseFloat(oldItem[0].precioUnitario) : null;
          const newPriceValue = parseFloat(precioUnitario);

          await prisma.$executeRaw`
            UPDATE "sales_price_list_items" SET
              "precioUnitario" = ${newPriceValue},
              "porcentaje" = ${porcentaje ? parseFloat(porcentaje) : null}
            WHERE id = ${existing[0].id}
          `;

          // Log price change
          if (oldPrice !== null && oldPrice !== newPriceValue) {
            await logSalePriceChange({
              productId,
              companyId: user!.companyId,
              previousPrice: oldPrice,
              newPrice: newPriceValue,
              salesPriceListId: listId,
              changeSource: 'PRICE_LIST',
              createdById: user!.id,
            });
          }

          const updated = await prisma.$queryRaw`
            SELECT spli.*, p.code as "productCode", p.name as "productName", p."costPrice" as "productCostPrice"
            FROM "sales_price_list_items" spli
            LEFT JOIN "Product" p ON p.id = spli."productId"
            WHERE spli.id = ${existing[0].id}
          ` as any[];

          return NextResponse.json({
            ...updated[0],
            product: {
              id: updated[0].productId,
              code: updated[0].productCode,
              name: updated[0].productName,
              costPrice: parseFloat(updated[0].productCostPrice) || 0
            }
          });
        }

        await prisma.$executeRaw`
          INSERT INTO "sales_price_list_items" ("priceListId", "productId", "precioUnitario", "porcentaje")
          VALUES (${listId}, ${productId}, ${parseFloat(precioUnitario)}, ${porcentaje ? parseFloat(porcentaje) : null})
        `;

        const created = await prisma.$queryRaw`
          SELECT spli.*, p.code as "productCode", p.name as "productName", p."costPrice" as "productCostPrice"
          FROM "sales_price_list_items" spli
          LEFT JOIN "Product" p ON p.id = spli."productId"
          WHERE spli."priceListId" = ${listId} AND spli."productId" = ${productId}
        ` as any[];

        return NextResponse.json({
          ...created[0],
          product: {
            id: created[0].productId,
            code: created[0].productCode,
            name: created[0].productName,
            costPrice: parseFloat(created[0].productCostPrice) || 0
          }
        }, { status: 201 });
      }

      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'El producto ya está en la lista' },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al agregar item:', error);
    return NextResponse.json(
      { error: 'Error al agregar item', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar item de una lista de precios
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LISTAS_PRECIOS_EDIT);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json({ error: 'itemId es requerido' }, { status: 400 });
    }

    try {
      await (prisma as any).salesPriceListItem.delete({
        where: { id: parseInt(itemId) }
      });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('Unknown model')) {
        await prisma.$executeRaw`
          DELETE FROM "sales_price_list_items" WHERE id = ${parseInt(itemId)}
        `;
        return NextResponse.json({ success: true });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al eliminar item:', error);
    return NextResponse.json(
      { error: 'Error al eliminar item', details: error.message },
      { status: 500 }
    );
  }
}
