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

// GET - Obtener una carga por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const load = await prisma.load.findFirst({
      where: {
        id: parseInt(params.id),
        companyId: auth.companyId,
      },
      include: {
        truck: true,
        items: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Carga no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(load);
  } catch (error) {
    console.error('Error al obtener carga:', error);
    return NextResponse.json(
      { error: 'Error al obtener carga' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar una carga
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
    const { truckId, date, description, deliveryClient, deliveryAddress, isCorralon, items } = body;

    // Verificar que la carga existe y pertenece a la empresa
    const existingLoad = await prisma.load.findFirst({
      where: {
        id: parseInt(params.id),
        companyId: auth.companyId,
      },
    });

    if (!existingLoad) {
      return NextResponse.json(
        { error: 'Carga no encontrada' },
        { status: 404 }
      );
    }

    // Si se proporciona truckId, verificar que existe
    if (truckId) {
      const truck = await prisma.truck.findFirst({
        where: {
          id: parseInt(truckId),
          companyId: auth.companyId,
        },
      });

      if (!truck) {
        return NextResponse.json(
          { error: 'Camión no encontrado' },
          { status: 404 }
        );
      }
    }

    // Actualizar la carga
    const updateData: any = {};
    if (truckId !== undefined) updateData.truckId = parseInt(truckId);
    if (date !== undefined) updateData.date = new Date(date);
    if (description !== undefined) updateData.description = description;
    if (deliveryClient !== undefined) updateData.deliveryClient = deliveryClient || null;
    if (deliveryAddress !== undefined) updateData.deliveryAddress = deliveryAddress || null;
    if (isCorralon !== undefined) updateData.isCorralon = isCorralon || false;

    // Si se proporcionan items, actualizarlos
    if (items && Array.isArray(items)) {
      // Eliminar items existentes
      await prisma.loadItem.deleteMany({
        where: {
          loadId: parseInt(params.id),
        },
      });

      // Crear nuevos items
      updateData.items = {
        create: items.map((item: any, index: number) => ({
          productId: item.productId,
          productName: item.productName || '',
          quantity: parseInt(item.quantity) || 1,
          length: item.length ? parseFloat(item.length) : null,
          weight: item.weight ? parseFloat(item.weight) : null,
          position: item.position !== undefined ? parseInt(item.position) : index,
          notes: item.notes || null,
        })),
      };
    }

    const load = await prisma.load.update({
      where: {
        id: parseInt(params.id),
      },
      data: updateData,
      include: {
        truck: true,
        items: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    return NextResponse.json(load);
  } catch (error) {
    console.error('Error al actualizar carga:', error);
    return NextResponse.json(
      { error: 'Error al actualizar carga' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar una carga
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que la carga existe usando SQL raw para evitar problemas con internalId
    let load: any = null;
    try {
      const loads = await prisma.$queryRaw`
        SELECT id, "companyId"
        FROM "Load"
        WHERE id = ${parseInt(params.id)} AND "companyId" = ${auth.companyId}
        LIMIT 1
      ` as any[];
      load = loads[0] || null;
    } catch (sqlError: any) {
      // Si falla SQL raw, intentar con Prisma Client
      try {
        load = await prisma.load.findFirst({
          where: {
            id: parseInt(params.id),
            companyId: auth.companyId,
          },
        });
      } catch (prismaError) {
        load = null;
      }
    }

    if (!load) {
      return NextResponse.json(
        { error: 'Carga no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar items primero (cascade debería hacerlo, pero por seguridad)
    try {
      await prisma.loadItem.deleteMany({
        where: {
          loadId: parseInt(params.id),
        },
      });
    } catch (itemError: any) {
      // Si falla, intentar con SQL raw
      if (itemError.code === 'P2021' || itemError.message?.includes('does not exist') || itemError.message?.includes('Unknown model')) {
        try {
          await prisma.$executeRaw`
            DELETE FROM "LoadItem"
            WHERE "loadId" = ${parseInt(params.id)}
          `;
        } catch (rawItemError) {
          console.warn('Error eliminando items con SQL raw:', rawItemError);
          // Continuar de todas formas
        }
      } else {
        throw itemError;
      }
    }

    // Eliminar la carga
    try {
      await prisma.load.delete({
        where: {
          id: parseInt(params.id),
        },
      });
    } catch (deleteError: any) {
      // Si falla, intentar con SQL raw
      if (deleteError.code === 'P2021' || 
          deleteError.message?.includes('does not exist') || 
          deleteError.message?.includes('Unknown model') ||
          deleteError.message?.includes('model Load')) {
        try {
          await prisma.$executeRaw`
            DELETE FROM "Load"
            WHERE id = ${parseInt(params.id)} AND "companyId" = ${auth.companyId}
          `;
        } catch (rawError) {
          console.error('Error eliminando carga con SQL raw:', rawError);
          throw rawError;
        }
      } else {
        throw deleteError;
      }
    }

    return NextResponse.json({ message: 'Carga eliminada correctamente' });
  } catch (error: any) {
    console.error('Error al eliminar carga:', error);
    return NextResponse.json(
      { error: 'Error al eliminar carga', details: error.message },
      { status: 500 }
    );
  }
}

