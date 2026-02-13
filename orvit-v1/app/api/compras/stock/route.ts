import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { withStockGuards } from '@/lib/modules';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Caché en memoria para stock (2 minutos TTL)
const stockCache = new Map<string, { data: any; timestamp: number }>();
const STOCK_CACHE_TTL = 2 * 60 * 1000;

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

// GET /api/compras/stock - Obtener stock (por ubicaciones)
// Protegido por módulos purchases_core + stock_management
export const GET = withStockGuards(async (request: NextRequest) => {
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
    const search = searchParams.get('search');
    const proveedorId = searchParams.get('proveedorId');
    const warehouseId = searchParams.get('warehouseId');
    const criticidad = searchParams.get('criticidad');
    const alerta = searchParams.get('alerta'); // 'bajo', 'sin', 'exceso', 'normal'
    const forceRefresh = searchParams.get('_refresh') === 'true';

    // ViewMode: Standard oculta items comprados via T2
    const viewMode = getViewMode(request);

    // Verificar caché para consultas sin filtros complejos (incluye viewMode)
    const cacheKey = `stock-${companyId}-${warehouseId || 'all'}-${page}-${viewMode}`;
    if (!forceRefresh && !search && !proveedorId && !criticidad && !alerta) {
      const cached = stockCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < STOCK_CACHE_TTL) {
        return NextResponse.json(cached.data, {
          headers: { 'X-Cache': 'HIT' }
        });
      }
    }

    // Construir where clause
    const where: Prisma.StockLocationWhereInput = {
      companyId,
      // Excluir warehouse de tránsito de la vista normal
      warehouse: {
        isTransit: false
      }
    };

    if (warehouseId) {
      where.warehouseId = parseInt(warehouseId);
    }

    if (proveedorId) {
      where.supplierItem = {
        supplierId: parseInt(proveedorId)
      };
    }

    if (criticidad) {
      where.criticidad = criticidad;
    }

    if (search) {
      // Buscar en descripcionItem (StockLocation) Y en supplierItem
      where.OR = [
        { descripcionItem: { contains: search, mode: 'insensitive' } },
        { codigoPropio: { contains: search, mode: 'insensitive' } },
        { codigoProveedor: { contains: search, mode: 'insensitive' } },
        { supplierItem: { nombre: { contains: search, mode: 'insensitive' } } },
        { supplierItem: { codigoProveedor: { contains: search, mode: 'insensitive' } } },
        { supplierItem: { supplier: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    // =================================================================
    // BD T2 SEPARADA: En modo Standard, siempre excluir items T2
    // Los items T2 ahora están en BD separada
    // En modo Extended, el frontend consulta BD T2 por separado
    // =================================================================
    if (viewMode === MODE.STANDARD) {
      // Obtener IDs de items que tenían movimientos T2 (legacy en BD principal)
      const t2Items = await prisma.stockMovement.findMany({
        where: {
          companyId,
          docType: 'T2',
          tipo: 'ENTRADA_RECEPCION'
        },
        select: { supplierItemId: true },
        distinct: ['supplierItemId']
      });

      const t2ItemIds = t2Items.map(i => i.supplierItemId);

      if (t2ItemIds.length > 0) {
        where.supplierItemId = {
          notIn: t2ItemIds
        };
      }
    }

    // Obtener stock locations
    const [stockLocations, total] = await Promise.all([
      prisma.stockLocation.findMany({
        where,
        include: {
          supplierItem: {
            select: {
              id: true,
              nombre: true,
              codigoProveedor: true,
              unidad: true,
              supplier: {
                select: {
                  id: true,
                  name: true,
                  razon_social: true
                }
              }
            }
          },
          warehouse: {
            select: {
              id: true,
              codigo: true,
              nombre: true
            }
          }
        },
        orderBy: [
          { cantidad: 'asc' }, // Primero los de menor stock
          { updatedAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.stockLocation.count({ where })
    ]);

    // Calcular "en camino" para cada item (OC pendientes de recibir)
    const supplierItemIds = stockLocations.map(s => s.supplierItemId);

    const enCaminoByItem = new Map<number, number>();
    if (supplierItemIds.length > 0) {
      const ocPendientes = await prisma.purchaseOrderItem.findMany({
        where: {
          supplierItemId: { in: supplierItemIds },
          purchaseOrder: {
            companyId,
            estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA'] }
          }
        },
        select: {
          supplierItemId: true,
          cantidad: true,
          cantidadRecibida: true
        }
      });

      for (const item of ocPendientes) {
        const pendiente = Number(item.cantidad || 0) - Number(item.cantidadRecibida || 0);
        if (pendiente > 0) {
          const current = enCaminoByItem.get(item.supplierItemId) || 0;
          enCaminoByItem.set(item.supplierItemId, current + pendiente);
        }
      }
    }

    // Transformar datos con campos calculados
    const data = stockLocations.map(loc => {
      const cantidad = Number(loc.cantidad || 0);
      const reservado = Number(loc.cantidadReservada || 0);
      const minimo = Number(loc.stockMinimo || 0);
      const maximo = Number(loc.stockMaximo || 0);
      const costo = Number(loc.costoUnitario || 0);
      const enCamino = enCaminoByItem.get(loc.supplierItemId) || 0;
      const disponible = cantidad - reservado;

      // Determinar estado de alerta
      let alertaEstado: 'sin_stock' | 'bajo_stock' | 'exceso' | 'normal' = 'normal';
      if (cantidad <= 0) {
        alertaEstado = 'sin_stock';
      } else if (minimo > 0 && (disponible + enCamino) < minimo) {
        alertaEstado = 'bajo_stock';
      } else if (maximo > 0 && cantidad > maximo) {
        alertaEstado = 'exceso';
      }

      return {
        id: loc.id,
        supplierItemId: loc.supplierItemId,
        // Usar descripcionItem de StockLocation como prioridad, fallback a supplierItem.nombre
        supplierItemNombre: loc.descripcionItem || loc.supplierItem?.nombre || '',
        supplierItemCodigo: loc.codigoProveedor || loc.supplierItem?.codigoProveedor || '',
        descripcionItem: loc.descripcionItem || '',
        unidad: loc.supplierItem?.unidad || 'UN',
        proveedorId: loc.supplierItem?.supplier?.id,
        proveedorNombre: loc.supplierItem?.supplier?.razon_social || loc.supplierItem?.supplier?.name || '',
        warehouseId: loc.warehouseId,
        warehouseCodigo: loc.warehouse?.codigo || '',
        warehouseNombre: loc.warehouse?.nombre || '',
        cantidad,
        cantidadReservada: reservado,
        enCamino,
        disponible,
        stockMinimo: minimo,
        stockMaximo: maximo,
        puntoReposicion: Number(loc.puntoReposicion || 0),
        costoUnitario: costo,
        valor: Math.round(cantidad * costo * 100) / 100,
        criticidad: loc.criticidad,
        ubicacionFisica: loc.ubicacionFisica,
        alertaEstado,
        updatedAt: loc.updatedAt
      };
    });

    // Filtrar por alerta si se especificó
    let filteredData = data;
    if (alerta) {
      filteredData = data.filter(item => {
        switch (alerta) {
          case 'bajo': return item.alertaEstado === 'bajo_stock';
          case 'sin': return item.alertaEstado === 'sin_stock';
          case 'exceso': return item.alertaEstado === 'exceso';
          case 'normal': return item.alertaEstado === 'normal';
          default: return true;
        }
      });
    }

    const result = {
      data: filteredData,
      pagination: {
        page,
        limit,
        total: alerta ? filteredData.length : total,
        totalPages: Math.ceil((alerta ? filteredData.length : total) / limit)
      }
    };

    // Guardar en caché si no hay filtros complejos
    if (!search && !proveedorId && !criticidad && !alerta) {
      stockCache.set(cacheKey, { data: result, timestamp: Date.now() });

      // Limpiar caché antiguo
      if (stockCache.size > 50) {
        const now = Date.now();
        for (const [key, value] of stockCache.entries()) {
          if (now - value.timestamp > STOCK_CACHE_TTL) {
            stockCache.delete(key);
          }
        }
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('Error fetching stock:', error);
    return NextResponse.json(
      { error: 'Error al obtener el stock' },
      { status: 500 }
    );
  }
});
