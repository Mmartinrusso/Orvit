import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Caché
const stockCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1 * 60 * 1000;

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
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

// GET - Obtener niveles de stock por depósito
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
    const warehouseId = searchParams.get('warehouseId');
    const supplierItemId = searchParams.get('supplierItemId');
    const proveedorId = searchParams.get('proveedorId');
    const stockBajo = searchParams.get('stockBajo');
    const search = searchParams.get('search');

    // ViewMode: Standard oculta items comprados via T2
    const viewMode = getViewMode(request);

    // Obtener IDs de items T2 si estamos en Standard mode
    let t2ItemIds: number[] = [];
    if (viewMode === MODE.STANDARD) {
      const t2Items = await prisma.stockMovement.findMany({
        where: {
          companyId,
          docType: 'T2',
          tipo: 'ENTRADA_RECEPCION'
        },
        select: { supplierItemId: true },
        distinct: ['supplierItemId']
      });
      t2ItemIds = t2Items.map(i => i.supplierItemId);
    }

    const where: Prisma.StockLocationWhereInput = {
      companyId,
      ...(warehouseId && { warehouseId: parseInt(warehouseId) }),
      ...(supplierItemId && { supplierItemId: parseInt(supplierItemId) }),
      ...(proveedorId && {
        supplierItem: { supplierId: parseInt(proveedorId) }
      }),
      ...(search && {
        OR: [
          // Buscar en los códigos reales almacenados en StockLocation
          { codigoPropio: { contains: search, mode: 'insensitive' } },
          { codigoProveedor: { contains: search, mode: 'insensitive' } },
          { descripcionItem: { contains: search, mode: 'insensitive' } },
          // Fallback a los datos del supplierItem
          { supplierItem: { nombre: { contains: search, mode: 'insensitive' } } },
          { supplierItem: { codigoProveedor: { contains: search, mode: 'insensitive' } } },
          { supplierItem: { supply: { code: { contains: search, mode: 'insensitive' } } } },
          { supplierItem: { supply: { name: { contains: search, mode: 'insensitive' } } } },
        ]
      }),
      // ViewMode: Excluir items T2 en Standard mode
      ...(t2ItemIds.length > 0 && { supplierItemId: { notIn: t2ItemIds } }),
    };

    // Verificar caché (incluir viewMode en cacheKey)
    const cacheKey = `stock-ubicaciones-${companyId}-${warehouseId || 'all'}-${page}-${viewMode}`;
    if (!search && !stockBajo) {
      const cached = stockCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } });
      }
    }

    const [stockLocations, total] = await Promise.all([
      prisma.stockLocation.findMany({
        where,
        select: {
          id: true,
          warehouseId: true,
          supplierItemId: true,
          cantidad: true,
          cantidadReservada: true,
          stockMinimo: true,
          stockMaximo: true,
          costoUnitario: true,
          criticidad: true,
          ubicacion: true,
          // Campos del último movimiento (códigos reales)
          codigoPropio: true,
          codigoProveedor: true,
          descripcionItem: true,
          warehouse: {
            select: { id: true, codigo: true, nombre: true }
          },
          supplierItem: {
            select: {
              id: true,
              nombre: true,
              unidad: true,
              codigoProveedor: true,
              precioUnitario: true,
              supplier: {
                select: { id: true, name: true }
              },
              supply: {
                select: { id: true, code: true, name: true }
              }
            }
          }
        },
        orderBy: [
          { warehouse: { nombre: 'asc' } },
          { supplierItem: { nombre: 'asc' } }
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockLocation.count({ where })
    ]);

    // Enriquecer con alertas
    const stockConAlertas = stockLocations.map(sl => {
      const cantidad = parseFloat(sl.cantidad.toString());
      const stockMinimo = sl.stockMinimo ? parseFloat(sl.stockMinimo.toString()) : null;
      const stockMaximo = sl.stockMaximo ? parseFloat(sl.stockMaximo.toString()) : null;

      return {
        ...sl,
        alertas: {
          stockBajo: stockMinimo !== null && cantidad <= stockMinimo,
          stockAlto: stockMaximo !== null && cantidad >= stockMaximo,
          sinStock: cantidad <= 0
        }
      };
    });

    // Filtrar por stock bajo si se pidió
    let stockFiltrado = stockConAlertas;
    if (stockBajo === 'true') {
      stockFiltrado = stockConAlertas.filter(s => s.alertas.stockBajo || s.alertas.sinStock);
    }

    const result = {
      data: stockFiltrado,
      pagination: {
        page,
        limit,
        total: stockBajo === 'true' ? stockFiltrado.length : total,
        totalPages: Math.ceil((stockBajo === 'true' ? stockFiltrado.length : total) / limit)
      }
    };

    // Guardar en caché
    if (!search && !stockBajo) {
      stockCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching stock ubicaciones:', error);
    return NextResponse.json(
      { error: 'Error al obtener el stock' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar parámetros de stock (mínimo, máximo, ubicación)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const { warehouseId, supplierItemId, stockMinimo, stockMaximo, ubicacion } = body;

    if (!warehouseId || !supplierItemId) {
      return NextResponse.json(
        { error: 'warehouseId y supplierItemId son requeridos' },
        { status: 400 }
      );
    }

    // Buscar o crear el registro
    let stockLocation = await prisma.stockLocation.findUnique({
      where: {
        warehouseId_supplierItemId: {
          warehouseId: parseInt(warehouseId),
          supplierItemId: parseInt(supplierItemId)
        }
      }
    });

    if (stockLocation) {
      // Verificar que pertenece a la empresa
      if (stockLocation.companyId !== companyId) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      stockLocation = await prisma.stockLocation.update({
        where: { id: stockLocation.id },
        data: {
          ...(stockMinimo !== undefined && { stockMinimo: stockMinimo ? parseFloat(stockMinimo) : null }),
          ...(stockMaximo !== undefined && { stockMaximo: stockMaximo ? parseFloat(stockMaximo) : null }),
          ...(ubicacion !== undefined && { ubicacion }),
        },
        include: {
          warehouse: { select: { id: true, codigo: true, nombre: true } },
          supplierItem: { select: { id: true, nombre: true, unidad: true } }
        }
      });
    } else {
      // Crear nuevo registro con cantidad 0
      stockLocation = await prisma.stockLocation.create({
        data: {
          warehouseId: parseInt(warehouseId),
          supplierItemId: parseInt(supplierItemId),
          cantidad: 0,
          cantidadReservada: 0,
          stockMinimo: stockMinimo ? parseFloat(stockMinimo) : null,
          stockMaximo: stockMaximo ? parseFloat(stockMaximo) : null,
          ubicacion: ubicacion || null,
          companyId
        },
        include: {
          warehouse: { select: { id: true, codigo: true, nombre: true } },
          supplierItem: { select: { id: true, nombre: true, unidad: true } }
        }
      });
    }

    // Invalidar caché
    for (const key of stockCache.keys()) {
      if (key.startsWith(`stock-ubicaciones-${companyId}`)) {
        stockCache.delete(key);
      }
    }

    return NextResponse.json(stockLocation);
  } catch (error) {
    console.error('Error updating stock ubicacion:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la ubicación de stock' },
      { status: 500 }
    );
  }
}
