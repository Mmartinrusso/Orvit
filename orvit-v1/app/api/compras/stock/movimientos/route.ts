import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { getViewMode, isExtendedMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
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

// GET - Listar movimientos de stock (Kardex)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const supplierItemId = searchParams.get('supplierItemId');
    const warehouseId = searchParams.get('warehouseId');
    const tipo = searchParams.get('tipo');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    // Construir where base
    const whereBase: Prisma.StockMovementWhereInput = {
      companyId,
      ...(supplierItemId && { supplierItemId: parseInt(supplierItemId) }),
      ...(warehouseId && { warehouseId: parseInt(warehouseId) }),
      ...(tipo && { tipo: tipo as any }),
      ...(fechaDesde && {
        createdAt: { gte: new Date(fechaDesde) }
      }),
      ...(fechaHasta && {
        createdAt: { lte: new Date(fechaHasta) }
      }),
    };

    // ViewMode filter: Standard excluye T2, Extended muestra todo
    // Usamos docType: { not: 'T2' } que incluye T1 y registros con docType no establecido
    const where: Prisma.StockMovementWhereInput = viewMode === MODE.STANDARD
      ? { ...whereBase, docType: { not: 'T2' } }
      : whereBase;

    const [movimientos, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          supplierItem: {
            select: {
              id: true,
              nombre: true,
              unidad: true,
              codigoProveedor: true,
              supplier: {
                select: { id: true, name: true }
              }
            }
          },
          warehouse: {
            select: { id: true, codigo: true, nombre: true }
          },
          goodsReceipt: {
            select: { id: true, numero: true }
          },
          purchaseReturn: {
            select: { id: true, numero: true }
          },
          transfer: {
            select: { id: true, numero: true }
          },
          adjustment: {
            select: { id: true, numero: true }
          },
          createdByUser: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockMovement.count({ where })
    ]);

    return NextResponse.json({
      data: movimientos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching movimientos de stock:', error);
    return NextResponse.json(
      { error: 'Error al obtener los movimientos de stock' },
      { status: 500 }
    );
  }
}

// POST - Crear ajuste manual de stock
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    // Get ViewMode - determina si el movimiento es T1 o T2
    const viewMode = getViewMode(request);
    const docType = isExtendedMode(viewMode) ? 'T2' : 'T1';

    const body = await request.json();
    const {
      supplierItemId,
      warehouseId,
      tipo, // 'AJUSTE_POSITIVO' o 'AJUSTE_NEGATIVO'
      cantidad,
      motivo,
      notas,
    } = body;

    // Validaciones
    if (!supplierItemId || !warehouseId || !cantidad || !motivo) {
      return NextResponse.json(
        { error: 'supplierItemId, warehouseId, cantidad y motivo son requeridos' },
        { status: 400 }
      );
    }

    if (!['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'].includes(tipo)) {
      return NextResponse.json(
        { error: 'El tipo debe ser AJUSTE_POSITIVO o AJUSTE_NEGATIVO' },
        { status: 400 }
      );
    }

    const cantidadDecimal = parseFloat(cantidad);
    if (cantidadDecimal <= 0) {
      return NextResponse.json(
        { error: 'La cantidad debe ser mayor a 0' },
        { status: 400 }
      );
    }

    // Verificar que el depósito existe
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: parseInt(warehouseId), companyId, isActive: true }
    });

    if (!warehouse) {
      return NextResponse.json({ error: 'Depósito no encontrado o inactivo' }, { status: 400 });
    }

    // Ejecutar en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // Obtener stock actual
      let stockLocation = await tx.stockLocation.findUnique({
        where: {
          warehouseId_supplierItemId: {
            warehouseId: parseInt(warehouseId),
            supplierItemId: parseInt(supplierItemId)
          }
        }
      });

      const cantidadAnterior = stockLocation?.cantidad || 0;
      let cantidadPosterior: number;

      if (tipo === 'AJUSTE_POSITIVO') {
        cantidadPosterior = parseFloat(cantidadAnterior.toString()) + cantidadDecimal;
      } else {
        cantidadPosterior = parseFloat(cantidadAnterior.toString()) - cantidadDecimal;
        if (cantidadPosterior < 0) {
          throw new Error('El ajuste resultaría en stock negativo');
        }
      }

      // Crear o actualizar stock location
      if (stockLocation) {
        await tx.stockLocation.update({
          where: { id: stockLocation.id },
          data: { cantidad: cantidadPosterior }
        });
      } else {
        if (tipo === 'AJUSTE_NEGATIVO') {
          throw new Error('No se puede hacer un ajuste negativo sin stock existente');
        }
        stockLocation = await tx.stockLocation.create({
          data: {
            warehouseId: parseInt(warehouseId),
            supplierItemId: parseInt(supplierItemId),
            cantidad: cantidadPosterior,
            cantidadReservada: 0,
            companyId
          }
        });
      }

      // Crear movimiento con docType según ViewMode
      const movimiento = await tx.stockMovement.create({
        data: {
          tipo: tipo as any,
          cantidad: cantidadDecimal,
          cantidadAnterior,
          cantidadPosterior,
          supplierItemId: parseInt(supplierItemId),
          warehouseId: parseInt(warehouseId),
          motivo,
          notas: notas || null,
          docType: docType as any, // T1 o T2 según ViewMode
          companyId,
          createdBy: user.id
        },
        include: {
          supplierItem: { select: { id: true, nombre: true, unidad: true } },
          warehouse: { select: { id: true, codigo: true, nombre: true } }
        }
      });

      // Registrar en auditoría con docType
      await tx.purchaseAuditLog.create({
        data: {
          entidad: 'stock_movement',
          entidadId: movimiento.id,
          accion: 'AJUSTE_MANUAL',
          datosAnteriores: { cantidad: cantidadAnterior },
          datosNuevos: { cantidad: cantidadPosterior, motivo },
          docType: docType as any, // Hereda del movimiento
          companyId,
          userId: user.id,
        }
      });

      return movimiento;
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error: any) {
    console.error('Error creating ajuste de stock:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear el ajuste de stock' },
      { status: 500 }
    );
  }
}
