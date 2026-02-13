import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

// PUT /api/compras/stock/ubicaciones/[id]/config
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const stockLocationId = parseInt(params.id);
    if (isNaN(stockLocationId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la ubicación existe y pertenece a la empresa
    const stockLocation = await prisma.stockLocation.findFirst({
      where: {
        id: stockLocationId,
        companyId
      }
    });

    if (!stockLocation) {
      return NextResponse.json({ error: 'Ubicación de stock no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const {
      stockMinimo,
      stockMaximo,
      puntoReposicion,
      criticidad,
      ubicacionFisica
    } = body;

    // Validaciones
    if (stockMinimo !== null && stockMinimo !== undefined) {
      const minimo = parseFloat(stockMinimo);
      if (isNaN(minimo) || minimo < 0) {
        return NextResponse.json({ error: 'Stock mínimo debe ser >= 0' }, { status: 400 });
      }
    }

    if (stockMaximo !== null && stockMaximo !== undefined) {
      const maximo = parseFloat(stockMaximo);
      if (isNaN(maximo) || maximo < 0) {
        return NextResponse.json({ error: 'Stock máximo debe ser >= 0' }, { status: 400 });
      }
    }

    if (stockMinimo && stockMaximo) {
      if (parseFloat(stockMinimo) > parseFloat(stockMaximo)) {
        return NextResponse.json({ error: 'Stock mínimo no puede ser mayor al máximo' }, { status: 400 });
      }
    }

    if (criticidad && !['A', 'B', 'C', 'CRITICO'].includes(criticidad)) {
      return NextResponse.json({ error: 'Criticidad inválida' }, { status: 400 });
    }

    // Actualizar
    const updated = await prisma.stockLocation.update({
      where: { id: stockLocationId },
      data: {
        stockMinimo: stockMinimo !== null && stockMinimo !== undefined ? parseFloat(stockMinimo) : null,
        stockMaximo: stockMaximo !== null && stockMaximo !== undefined ? parseFloat(stockMaximo) : null,
        puntoReposicion: puntoReposicion !== null && puntoReposicion !== undefined ? parseFloat(puntoReposicion) : null,
        criticidad: criticidad || null,
        ubicacionFisica: ubicacionFisica || null,
      },
      include: {
        supplierItem: {
          select: { id: true, nombre: true }
        },
        warehouse: {
          select: { id: true, codigo: true, nombre: true }
        }
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating stock location config:', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración de stock' },
      { status: 500 }
    );
  }
}
