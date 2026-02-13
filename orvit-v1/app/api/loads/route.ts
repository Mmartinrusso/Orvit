import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { createLoadSchema, errorMessages } from '@/lib/cargas/validations';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        }
      }
    });

    if (!user || !user.companies || user.companies.length === 0) {
      return null;
    }

    return {
      userId: user.id,
      companyId: user.companies[0].companyId,
    };
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// Helper para generar el siguiente internalId para una empresa
async function getNextInternalId(companyId: number, model: 'Truck' | 'Load'): Promise<number | undefined> {
  try {
    // Intentar verificar si la columna internalId existe primero
    try {
    const result = await prisma.$queryRaw<Array<{ max: number | null }>>`
      SELECT MAX("internalId") as max
      FROM "${model}"
      WHERE "companyId" = ${companyId}
    `;
    return result[0]?.max ? result[0].max + 1 : 1;
    } catch (sqlError: any) {
      // Si la columna no existe, retornar undefined
      if (sqlError.code === '42703' || sqlError.message?.includes('internalId') || sqlError.message?.includes('does not exist')) {
        return undefined;
      }
      throw sqlError;
    }
  } catch (error) {
    // Si falla, retornar undefined (no usar internalId)
    console.warn(`No se puede usar internalId para ${model}, continuando sin él`);
    return undefined;
  }
}

// GET - Obtener todas las cargas de la empresa
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const truckId = searchParams.get('truckId');

    const where: any = {
      companyId: auth.companyId,
    };

    if (truckId) {
      where.truckId = parseInt(truckId);
    }

    // Intentar usar Prisma Client primero
    try {
    const loads = await prisma.load.findMany({
      where,
      include: {
        truck: true,
        items: {
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    return NextResponse.json(loads);
    } catch (prismaError: any) {
      // Si falla porque internalId no existe, usar SQL raw
      if (prismaError.code === 'P2022' || 
          prismaError.message?.includes('internalId') || 
          prismaError.message?.includes('does not exist')) {
        try {
          const companyIdNum = Number(auth.companyId);
          let query = `
            SELECT
              l.id,
              l."truckId",
              l.date,
              l.description,
              l."deliveryClient",
              l."deliveryAddress",
              l."isCorralon",
              l.status,
              l."scheduledDate",
              l."departureDate",
              l."deliveryDate",
              l."companyId",
              l."createdAt",
              l."updatedAt"
            FROM "Load" l
            WHERE l."companyId" = ${companyIdNum}
          `;
          
          if (truckId) {
            query += ` AND l."truckId" = ${parseInt(truckId)}`;
          }
          
          query += ` ORDER BY l.date DESC`;
          
          const loads = await prisma.$queryRawUnsafe(query) as any[];
          
          // ✨ OPTIMIZADO: Evitar N+1 queries usando JOINs y agrupación
          if (loads.length === 0) {
            return NextResponse.json([]);
          }

          const loadIds = loads.map(l => l.id);
          const truckIds = [...new Set(loads.map(l => l.truckId))];

          // Obtener todos los items en un solo query
            const items = await prisma.$queryRawUnsafe(`
              SELECT * FROM "LoadItem"
            WHERE "loadId" = ANY(ARRAY[${loadIds.join(',')}]::int[])
            ORDER BY "loadId", position ASC
            `) as any[];
            
          // Obtener todos los trucks en un solo query
            const trucks = await prisma.$queryRawUnsafe(`
              SELECT * FROM "Truck"
            WHERE id = ANY(ARRAY[${truckIds.join(',')}]::int[])
            `) as any[];
            
          // Crear mapas para búsqueda O(1)
          const itemsByLoadId = new Map<number, any[]>();
          items.forEach(item => {
            const loadId = item.loadId;
            if (!itemsByLoadId.has(loadId)) {
              itemsByLoadId.set(loadId, []);
            }
            itemsByLoadId.get(loadId)!.push(item);
          });

          const trucksById = new Map<number, any>();
          trucks.forEach(truck => {
            trucksById.set(truck.id, truck);
          });

          // Combinar datos sin loops anidados
          const loadsWithItems = loads.map(load => ({
              ...load,
            truck: trucksById.get(load.truckId) || null,
            items: itemsByLoadId.get(load.id) || [],
          }));
          
          return NextResponse.json(loadsWithItems);
        } catch (rawError: any) {
          console.error('Error al obtener cargas con SQL raw:', rawError);
          return NextResponse.json(
            { error: 'Error al obtener cargas' },
            { status: 500 }
          );
        }
      }
      throw prismaError;
    }
  } catch (error) {
    console.error('Error al obtener cargas:', error);
    return NextResponse.json(
      { error: 'Error al obtener cargas' },
      { status: 500 }
    );
  }
}

// POST - Crear una nueva carga
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: errorMessages.unauthorized }, { status: 401 });
    }

    const body = await request.json();

    // Validar con Zod
    const validation = createLoadSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      return NextResponse.json(
        {
          error: firstError.message,
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { truckId, date, description, deliveryClient, deliveryAddress, isCorralon, items, chasisWeight, acopladoWeight } = validation.data;

    // Verificar que el camión existe y pertenece a la empresa
    // Usar SQL raw para obtener todos los campos incluyendo chasisWeight y acopladoWeight
    let truck: any;
    try {
      const trucks = await prisma.$queryRaw`
        SELECT 
          id,
          name,
          type,
          length,
          "chasisLength",
          "acopladoLength",
          "chasisWeight",
          "acopladoWeight",
          "maxWeight",
          "isOwn",
          client,
          description,
          "isActive",
          "companyId"
        FROM "Truck"
        WHERE id = ${parseInt(truckId)} AND "companyId" = ${auth.companyId} AND "isActive" = true
        LIMIT 1
      ` as any[];
      truck = trucks[0] || null;
    } catch (sqlError: any) {
      // Si falla, intentar con Prisma Client
      try {
        truck = await prisma.truck.findFirst({
      where: {
        id: parseInt(truckId),
        companyId: auth.companyId,
      },
    });
      } catch (prismaError) {
        truck = null;
      }
    }

    if (!truck) {
      return NextResponse.json(
        { error: 'Camión no encontrado' },
        { status: 404 }
      );
    }

    // Validar pesos individuales para EQUIPO
    if (truck.type === 'EQUIPO') {
      if (chasisWeight !== undefined && truck.chasisWeight && chasisWeight > truck.chasisWeight) {
        return NextResponse.json(
          { error: `El peso del chasis (${chasisWeight.toFixed(2)} Tn) excede el máximo permitido (${truck.chasisWeight} Tn)` },
          { status: 400 }
        );
      }
      if (acopladoWeight !== undefined && truck.acopladoWeight && acopladoWeight > truck.acopladoWeight) {
        return NextResponse.json(
          { error: `El peso del acoplado (${acopladoWeight.toFixed(2)} Tn) excede el máximo permitido (${truck.acopladoWeight} Tn)` },
          { status: 400 }
        );
      }
    }

    // Intentar generar internalId (puede fallar si la columna no existe)
    let internalId: number | undefined;
    try {
      internalId = await getNextInternalId(auth.companyId, 'Load');
    } catch (error) {
      console.warn('No se pudo generar internalId, continuando sin él:', error);
      internalId = undefined;
    }

    // Crear la carga con sus items
    // Intentar con Prisma Client primero, si falla usar SQL raw
    let load;
    try {
      const loadData: any = {
        truckId: parseInt(truckId),
        date: date ? new Date(date) : new Date(),
        description: description || null,
        deliveryClient: deliveryClient || null,
        deliveryAddress: deliveryAddress || null,
        isCorralon: isCorralon || false,
        companyId: auth.companyId,
        items: {
          create: items.map((item: any, index: number) => ({
            productId: item.productId,
            productName: item.productName || '',
            quantity: parseInt(item.quantity) || 1,
            length: item.length ? parseFloat(item.length) : null,
            weight: item.weight ? parseFloat(item.weight) : null,
            position: item.position !== undefined ? parseInt(item.position) : index,
            notes: item.notes || null,
          })),
        },
      };
      
      // Solo agregar internalId si se generó exitosamente
      if (internalId !== undefined) {
        loadData.internalId = internalId;
      }
      
      load = await prisma.load.create({
        data: loadData,
        include: {
          truck: true,
          items: {
            orderBy: {
              position: 'asc',
            },
          },
        },
      });
    } catch (createError: any) {
      // Si falla porque internalId no existe o por otros problemas de schema, usar SQL raw
      if (createError.message?.includes('internalId') || 
          createError.message?.includes('Unknown argument') ||
          createError.code === 'P2003' ||
          createError.code === 'P2022') {
        console.warn('Error con Prisma Client, usando SQL raw:', createError.message);
        
        // Crear la carga usando SQL raw
        const loadDate = date ? new Date(date) : new Date();
        let createdLoads: any[];
        
        if (internalId !== undefined) {
          try {
            createdLoads = await prisma.$queryRaw`
              INSERT INTO "Load" (
                "internalId", "truckId", date, description, "deliveryClient", "deliveryAddress", "isCorralon", "companyId", "createdAt", "updatedAt"
              ) VALUES (
                ${internalId},
                ${parseInt(truckId)},
                ${loadDate},
                ${description || null},
                ${deliveryClient || null},
                ${deliveryAddress || null},
                ${isCorralon || false},
                ${auth.companyId},
                NOW(),
                NOW()
              )
              RETURNING id, "truckId", date, description, "deliveryClient", "deliveryAddress", "isCorralon", "companyId", "createdAt", "updatedAt"
            ` as any[];
          } catch (internalIdError: any) {
            if (internalIdError.message?.includes('internalId') || internalIdError.code === '42703') {
              createdLoads = await prisma.$queryRaw`
                INSERT INTO "Load" (
                  "truckId", date, description, "deliveryClient", "deliveryAddress", "isCorralon", "companyId", "createdAt", "updatedAt"
                ) VALUES (
                  ${parseInt(truckId)},
                  ${loadDate},
                  ${description || null},
                  ${deliveryClient || null},
                  ${deliveryAddress || null},
                  ${isCorralon || false},
                  ${auth.companyId},
                  NOW(),
                  NOW()
                )
                RETURNING id, "truckId", date, description, "deliveryClient", "deliveryAddress", "isCorralon", "companyId", "createdAt", "updatedAt"
              ` as any[];
            } else {
              throw internalIdError;
            }
          }
        } else {
          createdLoads = await prisma.$queryRaw`
            INSERT INTO "Load" (
              "truckId", date, description, "deliveryClient", "deliveryAddress", "isCorralon", "companyId", "createdAt", "updatedAt"
            ) VALUES (
              ${parseInt(truckId)},
              ${loadDate},
              ${description || null},
              ${deliveryClient || null},
              ${deliveryAddress || null},
              ${isCorralon || false},
              ${auth.companyId},
              NOW(),
              NOW()
            )
            RETURNING id, "truckId", date, description, "deliveryClient", "deliveryAddress", "isCorralon", "companyId", "createdAt", "updatedAt"
          ` as any[];
        }
        
        const createdLoad = createdLoads[0];
        
        // Crear los items usando SQL raw
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          await prisma.$executeRaw`
            INSERT INTO "LoadItem" (
              "loadId", "productId", "productName", quantity, length, weight, position, notes, "createdAt", "updatedAt"
            ) VALUES (
              ${createdLoad.id},
              ${item.productId},
              ${item.productName || ''},
              ${parseInt(item.quantity) || 1},
              ${item.length ? parseFloat(item.length) : null},
              ${item.weight ? parseFloat(item.weight) : null},
              ${item.position !== undefined ? parseInt(item.position) : i},
              ${item.notes || null},
              NOW(),
              NOW()
            )
          `;
        }
        
        // Obtener la carga completa con items y truck
        const loadsWithItems = await prisma.$queryRaw`
          SELECT 
            l.id,
            l."truckId",
            l.date,
            l.description,
            l."deliveryClient",
            l."deliveryAddress",
            l."isCorralon",
            l."companyId",
            l."createdAt",
            l."updatedAt"
          FROM "Load" l
          WHERE l.id = ${createdLoad.id}
        ` as any[];
        
        const itemsData = await prisma.$queryRaw`
          SELECT * FROM "LoadItem"
          WHERE "loadId" = ${createdLoad.id}
          ORDER BY position ASC
        ` as any[];
        
        load = {
          ...loadsWithItems[0],
          truck: truck,
          items: itemsData || []
        };
      } else {
        throw createError;
      }
    }

    return NextResponse.json(load, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear carga:', error);
    return NextResponse.json(
      { error: 'Error al crear carga', details: error.message },
      { status: 500 }
    );
  }
}

