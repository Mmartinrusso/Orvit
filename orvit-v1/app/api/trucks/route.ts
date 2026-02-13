import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

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

// GET - Obtener todos los camiones de la empresa
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyIdNum = Number(auth.companyId);

    // Verificar primero si el modelo existe antes de intentar usarlo
    const hasTruckModel = prisma.truck && typeof (prisma.truck as any).findMany === 'function';
    
    if (!hasTruckModel) {
      // Usar consulta raw
      try {
        const trucks = await prisma.$queryRaw`
          SELECT 
            t.id,
            t.name,
            t.type,
            t.length,
            t."chasisLength",
            t."acopladoLength",
            t."chasisWeight",
            t."acopladoWeight",
            t."maxWeight",
            t."isOwn",
            t.client,
            t.description,
            t."isActive",
            t."companyId",
            t."createdAt",
            t."updatedAt"
          FROM "Truck" t
          WHERE t."companyId" = ${companyIdNum}
            AND t."isActive" = true
          ORDER BY t.name ASC
        ` as any[];
        return NextResponse.json(trucks || []);
      } catch (rawError: any) {
        if (rawError.code === '42P01' || rawError.message?.includes('does not exist')) {
          return NextResponse.json([]);
        }
        throw rawError;
      }
    }

    // Intentar usar Prisma Client si está disponible
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

      // Verificar si los camiones tienen los campos chasisLength y acopladoLength
      // Si no los tienen (undefined), usar SQL raw para obtenerlos
      // Nota: null es válido (significa que el camión no es EQUIPO), undefined significa que el campo no existe en el modelo
      if (trucks.length > 0 && !('chasisLength' in trucks[0])) {
        // Los campos no están disponibles en Prisma Client, usar SQL raw
        throw new Error('Model fields not available');
      }

      return NextResponse.json(trucks);
    } catch (prismaError: any) {
      // Si falla, usar consulta raw
      if (prismaError.code === 'P2021' || 
          prismaError.message?.includes('does not exist') || 
          prismaError.message?.includes('Unknown model') ||
          prismaError.message?.includes('model Truck') ||
          prismaError.message?.includes('Model fields not available')) {
        try {
          const trucks = await prisma.$queryRaw`
            SELECT 
              t.id,
              t.name,
              t.type,
              t.length,
              t."chasisLength",
              t."acopladoLength",
              t."chasisWeight",
              t."acopladoWeight",
              t."maxWeight",
              t."isOwn",
              t.client,
              t.description,
              t."isActive",
              t."companyId",
              t."createdAt",
              t."updatedAt"
            FROM "Truck" t
            WHERE t."companyId" = ${companyIdNum}
              AND t."isActive" = true
            ORDER BY t.name ASC
          ` as any[];
          return NextResponse.json(trucks || []);
        } catch (rawError: any) {
          if (rawError.code === '42P01' || rawError.message?.includes('does not exist')) {
            return NextResponse.json([]);
          }
          throw rawError;
        }
      }
      throw prismaError;
    }
  } catch (error: any) {
    console.error('Error al obtener camiones:', error);
    return NextResponse.json(
      { error: 'Error al obtener camiones', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Crear un nuevo camión
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, length, chasisLength, acopladoLength, chasisWeight, acopladoWeight, maxWeight, isOwn, client, description } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, type' },
        { status: 400 }
      );
    }

    // Validar que el tipo sea válido
    if (!['CHASIS', 'EQUIPO', 'SEMI'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de camión inválido. Debe ser: CHASIS, EQUIPO o SEMI' },
        { status: 400 }
      );
    }

    // Validar longitudes según el tipo
    if (type === 'EQUIPO') {
      if (!chasisLength || !acopladoLength) {
        return NextResponse.json(
          { error: 'Para EQUIPO se requieren chasisLength y acopladoLength' },
          { status: 400 }
        );
      }
      if (!chasisWeight || !acopladoWeight) {
        return NextResponse.json(
          { error: 'Para EQUIPO se requieren chasisWeight y acopladoWeight' },
          { status: 400 }
        );
      }
    } else {
      if (!length) {
        return NextResponse.json(
          { error: 'Falta campo requerido: length' },
          { status: 400 }
        );
      }
    }

    const companyIdNum = Number(auth.companyId);
    const finalLength = type === 'EQUIPO' 
      ? (parseFloat(chasisLength) + parseFloat(acopladoLength))
      : parseFloat(length);
    const finalChasisLength = type === 'EQUIPO' ? parseFloat(chasisLength) : null;
    const finalAcopladoLength = type === 'EQUIPO' ? parseFloat(acopladoLength) : null;
    const finalChasisWeight = type === 'EQUIPO' ? parseFloat(chasisWeight) : null;
    const finalAcopladoWeight = type === 'EQUIPO' ? parseFloat(acopladoWeight) : null;
    // Para EQUIPO, calcular maxWeight como suma de chasisWeight + acopladoWeight
    // Para otros tipos, usar maxWeight directamente
    const finalMaxWeight = type === 'EQUIPO' 
      ? (finalChasisWeight && finalAcopladoWeight ? finalChasisWeight + finalAcopladoWeight : null)
      : (maxWeight ? parseFloat(maxWeight) : null);
    const finalIsOwn = isOwn !== undefined ? isOwn : true;
    const finalClient = isOwn === false ? (client || null) : null;
    
    // Intentar generar internalId (puede fallar si la columna no existe)
    let internalId: number | undefined;
    try {
      internalId = await getNextInternalId(companyIdNum, 'Truck');
    } catch (error) {
      console.warn('No se pudo generar internalId, continuando sin él:', error);
      internalId = undefined;
    }

    // Verificar primero si el modelo existe antes de intentar usarlo
    const hasTruckModel = prisma.truck && typeof (prisma.truck as any).create === 'function';
    
    if (!hasTruckModel) {
      // Usar consulta raw
      try {
        // Construir la consulta SQL condicionalmente según si internalId existe
        let createdTrucks: any[];
        if (internalId !== undefined) {
          try {
            createdTrucks = await prisma.$queryRaw`
              INSERT INTO "Truck" (
                "internalId", name, type, length, "chasisLength", "acopladoLength", "chasisWeight", "acopladoWeight", "maxWeight", 
                "isOwn", client, description, "companyId", "isActive", "createdAt", "updatedAt"
              ) VALUES (
                ${internalId},
                ${name},
                ${type}::"TruckType",
                ${finalLength},
                ${finalChasisLength},
                ${finalAcopladoLength},
                ${finalChasisWeight},
                ${finalAcopladoWeight},
                ${finalMaxWeight},
                ${finalIsOwn},
                ${finalClient},
                ${description || null},
                ${companyIdNum},
                true,
                NOW(),
                NOW()
              )
              RETURNING 
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
                "companyId",
                "createdAt",
                "updatedAt"
            ` as any[];
          } catch (internalIdError: any) {
            // Si falla porque la columna no existe, intentar sin internalId
            if (internalIdError.message?.includes('internalId') || internalIdError.code === '42703') {
              createdTrucks = await prisma.$queryRaw`
                INSERT INTO "Truck" (
                  name, type, length, "chasisLength", "acopladoLength", "chasisWeight", "acopladoWeight", "maxWeight", 
                  "isOwn", client, description, "companyId", "isActive", "createdAt", "updatedAt"
                ) VALUES (
                  ${name},
                  ${type}::"TruckType",
                  ${finalLength},
                  ${finalChasisLength},
                  ${finalAcopladoLength},
                  ${finalChasisWeight},
                  ${finalAcopladoWeight},
                  ${finalMaxWeight},
                  ${finalIsOwn},
                  ${finalClient},
                  ${description || null},
                  ${companyIdNum},
                  true,
                  NOW(),
                  NOW()
                )
                RETURNING 
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
                  "companyId",
                  "createdAt",
                  "updatedAt"
              ` as any[];
            } else {
              throw internalIdError;
            }
          }
        } else {
          createdTrucks = await prisma.$queryRaw`
            INSERT INTO "Truck" (
              name, type, length, "chasisLength", "acopladoLength", "chasisWeight", "acopladoWeight", "maxWeight", 
              "isOwn", client, description, "companyId", "isActive", "createdAt", "updatedAt"
            ) VALUES (
              ${name},
              ${type}::"TruckType",
              ${finalLength},
              ${finalChasisLength},
              ${finalAcopladoLength},
              ${finalChasisWeight},
              ${finalAcopladoWeight},
              ${finalMaxWeight},
              ${finalIsOwn},
              ${finalClient},
              ${description || null},
              ${companyIdNum},
              true,
              NOW(),
              NOW()
            )
            RETURNING 
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
              "companyId",
              "createdAt",
              "updatedAt"
          ` as any[];
        }
        
        return NextResponse.json(createdTrucks[0] || {}, { status: 201 });
      } catch (rawError: any) {
        if (rawError.code === '42P01' || rawError.message?.includes('does not exist')) {
          return NextResponse.json(
            { error: 'La tabla Truck no existe' },
            { status: 500 }
          );
        }
        if (rawError.code === '23505') { // Unique constraint violation
          return NextResponse.json(
            { error: 'Ya existe un camión con ese nombre en la empresa' },
            { status: 409 }
          );
        }
        throw rawError;
      }
    }

    // Intentar usar Prisma Client si está disponible
    try {
      const truckData: any = {
        name,
        type,
        length: finalLength,
        chasisLength: finalChasisLength,
        acopladoLength: finalAcopladoLength,
        chasisWeight: finalChasisWeight,
        acopladoWeight: finalAcopladoWeight,
        maxWeight: finalMaxWeight,
        isOwn: finalIsOwn,
        client: finalClient,
        description: description || null,
        companyId: companyIdNum,
      };
      
      // Solo agregar internalId si está definido
      if (internalId !== undefined) {
        truckData.internalId = internalId;
      }
      
      const truck = await prisma.truck.create({
        data: truckData,
      });

      return NextResponse.json(truck, { status: 201 });
    } catch (prismaError: any) {
      // Si falla porque no reconoce los campos, usar consulta raw
      if (prismaError.message?.includes('Unknown argument') || 
          prismaError.message?.includes('chasisLength') ||
          prismaError.message?.includes('acopladoLength') ||
          prismaError.code === 'P2021' || 
          prismaError.message?.includes('does not exist') || 
          prismaError.message?.includes('Unknown model') ||
          prismaError.message?.includes('model Truck')) {
        try {
          // Construir la consulta SQL condicionalmente
          let createdTrucks: any[];
          if (internalId !== undefined) {
            try {
              createdTrucks = await prisma.$queryRaw`
                INSERT INTO "Truck" (
                  "internalId", name, type, length, "chasisLength", "acopladoLength", "chasisWeight", "acopladoWeight", "maxWeight", 
                  "isOwn", client, description, "companyId", "isActive", "createdAt", "updatedAt"
                ) VALUES (
                  ${internalId},
                  ${name},
                  ${type}::"TruckType",
                  ${finalLength},
                  ${finalChasisLength},
                  ${finalAcopladoLength},
                  ${finalChasisWeight},
                  ${finalAcopladoWeight},
                  ${finalMaxWeight},
                  ${finalIsOwn},
                  ${finalClient},
                  ${description || null},
                  ${companyIdNum},
                  true,
                  NOW(),
                  NOW()
                )
                RETURNING 
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
                  "companyId",
                  "createdAt",
                  "updatedAt"
              ` as any[];
            } catch (internalIdError: any) {
              // Si falla porque la columna no existe, intentar sin internalId
              if (internalIdError.message?.includes('internalId') || internalIdError.code === '42703') {
                createdTrucks = await prisma.$queryRaw`
                  INSERT INTO "Truck" (
                    name, type, length, "chasisLength", "acopladoLength", "chasisWeight", "acopladoWeight", "maxWeight", 
                    "isOwn", client, description, "companyId", "isActive", "createdAt", "updatedAt"
                  ) VALUES (
                    ${name},
                    ${type}::"TruckType",
                    ${finalLength},
                    ${finalChasisLength},
                    ${finalAcopladoLength},
                    ${finalChasisWeight},
                    ${finalAcopladoWeight},
                    ${finalMaxWeight},
                    ${finalIsOwn},
                    ${finalClient},
                    ${description || null},
                    ${companyIdNum},
                    true,
                    NOW(),
                    NOW()
                  )
                  RETURNING 
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
                    "companyId",
                    "createdAt",
                    "updatedAt"
                ` as any[];
              } else {
                throw internalIdError;
              }
            }
          } else {
            createdTrucks = await prisma.$queryRaw`
              INSERT INTO "Truck" (
                name, type, length, "chasisLength", "acopladoLength", "chasisWeight", "acopladoWeight", "maxWeight", 
                "isOwn", client, description, "companyId", "isActive", "createdAt", "updatedAt"
              ) VALUES (
                ${name},
                ${type}::"TruckType",
                ${finalLength},
                ${finalChasisLength},
                ${finalAcopladoLength},
                ${finalChasisWeight},
                ${finalAcopladoWeight},
                ${finalMaxWeight},
                ${finalIsOwn},
                ${finalClient},
                ${description || null},
                ${companyIdNum},
                true,
                NOW(),
                NOW()
              )
              RETURNING 
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
                "companyId",
                "createdAt",
                "updatedAt"
            ` as any[];
          }
          
          return NextResponse.json(createdTrucks[0] || {}, { status: 201 });
        } catch (rawError: any) {
          if (rawError.code === '42P01' || rawError.message?.includes('does not exist')) {
            return NextResponse.json(
              { error: 'La tabla Truck no existe' },
              { status: 500 }
            );
          }
          if (rawError.code === '23505') { // Unique constraint violation
            return NextResponse.json(
              { error: 'Ya existe un camión con ese nombre en la empresa' },
              { status: 409 }
            );
          }
          throw rawError;
        }
      }
      throw prismaError;
    }
  } catch (error: any) {
    console.error('Error al crear camión:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe un camión con ese nombre en la empresa' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Error al crear camión' },
      { status: 500 }
    );
  }
}

