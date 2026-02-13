import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: { company: true }
        }
      }
    });

    if (!user || !user.companies || user.companies.length === 0) return null;
    return {
      userId: user.id,
      companyId: user.companies[0].companyId,
    };
  } catch {
    return null;
  }
}

/**
 * POST - Duplicar una carga existente
 * Crea una nueva carga con los mismos items pero fecha actual
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const loadId = parseInt(params.id);
    if (isNaN(loadId)) {
      return NextResponse.json({ error: 'ID de carga inválido' }, { status: 400 });
    }

    // Obtener la carga original
    const originalLoad = await prisma.load.findFirst({
      where: {
        id: loadId,
        companyId: auth.companyId,
      },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
        truck: true,
      },
    });

    if (!originalLoad) {
      return NextResponse.json({ error: 'Carga no encontrada' }, { status: 404 });
    }

    // Crear la carga duplicada
    const duplicatedLoad = await prisma.load.create({
      data: {
        truckId: originalLoad.truckId,
        date: new Date(), // Fecha actual
        description: originalLoad.description
          ? `Copia de: ${originalLoad.description}`
          : `Copia de carga #${originalLoad.id}`,
        deliveryClient: originalLoad.deliveryClient,
        deliveryAddress: originalLoad.deliveryAddress,
        isCorralon: originalLoad.isCorralon,
        companyId: auth.companyId,
        items: {
          create: originalLoad.items.map((item, index) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            length: item.length,
            weight: item.weight,
            position: index,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
        truck: true,
      },
    });

    return NextResponse.json(duplicatedLoad, { status: 201 });
  } catch (error: any) {
    console.error('Error duplicating load:', error);
    return NextResponse.json(
      { error: 'Error al duplicar la carga', details: error.message },
      { status: 500 }
    );
  }
}
