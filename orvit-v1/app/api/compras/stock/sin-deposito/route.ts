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
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

/**
 * GET /api/compras/stock/sin-deposito
 *
 * Obtiene items del Stock simple que NO tienen StockLocation asignado.
 * Estos son items que entraron por comprobantes pero no se les asignó depósito.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario sin empresa asignada' }, { status: 400 });
    }

    // Obtener todos los Stock que NO tienen ningún StockLocation
    const stockSinDeposito = await prisma.stock.findMany({
      where: {
        companyId,
        supplierItem: {
          stockLocations: {
            none: {}
          }
        }
      },
      include: {
        supplierItem: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              }
            },
            supply: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: {
        ultimaActualizacion: 'desc'
      }
    });

    const data = stockSinDeposito.map(stock => ({
      id: stock.id,
      supplierItemId: stock.supplierItemId,
      cantidad: Number(stock.cantidad),
      unidad: stock.unidad,
      precioUnitario: Number(stock.precioUnitario),
      ultimaActualizacion: stock.ultimaActualizacion,
      supplierItem: stock.supplierItem ? {
        id: stock.supplierItem.id,
        nombre: stock.supplierItem.nombre,
        unidad: stock.supplierItem.unidad,
        codigoProveedor: stock.supplierItem.codigoProveedor,
        supplier: stock.supplierItem.supplier,
      } : null,
    }));

    return NextResponse.json({
      data,
      total: data.length,
    });
  } catch (error) {
    console.error('Error fetching stock sin deposito:', error);
    return NextResponse.json(
      { error: 'Error al obtener stock sin deposito' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compras/stock/sin-deposito
 *
 * Asigna un depósito a un item que está en Stock pero no tiene StockLocation.
 * Crea el StockLocation y opcionalmente un StockMovement.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario sin empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const { supplierItemId, warehouseId, stockMinimo, stockMaximo } = body;

    if (!supplierItemId || !warehouseId) {
      return NextResponse.json(
        { error: 'supplierItemId y warehouseId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el warehouse existe y pertenece a la empresa
    const warehouse = await prisma.warehouse.findFirst({
      where: {
        id: warehouseId,
        companyId,
        isTransit: false,
      }
    });

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Depósito no encontrado o no válido' },
        { status: 400 }
      );
    }

    // Verificar que el Stock existe
    const stock = await prisma.stock.findUnique({
      where: { supplierItemId },
      include: {
        supplierItem: true,
      }
    });

    if (!stock) {
      return NextResponse.json(
        { error: 'Stock no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que no exista ya un StockLocation para este item en este warehouse
    const existingLocation = await prisma.stockLocation.findFirst({
      where: {
        supplierItemId,
        warehouseId,
        companyId,
      }
    });

    if (existingLocation) {
      return NextResponse.json(
        { error: 'Este item ya tiene stock en este depósito' },
        { status: 400 }
      );
    }

    const cantidad = Number(stock.cantidad);
    const costoUnitario = Number(stock.precioUnitario);

    // Crear StockLocation y StockMovement en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear StockLocation
      const stockLocation = await tx.stockLocation.create({
        data: {
          warehouseId,
          supplierItemId,
          cantidad,
          cantidadReservada: 0,
          stockMinimo: stockMinimo || null,
          stockMaximo: stockMaximo || null,
          costoUnitario,
          companyId,
        }
      });

      // Crear movimiento de entrada (asignación inicial)
      await tx.stockMovement.create({
        data: {
          tipo: 'ENTRADA_RECEPCION',
          cantidad,
          cantidadAnterior: 0,
          cantidadPosterior: cantidad,
          supplierItemId,
          warehouseId,
          motivo: 'Asignación inicial de depósito',
          companyId,
          createdBy: user.id,
        }
      });

      return stockLocation;
    });

    return NextResponse.json({
      success: true,
      stockLocation: result,
      message: `Item asignado al depósito ${warehouse.codigo}`,
    });
  } catch (error) {
    console.error('Error asignando deposito:', error);
    return NextResponse.json(
      { error: 'Error al asignar depósito' },
      { status: 500 }
    );
  }
}
