import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StockMovementType } from '@prisma/client';

/**
 * GET /api/almacen/movements
 *
 * Query params:
 * - companyId: number (required)
 * - warehouseId: number (optional)
 * - supplierItemId: number (optional)
 * - tipo: StockMovementType (optional)
 * - fechaDesde: string ISO date (optional)
 * - fechaHasta: string ISO date (optional)
 * - page: number (optional, default: 1)
 * - pageSize: number (optional, default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const companyId = Number(searchParams.get('companyId'));
    if (!companyId || isNaN(companyId)) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = { companyId };

    const warehouseId = searchParams.get('warehouseId');
    if (warehouseId) where.warehouseId = Number(warehouseId);

    const supplierItemId = searchParams.get('supplierItemId');
    if (supplierItemId) where.supplierItemId = Number(supplierItemId);

    const tipo = searchParams.get('tipo');
    if (tipo && tipo !== 'all') {
      where.tipo = tipo as StockMovementType;
    }

    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    if (fechaDesde || fechaHasta) {
      where.createdAt = {};
      if (fechaDesde) {
        where.createdAt.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        // Add one day to include the entire end date
        const endDate = new Date(fechaHasta);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt.lt = endDate;
      }
    }

    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 50;

    const [movimientos, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          supplierItem: {
            select: {
              id: true,
              nombre: true,
              codigoProveedor: true,
              unidad: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
            },
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    // Transform to match frontend expected format
    const transformedMovimientos = movimientos.map((m) => ({
      id: m.id,
      fecha: m.createdAt.toISOString(),
      tipo: m.tipo,
      cantidad: Number(m.cantidad),
      stockAnterior: Number(m.cantidadAnterior),
      stockPosterior: Number(m.cantidadPosterior),
      costoUnitario: m.costoUnitario ? Number(m.costoUnitario) : null,
      costoTotal: m.costoTotal ? Number(m.costoTotal) : null,
      referencia: m.sourceNumber || null,
      notas: m.notas || m.motivo || null,
      supplierItem: {
        id: m.supplierItem.id,
        code: m.supplierItem.codigoProveedor,
        name: m.supplierItem.nombre,
        unit: m.supplierItem.unidad,
      },
      warehouse: {
        id: m.warehouse.id,
        nombre: m.warehouse.nombre,
        codigo: m.warehouse.codigo,
      },
      usuario: m.createdByUser
        ? {
            id: m.createdByUser.id,
            name: m.createdByUser.name,
          }
        : null,
    }));

    return NextResponse.json({
      movimientos: transformedMovimientos,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error en GET /api/almacen/movements:', error);
    return NextResponse.json(
      { error: 'Error al obtener movimientos' },
      { status: 500 }
    );
  }
}
