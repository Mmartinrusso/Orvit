import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

// GET - Ranking de productos más vendidos
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const limite = parseInt(searchParams.get('limite') || '20');
    const ordenarPor = searchParams.get('ordenarPor') || 'monto'; // 'monto' | 'cantidad' | 'frecuencia'
    const categoriaId = searchParams.get('categoriaId');

    const dateFilter = {
      ...(fechaDesde && { gte: new Date(fechaDesde) }),
      ...(fechaHasta && { lte: new Date(fechaHasta) }),
    };

    // Obtener items de órdenes de venta
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: applyViewMode({
          companyId,
          ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
          estado: { notIn: ['CANCELADA'] },
        }, viewMode),
        productId: { not: null },
        ...(categoriaId && { product: { categoryId: categoriaId } }),
      },
      select: {
        productId: true,
        descripcion: true,
        cantidad: true,
        precioUnitario: true,
        subtotal: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            cost: true,
            category: { select: { id: true, name: true } },
          },
        },
        sale: {
          select: {
            id: true,
            fechaEmision: true,
            client: { select: { id: true, legalName: true, name: true } },
          },
        },
      },
    });

    // Agrupar por producto
    const productosMap = new Map<string, {
      producto: {
        id: string;
        nombre: string;
        sku: string | null;
        precioActual: number;
        costo: number | null;
        categoria: { id: string; name: string } | null;
      };
      cantidadVendida: number;
      montoTotal: number;
      ordenesCount: number;
      clientesUnicos: Set<string>;
      precioPromedio: number;
      ultimaVenta: Date | null;
    }>();

    saleItems.forEach(item => {
      if (!item.productId || !item.product) return;

      const key = item.productId;
      if (!productosMap.has(key)) {
        productosMap.set(key, {
          producto: {
            id: item.product.id,
            nombre: item.product.name,
            sku: item.product.sku,
            precioActual: Number(item.product.price) || 0,
            costo: item.product.cost ? Number(item.product.cost) : null,
            categoria: item.product.category,
          },
          cantidadVendida: 0,
          montoTotal: 0,
          ordenesCount: 0,
          clientesUnicos: new Set(),
          precioPromedio: 0,
          ultimaVenta: null,
        });
      }

      const entry = productosMap.get(key)!;
      entry.cantidadVendida += Number(item.cantidad);
      entry.montoTotal += Number(item.subtotal);
      entry.ordenesCount++;
      if (item.sale.client) {
        entry.clientesUnicos.add(item.sale.client.id);
      }
      const fechaVenta = new Date(item.sale.fechaEmision);
      if (!entry.ultimaVenta || fechaVenta > entry.ultimaVenta) {
        entry.ultimaVenta = fechaVenta;
      }
    });

    // Calcular precio promedio
    productosMap.forEach(entry => {
      entry.precioPromedio = entry.cantidadVendida > 0
        ? Math.round(entry.montoTotal / entry.cantidadVendida)
        : 0;
    });

    // Convertir a array
    const productosArray = Array.from(productosMap.values()).map(p => ({
      producto: p.producto,
      metricas: {
        cantidadVendida: p.cantidadVendida,
        montoTotal: p.montoTotal,
        ordenesCount: p.ordenesCount,
        clientesUnicos: p.clientesUnicos.size,
        precioPromedio: p.precioPromedio,
        margenEstimado: p.producto.costo
          ? Math.round(((p.precioPromedio - p.producto.costo) / p.precioPromedio) * 100)
          : null,
        ultimaVenta: p.ultimaVenta,
      },
    }));

    // Ordenar según criterio
    productosArray.sort((a, b) => {
      switch (ordenarPor) {
        case 'cantidad':
          return b.metricas.cantidadVendida - a.metricas.cantidadVendida;
        case 'frecuencia':
          return b.metricas.ordenesCount - a.metricas.ordenesCount;
        case 'monto':
        default:
          return b.metricas.montoTotal - a.metricas.montoTotal;
      }
    });

    // Calcular participación
    const totalGeneral = productosArray.reduce((sum, p) => sum + p.metricas.montoTotal, 0);
    const ranking = productosArray.slice(0, limite).map((p, index) => ({
      posicion: index + 1,
      ...p,
      participacion: totalGeneral > 0
        ? Math.round((p.metricas.montoTotal / totalGeneral) * 1000) / 10
        : 0,
    }));

    // Análisis de concentración (regla 80/20)
    let acumulado = 0;
    let productosPara80 = 0;
    for (const p of ranking) {
      acumulado += p.metricas.montoTotal;
      productosPara80++;
      if (acumulado >= totalGeneral * 0.8) break;
    }

    // Totales generales
    const totales = {
      productosVendidos: productosArray.length,
      cantidadTotalUnidades: productosArray.reduce((sum, p) => sum + p.metricas.cantidadVendida, 0),
      montoTotal: totalGeneral,
      ticketPromedioProducto: productosArray.length > 0
        ? Math.round(totalGeneral / productosArray.reduce((sum, p) => sum + p.metricas.ordenesCount, 0))
        : 0,
      concentracion: {
        productosPara80Porciento: productosPara80,
        porcentajeProductos: productosArray.length > 0
          ? Math.round((productosPara80 / productosArray.length) * 100)
          : 0,
      },
    };

    // Agrupación por categoría
    const porCategoria = new Map<string, {
      categoria: string;
      productos: number;
      cantidadVendida: number;
      montoTotal: number;
    }>();

    productosArray.forEach(p => {
      const catKey = p.producto.categoria?.name || 'Sin categoría';
      if (!porCategoria.has(catKey)) {
        porCategoria.set(catKey, {
          categoria: catKey,
          productos: 0,
          cantidadVendida: 0,
          montoTotal: 0,
        });
      }
      const cat = porCategoria.get(catKey)!;
      cat.productos++;
      cat.cantidadVendida += p.metricas.cantidadVendida;
      cat.montoTotal += p.metricas.montoTotal;
    });

    const categorias = Array.from(porCategoria.values())
      .sort((a, b) => b.montoTotal - a.montoTotal)
      .map(c => ({
        ...c,
        participacion: totalGeneral > 0
          ? Math.round((c.montoTotal / totalGeneral) * 100)
          : 0,
      }));

    // Productos sin movimiento (si no hay filtro de fecha)
    let productosSinMovimiento: any[] = [];
    if (!fechaDesde && !fechaHasta) {
      const todosLosProductos = await prisma.product.findMany({
        where: {
          companyId,
          active: true,
          ...(categoriaId && { categoryId: categoriaId }),
        },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
        },
      });

      const productosConVentas = new Set(productosArray.map(p => p.producto.id));
      productosSinMovimiento = todosLosProductos
        .filter(p => !productosConVentas.has(p.id))
        .slice(0, 20);
    }

    const response = NextResponse.json({
      periodo: {
        desde: fechaDesde || 'Inicio',
        hasta: fechaHasta || 'Hoy',
      },
      ordenadoPor: ordenarPor,
      ranking,
      totales,
      porCategoria: categorias,
      productosSinMovimiento,
      generadoEn: new Date().toISOString(),
    });

    // Add cache headers (30 seconds cache for reports)
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    return response;
  } catch (error) {
    console.error('Error generando reporte ranking-productos:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
