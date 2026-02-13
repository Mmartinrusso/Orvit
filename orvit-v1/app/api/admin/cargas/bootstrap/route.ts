import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { loadFiltersSchema } from '@/lib/cargas/validations';

export const dynamic = 'force-dynamic';

/**
 * ✨ ENDPOINT BOOTSTRAP: Consolida datos de cargas
 * Devuelve en una sola respuesta:
 * - Trucks (camiones)
 * - Loads (cargas con items y trucks)
 *
 * Reduce la cantidad de requests de 3-4 a 1 sola llamada
 */
export async function GET(request: NextRequest) {
  try {
    // Use centralized auth - companyId comes from JWT token, not query params
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyIdNum = auth.companyId;

    // Parsear parámetros de consulta con validación
    const { searchParams } = new URL(request.url);
    const filtersResult = loadFiltersSchema.safeParse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
      truckType: searchParams.get('truckType') || undefined,
      truckId: searchParams.get('truckId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      client: searchParams.get('client') || undefined,
      search: searchParams.get('search') || undefined,
    });

    const filters = filtersResult.success ? filtersResult.data : {
      page: 1,
      limit: 50,
    };

    const skip = (filters.page - 1) * filters.limit;

    // Construir filtros de loads
    const loadWhere: any = {
      companyId: companyIdNum,
    };

    if (filters.truckType) {
      loadWhere.truck = { type: filters.truckType };
    }

    if (filters.truckId) {
      loadWhere.truckId = filters.truckId;
    }

    if (filters.dateFrom) {
      loadWhere.date = {
        ...loadWhere.date,
        gte: new Date(filters.dateFrom),
      };
    }

    if (filters.dateTo) {
      loadWhere.date = {
        ...loadWhere.date,
        lte: new Date(filters.dateTo),
      };
    }

    if (filters.client) {
      loadWhere.deliveryClient = {
        contains: filters.client,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      loadWhere.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { deliveryClient: { contains: filters.search, mode: 'insensitive' } },
        { truck: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    // ✨ OPTIMIZACIÓN: Cargar trucks, loads y count en paralelo
    const [trucks, loads, totalLoads] = await Promise.all([
      // 1. Obtener trucks
      (async () => {
        try {
          const trucks = await prisma.truck.findMany({
            where: {
              companyId: companyIdNum,
              isActive: true,
            },
            orderBy: {
              name: 'asc',
            },
          });
          return trucks;
        } catch (error: any) {
          // Si falla con Prisma, intentar SQL raw
          if (error.code === 'P2021' || error.message?.includes('does not exist')) {
            try {
              const trucks = await prisma.$queryRaw`
                SELECT 
                  t.id, t.name, t.type, t.length,
                  t."chasisLength", t."acopladoLength",
                  t."chasisWeight", t."acopladoWeight", t."maxWeight",
                  t."isOwn", t.client, t.description, t."isActive",
                  t."companyId", t."createdAt", t."updatedAt"
                FROM "Truck" t
                WHERE t."companyId" = ${companyIdNum}
                  AND t."isActive" = true
                ORDER BY t.name ASC
              ` as any[];
              return trucks || [];
            } catch (rawError) {
              console.error('Error obteniendo trucks con SQL raw:', rawError);
              return [];
            }
          }
          throw error;
        }
      })(),

      // 2. Obtener loads con items y trucks (optimizado con paginación)
      (async () => {
        try {
          const loads = await prisma.load.findMany({
            where: loadWhere,
            include: {
              truck: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  length: true,
                  chasisLength: true,
                  acopladoLength: true,
                  chasisWeight: true,
                  acopladoWeight: true,
                  maxWeight: true,
                  isOwn: true,
                  client: true,
                  description: true,
                  isActive: true,
                },
              },
              items: {
                orderBy: {
                  position: 'asc',
                },
                select: {
                  id: true,
                  productId: true,
                  productName: true,
                  quantity: true,
                  length: true,
                  weight: true,
                  position: true,
                  notes: true,
                },
              },
            },
            orderBy: {
              date: 'desc',
            },
            skip,
            take: filters.limit,
          });
          return loads;
        } catch (error: any) {
          // Si falla con Prisma, usar SQL raw optimizado (más simple y rápido)
          if (error.code === 'P2022' || error.message?.includes('internalId') || error.code === 'P2021') {
            try {
              // ✨ OPTIMIZADO: Query más simple, obtener datos separados y combinar
              const loads = await prisma.$queryRaw`
                SELECT
                  l.id, l."truckId", l.date, l.description,
                  l."deliveryClient", l."deliveryAddress", l."isCorralon",
                  l.status, l."scheduledDate", l."departureDate", l."deliveryDate",
                  l."companyId", l."createdAt", l."updatedAt"
                FROM "Load" l
                WHERE l."companyId" = ${companyIdNum}
                ORDER BY l.date DESC
                LIMIT 1000
              ` as any[];

              if (loads.length === 0) {
                return [];
              }

              const loadIds = loads.map(l => l.id);
              const truckIds = [...new Set(loads.map(l => l.truckId))];

              // Obtener trucks y items en paralelo
              const [trucks, items] = await Promise.all([
                truckIds.length > 0 
                  ? prisma.$queryRawUnsafe(`
                      SELECT id, name, type, length,
                        "chasisLength", "acopladoLength",
                        "chasisWeight", "acopladoWeight", "maxWeight",
                        "isOwn", client, description, "isActive"
                      FROM "Truck"
                      WHERE id = ANY(ARRAY[${truckIds.join(',')}]::int[])
                    `) as Promise<any[]>
                  : Promise.resolve([]),
                prisma.$queryRawUnsafe(`
                  SELECT id, "loadId", "productId", "productName",
                    quantity, length, weight, position, notes
                  FROM "LoadItem"
                  WHERE "loadId" = ANY(ARRAY[${loadIds.join(',')}]::int[])
                  ORDER BY "loadId", position ASC
                `) as Promise<any[]>,
              ]);

              // Crear mapas para búsqueda O(1)
              const trucksById = new Map(trucks.map(t => [t.id, t]));
              const itemsByLoadId = new Map<number, any[]>();
              items.forEach(item => {
                const loadId = item.loadId;
                if (!itemsByLoadId.has(loadId)) {
                  itemsByLoadId.set(loadId, []);
                }
                itemsByLoadId.get(loadId)!.push(item);
              });

              // Combinar datos
              return loads.map(load => ({
                ...load,
                truck: trucksById.get(load.truckId) || null,
                items: itemsByLoadId.get(load.id) || [],
              }));
            } catch (rawError) {
              console.error('Error obteniendo loads con SQL raw:', rawError);
              return [];
            }
          }
          throw error;
        }
      })(),

      // 3. Contar total de loads para paginación
      (async () => {
        try {
          return await prisma.load.count({ where: loadWhere });
        } catch {
          return 0;
        }
      })(),
    ]);

    // Calcular información de paginación
    const totalPages = Math.ceil(totalLoads / filters.limit);

    return NextResponse.json({
      success: true,
      data: {
        trucks,
        loads,
      },
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: totalLoads,
        totalPages,
        hasNext: filters.page < totalPages,
        hasPrev: filters.page > 1,
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30',
      },
    });

  } catch (error: any) {
    console.error('[CARGAS_BOOTSTRAP_ERROR]', error);
    return NextResponse.json(
      { error: 'Error al cargar datos de cargas', details: error.message },
      { status: 500 }
    );
  }
}

