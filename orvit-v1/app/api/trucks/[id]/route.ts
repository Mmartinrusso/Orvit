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

// GET - Obtener un camión por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const truck = await prisma.truck.findFirst({
      where: {
        id: parseInt(params.id),
        companyId: auth.companyId,
      },
      include: {
        loads: {
          orderBy: {
            date: 'desc',
          },
          take: 10, // Últimas 10 cargas
        },
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Camión no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(truck);
  } catch (error) {
    console.error('Error al obtener camión:', error);
    return NextResponse.json(
      { error: 'Error al obtener camión' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar un camión
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, length, chasisLength, acopladoLength, chasisWeight, acopladoWeight, maxWeight, isOwn, client, description, isActive } = body;

    // Verificar que el camión existe y pertenece a la empresa
    const existingTruck = await prisma.truck.findFirst({
      where: {
        id: parseInt(params.id),
        companyId: auth.companyId,
      },
    });

    if (!existingTruck) {
      return NextResponse.json(
        { error: 'Camión no encontrado' },
        { status: 404 }
      );
    }

    // Validar tipo si se proporciona
    if (type && !['CHASIS', 'EQUIPO', 'SEMI'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de camión inválido. Debe ser: CHASIS, EQUIPO o SEMI' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      updateData.type = type;
      // Si cambia el tipo, actualizar longitudes y pesos
      if (type === 'EQUIPO') {
        if (chasisLength !== undefined && acopladoLength !== undefined) {
          updateData.chasisLength = parseFloat(chasisLength);
          updateData.acopladoLength = parseFloat(acopladoLength);
          updateData.length = parseFloat(chasisLength) + parseFloat(acopladoLength);
        }
        if (chasisWeight !== undefined && acopladoWeight !== undefined) {
          updateData.chasisWeight = parseFloat(chasisWeight);
          updateData.acopladoWeight = parseFloat(acopladoWeight);
          updateData.maxWeight = parseFloat(chasisWeight) + parseFloat(acopladoWeight);
        }
      } else {
        if (length !== undefined) {
          updateData.length = parseFloat(length);
          updateData.chasisLength = null;
          updateData.acopladoLength = null;
        }
        updateData.chasisWeight = null;
        updateData.acopladoWeight = null;
        if (maxWeight !== undefined) updateData.maxWeight = maxWeight ? parseFloat(maxWeight) : null;
      }
    } else {
      // Si no cambia el tipo, actualizar según el tipo actual
      const currentType = existingTruck.type;
      if (currentType === 'EQUIPO') {
        if (chasisLength !== undefined) updateData.chasisLength = parseFloat(chasisLength);
        if (acopladoLength !== undefined) updateData.acopladoLength = parseFloat(acopladoLength);
        if (chasisLength !== undefined || acopladoLength !== undefined) {
          const newChasis = chasisLength !== undefined ? parseFloat(chasisLength) : (existingTruck.chasisLength || 0);
          const newAcoplado = acopladoLength !== undefined ? parseFloat(acopladoLength) : (existingTruck.acopladoLength || 0);
          updateData.length = newChasis + newAcoplado;
        }
        if (chasisWeight !== undefined) updateData.chasisWeight = parseFloat(chasisWeight);
        if (acopladoWeight !== undefined) updateData.acopladoWeight = parseFloat(acopladoWeight);
        if (chasisWeight !== undefined || acopladoWeight !== undefined) {
          const newChasisWeight = chasisWeight !== undefined ? parseFloat(chasisWeight) : ((existingTruck as any).chasisWeight || 0);
          const newAcopladoWeight = acopladoWeight !== undefined ? parseFloat(acopladoWeight) : ((existingTruck as any).acopladoWeight || 0);
          updateData.maxWeight = newChasisWeight + newAcopladoWeight;
        }
      } else {
        if (length !== undefined) updateData.length = parseFloat(length);
        if (maxWeight !== undefined) updateData.maxWeight = maxWeight ? parseFloat(maxWeight) : null;
      }
    }
    if (isOwn !== undefined) updateData.isOwn = isOwn;
    if (client !== undefined) updateData.client = isOwn === false ? (client || null) : null;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const truck = await prisma.truck.update({
      where: {
        id: parseInt(params.id),
      },
      data: updateData,
    });

    return NextResponse.json(truck);
  } catch (error: any) {
    console.error('Error al actualizar camión:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe un camión con ese nombre en la empresa' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Error al actualizar camión' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar (desactivar) un camión
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const truckId = parseInt(params.id);
    const companyIdNum = Number(auth.companyId);

    // Verificar que el camión existe y pertenece a la empresa
    const hasTruckModel = prisma.truck && typeof (prisma.truck as any).findFirst === 'function';
    
    let truck;
    if (hasTruckModel) {
      try {
        truck = await prisma.truck.findFirst({
          where: {
            id: truckId,
            companyId: companyIdNum,
          },
        });
      } catch (prismaError: any) {
        // Si falla, usar SQL raw
        if (prismaError.code === 'P2021' || 
            prismaError.message?.includes('does not exist') || 
            prismaError.message?.includes('Unknown model')) {
          const trucks = await prisma.$queryRaw`
            SELECT id, "companyId" 
            FROM "Truck" 
            WHERE id = ${truckId} AND "companyId" = ${companyIdNum}
          ` as any[];
          truck = trucks[0] || null;
        } else {
          throw prismaError;
        }
      }
    } else {
      // Usar SQL raw directamente
      const trucks = await prisma.$queryRaw`
        SELECT id, "companyId" 
        FROM "Truck" 
        WHERE id = ${truckId} AND "companyId" = ${companyIdNum}
      ` as any[];
      truck = trucks[0] || null;
    }

    if (!truck) {
      return NextResponse.json(
        { error: 'Camión no encontrado' },
        { status: 404 }
      );
    }

    // Soft delete: marcar como inactivo usando SQL raw
    try {
      await prisma.$executeRaw`
        UPDATE "Truck" 
        SET "isActive" = false, "updatedAt" = NOW()
        WHERE id = ${truckId} AND "companyId" = ${companyIdNum}
      `;
    } catch (updateError: any) {
      // Si falla, intentar con Prisma Client
      if (hasTruckModel) {
        try {
          await prisma.truck.update({
            where: {
              id: truckId,
            },
            data: {
              isActive: false,
            },
          });
        } catch (prismaUpdateError) {
          console.error('Error al actualizar camión:', prismaUpdateError);
          throw prismaUpdateError;
        }
      } else {
        throw updateError;
      }
    }

    return NextResponse.json({ message: 'Camión eliminado correctamente' });
  } catch (error: any) {
    console.error('Error al eliminar camión:', error);
    return NextResponse.json(
      { error: 'Error al eliminar camión', details: error.message },
      { status: 500 }
    );
  }
}

