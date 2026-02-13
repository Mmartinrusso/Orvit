import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { createPriceListSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

// GET - Obtener listas de precios de la empresa
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LISTAS_PRECIOS_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const includeItems = searchParams.get('includeItems') === 'true';
    const onlyActive = searchParams.get('onlyActive') !== 'false';

    try {
      const lists = await (prisma as any).salesPriceList.findMany({
        where: {
          companyId: user!.companyId,
          ...(onlyActive ? { isActive: true } : {}),
        },
        include: includeItems ? {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  costPrice: true,
                }
              }
            }
          },
          _count: {
            select: { items: true }
          }
        } : {
          _count: {
            select: { items: true }
          }
        },
        orderBy: { nombre: 'asc' },
      });

      return NextResponse.json(lists || []);
    } catch (error: any) {
      // Fallback a SQL raw
      if (error.message?.includes('Unknown model') || error.message?.includes('Cannot read properties')) {
        const lists = await prisma.$queryRaw`
          SELECT
            spl.*,
            (SELECT COUNT(*) FROM "sales_price_list_items" WHERE "priceListId" = spl.id) as "itemCount"
          FROM "sales_price_lists" spl
          WHERE spl."companyId" = ${user!.companyId}
            ${onlyActive ? prisma.$queryRaw`AND spl."isActive" = true` : prisma.$queryRaw``}
          ORDER BY spl.nombre ASC
        ` as any[];

        return NextResponse.json(lists.map((l: any) => ({
          ...l,
          _count: { items: parseInt(l.itemCount) || 0 }
        })));
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al obtener listas de precios:', error);
    return NextResponse.json(
      { error: 'Error al obtener listas de precios', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Crear una nueva lista de precios
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LISTAS_PRECIOS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key (optional but recommended)
    const idempotencyKey = getIdempotencyKey(request);

    const body = await request.json();

    // Validar con Zod
    const validation = createPriceListSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { nombre, descripcion, moneda, porcentajeBase, esDefault, validFrom, validUntil } = validation.data;

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CREATE_PRICE_LIST',
      async () => {
        try {
          // Si se marca como default, quitar el default de las demás
          if (esDefault) {
            await (prisma as any).salesPriceList.updateMany({
              where: { companyId, esDefault: true },
              data: { esDefault: false }
            });
          }

          const list = await (prisma as any).salesPriceList.create({
            data: {
              nombre: nombre.trim(),
              descripcion: descripcion?.trim() || null,
              moneda: moneda || 'ARS',
              porcentajeBase: porcentajeBase ? parseFloat(porcentajeBase) : null,
              esDefault: esDefault === true,
              validFrom: validFrom ? new Date(validFrom) : null,
              validUntil: validUntil ? new Date(validUntil) : null,
              companyId,
            },
          });

          return list;
        } catch (error: any) {
          // Fallback a SQL raw
          if (error.message?.includes('Unknown model') || error.message?.includes('Cannot read properties')) {
            if (esDefault) {
              await prisma.$executeRaw`
                UPDATE "sales_price_lists" SET "esDefault" = false
                WHERE "companyId" = ${companyId} AND "esDefault" = true
              `;
            }

            await prisma.$executeRaw`
              INSERT INTO "sales_price_lists" (nombre, descripcion, moneda, "porcentajeBase", "esDefault", "isActive", "validFrom", "validUntil", "companyId", "createdAt", "updatedAt")
              VALUES (
                ${nombre.trim()},
                ${descripcion?.trim() || null},
                ${moneda || 'ARS'},
                ${porcentajeBase ? parseFloat(porcentajeBase) : null},
                ${esDefault === true},
                true,
                ${validFrom ? new Date(validFrom) : null},
                ${validUntil ? new Date(validUntil) : null},
                ${companyId},
                NOW(),
                NOW()
              )
            `;

            const created = await prisma.$queryRaw`
              SELECT * FROM "sales_price_lists"
              WHERE "companyId" = ${companyId}
              ORDER BY id DESC LIMIT 1
            ` as any[];

            return created[0];
          }

          if (error.code === 'P2002') {
            throw new Error('DUPLICATE_NAME');
          }
          throw error;
        }
      },
      {
        entityType: 'SalesPriceList',
        getEntityId: (result) => result?.id || 0,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error: any) {
    console.error('Error al crear lista de precios:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle duplicate name error
    if (error instanceof Error && error.message === 'DUPLICATE_NAME') {
      return NextResponse.json(
        { error: 'Ya existe una lista con ese nombre' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Error al crear lista de precios', details: error.message },
      { status: 500 }
    );
  }
}
