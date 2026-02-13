import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const duplicateSchema = z.object({
  newName: z.string().min(1, 'El nombre es requerido').max(100),
  newDescription: z.string().max(500).optional().nullable(),
  copyItems: z.boolean().default(true),
  applyAdjustment: z.boolean().default(false),
  adjustmentPercentage: z.number().optional(),
  setAsActive: z.boolean().default(true),
  setAsDefault: z.boolean().default(false),
});

// POST - Duplicar una lista de precios
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

    // Validate request body
    const validation = duplicateSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    const {
      newName,
      newDescription,
      copyItems,
      applyAdjustment,
      adjustmentPercentage,
      setAsActive,
      setAsDefault,
    } = validation.data;

    try {
      // Obtener lista original con sus items
      const originalLista = await (prisma as any).salesPriceList.findFirst({
        where: { id: listId, companyId: user!.companyId },
        include: {
          items: true,
        },
      });

      if (!originalLista) {
        return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
      }

      // Usar transacción para asegurar atomicidad
      const newLista = await prisma.$transaction(async (tx: any) => {
        // Si la nueva lista debe ser default, quitar el default de las demás
        if (setAsDefault) {
          await tx.salesPriceList.updateMany({
            where: { companyId: user!.companyId, esDefault: true },
            data: { esDefault: false }
          });
        }

        // Crear la nueva lista
        const created = await tx.salesPriceList.create({
          data: {
            companyId: user!.companyId,
            nombre: newName,
            descripcion: newDescription || originalLista.descripcion,
            moneda: originalLista.moneda,
            porcentajeBase: originalLista.porcentajeBase,
            esDefault: setAsDefault,
            isActive: setAsActive,
            validFrom: originalLista.validFrom,
            validUntil: originalLista.validUntil,
          },
        });

        // Copiar items si se solicita
        if (copyItems && originalLista.items.length > 0) {
          const itemsToCreate = originalLista.items.map((item: any) => {
            let precio = parseFloat(item.precioUnitario);

            // Aplicar ajuste si se solicita
            if (applyAdjustment && adjustmentPercentage) {
              precio = precio * (1 + adjustmentPercentage / 100);
              precio = parseFloat(precio.toFixed(2));
            }

            return {
              priceListId: created.id,
              productId: item.productId,
              precioUnitario: precio,
              porcentaje: item.porcentaje,
            };
          });

          await tx.salesPriceListItem.createMany({
            data: itemsToCreate,
          });
        }

        // Obtener la lista creada con sus items
        return await tx.salesPriceList.findUnique({
          where: { id: created.id },
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
      });

      return NextResponse.json({
        success: true,
        lista: newLista,
        itemsCopied: copyItems ? originalLista.items.length : 0,
        message: `Lista "${newName}" creada exitosamente${copyItems ? ` con ${originalLista.items.length} productos` : ''}`
      }, { status: 201 });
    } catch (error: any) {
      if (error.message?.includes('Unknown model')) {
        // Fallback con raw SQL
        const listas = await prisma.$queryRaw`
          SELECT * FROM "sales_price_lists" WHERE id = ${listId} AND "companyId" = ${user!.companyId}
        ` as any[];

        if (listas.length === 0) {
          return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
        }

        const originalLista = listas[0];

        // Transacción SQL
        await prisma.$transaction(async (tx: any) => {
          // Si es default, quitar el default de las demás
          if (setAsDefault) {
            await tx.$executeRaw`
              UPDATE "sales_price_lists" SET "esDefault" = false
              WHERE "companyId" = ${user!.companyId} AND "esDefault" = true
            `;
          }

          // Crear nueva lista
          await tx.$executeRaw`
            INSERT INTO "sales_price_lists" (
              "companyId", nombre, descripcion, moneda, "porcentajeBase",
              "esDefault", "isActive", "validFrom", "validUntil", "createdAt", "updatedAt"
            ) VALUES (
              ${user!.companyId}, ${newName}, ${newDescription || originalLista.descripcion},
              ${originalLista.moneda}, ${originalLista.porcentajeBase},
              ${setAsDefault}, ${setAsActive}, ${originalLista.validFrom}, ${originalLista.validUntil},
              NOW(), NOW()
            )
          `;

          // Obtener el ID de la nueva lista
          const newListaResult = await tx.$queryRaw`
            SELECT id FROM "sales_price_lists"
            WHERE "companyId" = ${user!.companyId} AND nombre = ${newName}
            ORDER BY "createdAt" DESC
            LIMIT 1
          ` as any[];

          const newListaId = newListaResult[0].id;

          // Copiar items si se solicita
          if (copyItems) {
            const items = await tx.$queryRaw`
              SELECT * FROM "sales_price_list_items" WHERE "priceListId" = ${listId}
            ` as any[];

            for (const item of items) {
              let precio = parseFloat(item.precioUnitario);

              if (applyAdjustment && adjustmentPercentage) {
                precio = precio * (1 + adjustmentPercentage / 100);
                precio = parseFloat(precio.toFixed(2));
              }

              await tx.$executeRaw`
                INSERT INTO "sales_price_list_items" ("priceListId", "productId", "precioUnitario", "porcentaje")
                VALUES (${newListaId}, ${item.productId}, ${precio}, ${item.porcentaje})
              `;
            }
          }
        });

        const newLista = await prisma.$queryRaw`
          SELECT * FROM "sales_price_lists"
          WHERE "companyId" = ${user!.companyId} AND nombre = ${newName}
          ORDER BY "createdAt" DESC
          LIMIT 1
        ` as any[];

        const itemsCount = copyItems ? await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "sales_price_list_items" WHERE "priceListId" = ${newLista[0].id}
        ` as any[] : [{ count: 0 }];

        return NextResponse.json({
          success: true,
          lista: newLista[0],
          itemsCopied: parseInt(itemsCount[0].count || 0),
          message: `Lista "${newName}" creada exitosamente`
        }, { status: 201 });
      }

      // Error de duplicado (nombre ya existe)
      if (error.code === 'P2002') {
        return NextResponse.json({
          error: 'Ya existe una lista con ese nombre'
        }, { status: 409 });
      }

      throw error;
    }
  } catch (error: any) {
    console.error('Error duplicating price list:', error);
    return NextResponse.json(
      { error: 'Error al duplicar lista de precios', details: error.message },
      { status: 500 }
    );
  }
}
