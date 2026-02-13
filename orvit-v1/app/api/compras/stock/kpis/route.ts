import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Caché para KPIs (1 minuto TTL - datos agregados)
const kpisCache = new Map<string, { data: any; timestamp: number }>();
const KPIS_CACHE_TTL = 60 * 1000;

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

interface StockKPIs {
  totalItems: number;
  valorTotal: number;
  itemsBajoStock: number;
  itemsSinStock: number;
  valorEnTransito: number;
  porWarehouse: Array<{
    warehouseId: number;
    codigo: string;
    nombre: string;
    totalItems: number;
    valorTotal: number;
    bajoStock: number;
  }>;
}

// GET /api/compras/stock/kpis
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
    const forceRefresh = searchParams.get('_refresh') === 'true';

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    // Verificar caché (incluir viewMode)
    const cacheKey = `stock-kpis-${companyId}-${viewMode}`;
    if (!forceRefresh) {
      const cached = kpisCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < KPIS_CACHE_TTL) {
        return NextResponse.json(cached.data, {
          headers: { 'X-Cache': 'HIT' }
        });
      }
    }

    // Obtener todos los warehouses
    const warehouses = await prisma.warehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true, codigo: true, nombre: true, isTransit: true }
    });

    const transitWarehouse = warehouses.find(w => w.isTransit);
    const normalWarehouses = warehouses.filter(w => !w.isTransit);

    // ViewMode: En Standard mode, excluir items que tienen movimientos T2
    // Si un item se compró vía T2, todo su stock es T2
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

    // Calcular stock actual desde StockMovement
    // Agrupamos por supplierItemId + warehouseId y sumamos cantidades
    const stockByLocation = new Map<string, {
      supplierItemId: number;
      warehouseId: number;
      cantidad: number;
      costoUnitario: number;
    }>();

    // Obtener todos los movimientos de stock (excluyendo items T2 en Standard mode)
    const movements = await prisma.stockMovement.findMany({
      where: {
        companyId,
        // En Standard mode, excluir items que tienen entradas T2
        ...(t2ItemIds.length > 0 && { supplierItemId: { notIn: t2ItemIds } })
      },
      select: {
        supplierItemId: true,
        warehouseId: true,
        tipo: true,
        cantidad: true,
        costoUnitario: true
      }
    });

    // Procesar movimientos para calcular stock actual
    for (const mov of movements) {
      const key = `${mov.supplierItemId}-${mov.warehouseId}`;
      const existing = stockByLocation.get(key);

      // Determinar si suma o resta según el tipo de movimiento
      const isIngreso = ['RECEPCION', 'AJUSTE_POSITIVO', 'TRANSFERENCIA_ENTRADA', 'DEVOLUCION_CLIENTE'].includes(mov.tipo);
      const cantidadMov = Number(mov.cantidad || 0);
      const delta = isIngreso ? cantidadMov : -cantidadMov;

      if (existing) {
        existing.cantidad += delta;
        // Actualizar costo si hay uno nuevo
        if (mov.costoUnitario && Number(mov.costoUnitario) > 0) {
          existing.costoUnitario = Number(mov.costoUnitario);
        }
      } else {
        stockByLocation.set(key, {
          supplierItemId: mov.supplierItemId,
          warehouseId: mov.warehouseId,
          cantidad: delta,
          costoUnitario: Number(mov.costoUnitario || 0)
        });
      }
    }

    // Obtener configuración de stock (mínimos, reservados) desde StockLocation
    const stockConfigs = await prisma.stockLocation.findMany({
      where: { companyId },
      select: {
        supplierItemId: true,
        warehouseId: true,
        cantidadReservada: true,
        stockMinimo: true,
        costoUnitario: true,
        warehouse: { select: { isTransit: true } }
      }
    });

    const configByKey = new Map<string, typeof stockConfigs[0]>();
    for (const cfg of stockConfigs) {
      configByKey.set(`${cfg.supplierItemId}-${cfg.warehouseId}`, cfg);
    }

    // Calcular "en camino" por supplierItem (qty en OC pendientes de recibir)
    // También excluir items T2 en Standard mode
    const enCaminoByItem = new Map<number, number>();

    const ocPendientes = await prisma.purchaseOrderItem.findMany({
      where: {
        purchaseOrder: {
          companyId,
          estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA'] as const }
        },
        // En Standard mode, excluir items que tienen entradas T2
        ...(t2ItemIds.length > 0 && { supplierItemId: { notIn: t2ItemIds } })
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

    // Calcular KPIs
    let totalItems = 0;
    let valorTotal = 0;
    let itemsBajoStock = 0;
    let itemsSinStock = 0;
    let valorEnTransito = 0;

    const warehouseStats = new Map<number, { totalItems: number; valorTotal: number; bajoStock: number }>();

    // Inicializar stats por warehouse
    for (const wh of normalWarehouses) {
      warehouseStats.set(wh.id, { totalItems: 0, valorTotal: 0, bajoStock: 0 });
    }

    // Procesar cada ubicación de stock calculada
    for (const [key, loc] of stockByLocation.entries()) {
      const config = configByKey.get(key);
      const cantidad = loc.cantidad;
      const reservado = Number(config?.cantidadReservada || 0);
      const costo = loc.costoUnitario || Number(config?.costoUnitario || 0);
      const minimo = Number(config?.stockMinimo || 0);
      const enCamino = enCaminoByItem.get(loc.supplierItemId) || 0;
      const isTransit = config?.warehouse?.isTransit || false;

      const valor = cantidad * costo;
      const disponible = cantidad - reservado;

      // Si es warehouse de tránsito
      if (isTransit) {
        valorEnTransito += Math.max(0, valor);
        continue;
      }

      // Conteos generales (solo items con stock > 0 o que tuvieron movimientos)
      totalItems++;
      valorTotal += Math.max(0, valor);

      // Sin stock
      if (cantidad <= 0) {
        itemsSinStock++;
      }

      // Bajo stock: disponible + enCamino < minimo
      if (minimo > 0 && (disponible + enCamino) < minimo) {
        itemsBajoStock++;
      }

      // Stats por warehouse
      const whStats = warehouseStats.get(loc.warehouseId);
      if (whStats) {
        whStats.totalItems++;
        whStats.valorTotal += Math.max(0, valor);
        if (minimo > 0 && (disponible + enCamino) < minimo) {
          whStats.bajoStock++;
        }
      }
    }

    // Construir respuesta
    const kpis: StockKPIs = {
      totalItems,
      valorTotal: Math.round(valorTotal * 100) / 100,
      itemsBajoStock,
      itemsSinStock,
      valorEnTransito: Math.round(valorEnTransito * 100) / 100,
      porWarehouse: normalWarehouses.map(wh => {
        const stats = warehouseStats.get(wh.id) || { totalItems: 0, valorTotal: 0, bajoStock: 0 };
        return {
          warehouseId: wh.id,
          codigo: wh.codigo,
          nombre: wh.nombre,
          totalItems: stats.totalItems,
          valorTotal: Math.round(stats.valorTotal * 100) / 100,
          bajoStock: stats.bajoStock
        };
      })
    };

    // Guardar en caché
    kpisCache.set(cacheKey, { data: kpis, timestamp: Date.now() });

    // Limpiar caché antiguo
    if (kpisCache.size > 20) {
      const now = Date.now();
      for (const [key, value] of kpisCache.entries()) {
        if (now - value.timestamp > KPIS_CACHE_TTL) {
          kpisCache.delete(key);
        }
      }
    }

    return NextResponse.json(kpis, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('Error fetching stock KPIs:', error);
    return NextResponse.json(
      { error: 'Error al obtener KPIs de stock' },
      { status: 500 }
    );
  }
}
