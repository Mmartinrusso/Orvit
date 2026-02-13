import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schemas de validación
const bulkAddItemsSchema = z.object({
  priceListId: z.number(),
  items: z.array(z.object({
    productId: z.string(),
    precioUnitario: z.number().nonnegative(),
    porcentaje: z.number().optional().nullable(),
  })).min(1, 'Debe incluir al menos un item'),
});

const bulkUpdatePricesSchema = z.object({
  priceListId: z.number(),
  operation: z.enum(['INCREASE', 'DECREASE', 'SET']),
  value: z.number(),
  isPercentage: z.boolean().default(true),
  productIds: z.array(z.string()).optional(), // Si no se provee, aplica a todos
});

const bulkDeleteItemsSchema = z.object({
  priceListId: z.number(),
  itemIds: z.array(z.number()).min(1, 'Debe incluir al menos un item'),
});

const bulkCopyFromListSchema = z.object({
  sourcePriceListId: z.number(),
  targetPriceListId: z.number(),
  overwriteExisting: z.boolean().default(false),
  applyAdjustment: z.boolean().default(false),
  adjustmentPercentage: z.number().optional(),
});

// POST - Operaciones bulk
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LISTAS_PRECIOS_EDIT);
    if (error) return error;

    const body = await request.json();
    const { operation } = body;

    if (!operation) {
      return NextResponse.json({ error: 'Operation es requerida' }, { status: 400 });
    }

    // OPERACIÓN 1: Agregar múltiples items
    if (operation === 'ADD_ITEMS') {
      const validation = bulkAddItemsSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Datos inválidos',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }, { status: 400 });
      }

      const { priceListId, items } = validation.data;

      // Verificar que la lista existe y pertenece a la compañía
      try {
        const lista = await (prisma as any).salesPriceList.findFirst({
          where: { id: priceListId, companyId: user!.companyId }
        });

        if (!lista) {
          return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
        }

        // Insertar items (usar upsert para evitar duplicados)
        const results = await Promise.all(
          items.map(async (item) => {
            return await (prisma as any).salesPriceListItem.upsert({
              where: {
                priceListId_productId: {
                  priceListId,
                  productId: item.productId,
                }
              },
              update: {
                precioUnitario: item.precioUnitario,
                porcentaje: item.porcentaje,
              },
              create: {
                priceListId,
                productId: item.productId,
                precioUnitario: item.precioUnitario,
                porcentaje: item.porcentaje,
              },
            });
          })
        );

        return NextResponse.json({
          success: true,
          added: results.length,
          message: `${results.length} productos agregados/actualizados`
        });
      } catch (error: any) {
        if (error.message?.includes('Unknown model')) {
          // Fallback con raw SQL
          const lista = await prisma.$queryRaw`
            SELECT * FROM "sales_price_lists" WHERE id = ${priceListId} AND "companyId" = ${user!.companyId}
          ` as any[];

          if (lista.length === 0) {
            return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
          }

          let added = 0;
          for (const item of items) {
            // Check if exists
            const existing = await prisma.$queryRaw`
              SELECT id FROM "sales_price_list_items"
              WHERE "priceListId" = ${priceListId} AND "productId" = ${item.productId}
            ` as any[];

            if (existing.length > 0) {
              await prisma.$executeRaw`
                UPDATE "sales_price_list_items" SET
                  "precioUnitario" = ${item.precioUnitario},
                  "porcentaje" = ${item.porcentaje}
                WHERE id = ${existing[0].id}
              `;
            } else {
              await prisma.$executeRaw`
                INSERT INTO "sales_price_list_items" ("priceListId", "productId", "precioUnitario", "porcentaje")
                VALUES (${priceListId}, ${item.productId}, ${item.precioUnitario}, ${item.porcentaje})
              `;
            }
            added++;
          }

          return NextResponse.json({
            success: true,
            added,
            message: `${added} productos agregados/actualizados`
          });
        }
        throw error;
      }
    }

    // OPERACIÓN 2: Actualizar precios masivamente
    if (operation === 'UPDATE_PRICES') {
      const validation = bulkUpdatePricesSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Datos inválidos',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }, { status: 400 });
      }

      const { priceListId, operation: op, value, isPercentage, productIds } = validation.data;

      try {
        // Verificar lista
        const lista = await (prisma as any).salesPriceList.findFirst({
          where: { id: priceListId, companyId: user!.companyId }
        });

        if (!lista) {
          return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
        }

        // Construir where
        const where: any = { priceListId };
        if (productIds && productIds.length > 0) {
          where.productId = { in: productIds };
        }

        // Obtener items a actualizar
        const items = await (prisma as any).salesPriceListItem.findMany({ where });

        // Calcular nuevos precios
        const updates = items.map((item: any) => {
          let nuevoPrecio = item.precioUnitario;

          if (op === 'INCREASE') {
            if (isPercentage) {
              nuevoPrecio = item.precioUnitario * (1 + value / 100);
            } else {
              nuevoPrecio = item.precioUnitario + value;
            }
          } else if (op === 'DECREASE') {
            if (isPercentage) {
              nuevoPrecio = item.precioUnitario * (1 - value / 100);
            } else {
              nuevoPrecio = item.precioUnitario - value;
            }
          } else if (op === 'SET') {
            nuevoPrecio = value;
          }

          // No permitir precios negativos
          nuevoPrecio = Math.max(0, nuevoPrecio);

          return {
            id: item.id,
            nuevoPrecio: parseFloat(nuevoPrecio.toFixed(2)),
          };
        });

        // Aplicar actualizaciones
        await Promise.all(
          updates.map(async (u) => {
            return await (prisma as any).salesPriceListItem.update({
              where: { id: u.id },
              data: { precioUnitario: u.nuevoPrecio },
            });
          })
        );

        return NextResponse.json({
          success: true,
          updated: updates.length,
          message: `${updates.length} precios actualizados`
        });
      } catch (error: any) {
        if (error.message?.includes('Unknown model')) {
          // Fallback con raw SQL
          const lista = await prisma.$queryRaw`
            SELECT * FROM "sales_price_lists" WHERE id = ${priceListId} AND "companyId" = ${user!.companyId}
          ` as any[];

          if (lista.length === 0) {
            return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
          }

          let query = `SELECT * FROM "sales_price_list_items" WHERE "priceListId" = ${priceListId}`;
          if (productIds && productIds.length > 0) {
            const productIdsStr = productIds.map(id => `'${id}'`).join(',');
            query += ` AND "productId" IN (${productIdsStr})`;
          }

          const items = await prisma.$queryRaw(prisma.$queryRawUnsafe(query)) as any[];

          let updated = 0;
          for (const item of items) {
            let nuevoPrecio = parseFloat(item.precioUnitario);

            if (op === 'INCREASE') {
              nuevoPrecio = isPercentage ? nuevoPrecio * (1 + value / 100) : nuevoPrecio + value;
            } else if (op === 'DECREASE') {
              nuevoPrecio = isPercentage ? nuevoPrecio * (1 - value / 100) : nuevoPrecio - value;
            } else if (op === 'SET') {
              nuevoPrecio = value;
            }

            nuevoPrecio = Math.max(0, parseFloat(nuevoPrecio.toFixed(2)));

            await prisma.$executeRaw`
              UPDATE "sales_price_list_items" SET "precioUnitario" = ${nuevoPrecio}
              WHERE id = ${item.id}
            `;
            updated++;
          }

          return NextResponse.json({
            success: true,
            updated,
            message: `${updated} precios actualizados`
          });
        }
        throw error;
      }
    }

    // OPERACIÓN 3: Eliminar múltiples items
    if (operation === 'DELETE_ITEMS') {
      const validation = bulkDeleteItemsSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Datos inválidos',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }, { status: 400 });
      }

      const { priceListId, itemIds } = validation.data;

      try {
        // Verificar lista
        const lista = await (prisma as any).salesPriceList.findFirst({
          where: { id: priceListId, companyId: user!.companyId }
        });

        if (!lista) {
          return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
        }

        const result = await (prisma as any).salesPriceListItem.deleteMany({
          where: {
            id: { in: itemIds },
            priceListId,
          },
        });

        return NextResponse.json({
          success: true,
          deleted: result.count,
          message: `${result.count} items eliminados`
        });
      } catch (error: any) {
        if (error.message?.includes('Unknown model')) {
          const lista = await prisma.$queryRaw`
            SELECT * FROM "sales_price_lists" WHERE id = ${priceListId} AND "companyId" = ${user!.companyId}
          ` as any[];

          if (lista.length === 0) {
            return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
          }

          let deleted = 0;
          for (const itemId of itemIds) {
            await prisma.$executeRaw`
              DELETE FROM "sales_price_list_items"
              WHERE id = ${itemId} AND "priceListId" = ${priceListId}
            `;
            deleted++;
          }

          return NextResponse.json({
            success: true,
            deleted,
            message: `${deleted} items eliminados`
          });
        }
        throw error;
      }
    }

    // OPERACIÓN 4: Copiar items de otra lista
    if (operation === 'COPY_FROM_LIST') {
      const validation = bulkCopyFromListSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Datos inválidos',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }, { status: 400 });
      }

      const { sourcePriceListId, targetPriceListId, overwriteExisting, applyAdjustment, adjustmentPercentage } = validation.data;

      try {
        // Verificar ambas listas
        const [source, target] = await Promise.all([
          (prisma as any).salesPriceList.findFirst({ where: { id: sourcePriceListId, companyId: user!.companyId } }),
          (prisma as any).salesPriceList.findFirst({ where: { id: targetPriceListId, companyId: user!.companyId } }),
        ]);

        if (!source) {
          return NextResponse.json({ error: 'Lista origen no encontrada' }, { status: 404 });
        }
        if (!target) {
          return NextResponse.json({ error: 'Lista destino no encontrada' }, { status: 404 });
        }

        // Obtener items de la lista origen
        const sourceItems = await (prisma as any).salesPriceListItem.findMany({
          where: { priceListId: sourcePriceListId },
        });

        let copied = 0;
        for (const item of sourceItems) {
          let precio = item.precioUnitario;

          // Aplicar ajuste si se solicita
          if (applyAdjustment && adjustmentPercentage) {
            precio = precio * (1 + adjustmentPercentage / 100);
            precio = parseFloat(precio.toFixed(2));
          }

          if (overwriteExisting) {
            await (prisma as any).salesPriceListItem.upsert({
              where: {
                priceListId_productId: {
                  priceListId: targetPriceListId,
                  productId: item.productId,
                }
              },
              update: {
                precioUnitario: precio,
                porcentaje: item.porcentaje,
              },
              create: {
                priceListId: targetPriceListId,
                productId: item.productId,
                precioUnitario: precio,
                porcentaje: item.porcentaje,
              },
            });
          } else {
            // Solo crear si no existe
            const existing = await (prisma as any).salesPriceListItem.findFirst({
              where: {
                priceListId: targetPriceListId,
                productId: item.productId,
              }
            });

            if (!existing) {
              await (prisma as any).salesPriceListItem.create({
                data: {
                  priceListId: targetPriceListId,
                  productId: item.productId,
                  precioUnitario: precio,
                  porcentaje: item.porcentaje,
                },
              });
            }
          }
          copied++;
        }

        return NextResponse.json({
          success: true,
          copied,
          message: `${copied} productos copiados`
        });
      } catch (error: any) {
        if (error.message?.includes('Unknown model')) {
          // Implementación con raw SQL sería similar pero más compleja
          return NextResponse.json({
            error: 'Operación no soportada con modelo legacy',
            details: 'Por favor actualice Prisma schema'
          }, { status: 400 });
        }
        throw error;
      }
    }

    return NextResponse.json({ error: 'Operación no reconocida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error en operación bulk:', error);
    return NextResponse.json(
      { error: 'Error en operación bulk', details: error.message },
      { status: 500 }
    );
  }
}
