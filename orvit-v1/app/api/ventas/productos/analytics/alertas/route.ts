import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

type AlertType = 'STOCK_BAJO' | 'MARGEN_BAJO' | 'SIN_VENTAS' | 'ROTACION_LENTA';
type AlertPriority = 'ALTA' | 'MEDIA' | 'BAJA';

interface ProductAlert {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  tipo: AlertType;
  prioridad: AlertPriority;
  mensaje: string;
  detalles: {
    valorActual?: number;
    valorEsperado?: number;
    diferencia?: number;
    diasSinVenta?: number;
  };
  sugerencias: string[];
  fechaDeteccion: Date;
}

interface AlertSummary {
  total: number;
  porTipo: Record<AlertType, number>;
  porPrioridad: Record<AlertPriority, number>;
}

// GET: Obtener alertas de productos
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const { searchParams } = new URL(request.url);

    const tipo = searchParams.get('tipo') || 'all'; // 'stock' | 'margen' | 'ventas' | 'rotacion' | 'all'
    const prioridad = searchParams.get('prioridad') || 'all'; // 'alta' | 'media' | 'baja' | 'all'
    const limite = parseInt(searchParams.get('limite') || '50', 10);

    // Obtener todos los productos activos de la empresa
    const products = await prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        costPrice: true,
        salePrice: true,
        marginMin: true,
        marginMax: true,
        currentStock: true,
        minStock: true,
      },
    });

    const alerts: ProductAlert[] = [];
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Procesar cada producto para detectar alertas
    for (const product of products) {
      const productAlerts: ProductAlert[] = [];

      // ========================================
      // 1. ALERTA: STOCK BAJO
      // ========================================
      const currentStock = Number(product.currentStock || 0);
      const minStock = Number(product.minStock || 0);

      if (minStock > 0 && currentStock <= minStock && (tipo === 'all' || tipo === 'stock')) {
        const isOutOfStock = currentStock === 0;
        const priority: AlertPriority = isOutOfStock ? 'ALTA' : 'MEDIA';

        productAlerts.push({
          id: `${product.id}-stock`,
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          tipo: 'STOCK_BAJO',
          prioridad: priority,
          mensaje: isOutOfStock
            ? 'Stock agotado - Reabastecer urgente'
            : `Stock actual (${currentStock.toFixed(2)}) por debajo del mínimo (${minStock.toFixed(2)})`,
          detalles: {
            valorActual: currentStock,
            valorEsperado: minStock,
            diferencia: minStock - currentStock,
          },
          sugerencias: [
            'Revisar próximas órdenes de compra programadas',
            'Considerar aumentar el stock mínimo si hay demanda constante',
            'Evaluar tiempo de reposición del proveedor',
          ],
          fechaDeteccion: now,
        });
      }

      // ========================================
      // 2. ALERTA: MARGEN BAJO
      // ========================================
      if (tipo === 'all' || tipo === 'margen') {
        const costPrice = Number(product.costPrice || 0);
        const salePrice = Number(product.salePrice || 0);
        const marginMin = Number(product.marginMin || 0);

        if (salePrice > 0 && marginMin > 0) {
          const currentMargin = ((salePrice - costPrice) / salePrice) * 100;

          if (currentMargin < marginMin) {
            productAlerts.push({
              id: `${product.id}-margen`,
              productId: product.id,
              productName: product.name,
              productCode: product.code,
              tipo: 'MARGEN_BAJO',
              prioridad: 'ALTA',
              mensaje: `Margen actual (${currentMargin.toFixed(2)}%) por debajo del mínimo (${marginMin.toFixed(2)}%)`,
              detalles: {
                valorActual: Math.round(currentMargin * 100) / 100,
                valorEsperado: marginMin,
                diferencia: Math.round((marginMin - currentMargin) * 100) / 100,
              },
              sugerencias: [
                'Revisar y ajustar precio de venta al alza',
                'Negociar mejor precio con proveedor para reducir costo',
                'Evaluar si el producto sigue siendo rentable',
              ],
              fechaDeteccion: now,
            });
          }
        }
      }

      // ========================================
      // 3. ALERTA: SIN VENTAS EN 90+ DÍAS
      // ========================================
      if (tipo === 'all' || tipo === 'ventas') {
        const lastSale = await prisma.saleItem.findFirst({
          where: {
            productId: product.id,
            sale: applyViewMode(
              {
                companyId,
                estado: { notIn: ['CANCELADA', 'BORRADOR'] },
              },
              viewMode
            ),
          },
          orderBy: {
            sale: {
              fechaEmision: 'desc',
            },
          },
          select: {
            sale: {
              select: {
                fechaEmision: true,
              },
            },
          },
        });

        const lastSaleDate = lastSale?.sale?.fechaEmision;
        const daysSinceLastSale = lastSaleDate ? differenceInDays(now, lastSaleDate) : 999;

        if (daysSinceLastSale > 90) {
          const priority: AlertPriority = daysSinceLastSale > 180 ? 'ALTA' : 'MEDIA';

          productAlerts.push({
            id: `${product.id}-ventas`,
            productId: product.id,
            productName: product.name,
            productCode: product.code,
            tipo: 'SIN_VENTAS',
            prioridad: priority,
            mensaje: lastSaleDate
              ? `Sin ventas desde hace ${daysSinceLastSale} días`
              : 'No se registran ventas de este producto',
            detalles: {
              diasSinVenta: daysSinceLastSale > 999 ? null : daysSinceLastSale,
            },
            sugerencias: [
              'Evaluar descontinuar el producto si no es estratégico',
              'Implementar promoción o descuento para acelerar rotación',
              'Revisar si el producto sigue siendo relevante para el mercado',
              'Considerar reducir stock mínimo',
            ],
            fechaDeteccion: now,
          });
        }
      }

      // ========================================
      // 4. ALERTA: ROTACIÓN LENTA
      // ========================================
      if ((tipo === 'all' || tipo === 'rotacion') && currentStock > 0) {
        // Calcular rotación de los últimos 3 meses
        const salesLast3Months = await prisma.saleItem.findMany({
          where: {
            productId: product.id,
            sale: applyViewMode(
              {
                companyId,
                fechaEmision: { gte: threeMonthsAgo, lte: now },
                estado: { notIn: ['CANCELADA', 'BORRADOR'] },
              },
              viewMode
            ),
          },
          select: {
            cantidad: true,
          },
        });

        const totalSold = salesLast3Months.reduce((sum, item) => sum + Number(item.cantidad), 0);
        const turnoverRate = currentStock > 0 ? totalSold / currentStock : 0;

        if (turnoverRate < 1.5) {
          productAlerts.push({
            id: `${product.id}-rotacion`,
            productId: product.id,
            productName: product.name,
            productCode: product.code,
            tipo: 'ROTACION_LENTA',
            prioridad: 'BAJA',
            mensaje: `Rotación lenta en los últimos 3 meses (${turnoverRate.toFixed(2)}x)`,
            detalles: {
              valorActual: Math.round(turnoverRate * 100) / 100,
              valorEsperado: 1.5,
              diferencia: Math.round((1.5 - turnoverRate) * 100) / 100,
            },
            sugerencias: [
              'Reducir stock mínimo para liberar capital',
              'Implementar promociones para acelerar ventas',
              'Evaluar precio de venta (puede estar demasiado alto)',
              'Considerar bundling con productos de alta rotación',
            ],
            fechaDeteccion: now,
          });
        }
      }

      // Agregar alertas del producto a la lista general
      alerts.push(...productAlerts);
    }

    // Filtrar por prioridad si se especificó
    let filteredAlerts = alerts;
    if (prioridad !== 'all') {
      const targetPriority = prioridad.toUpperCase() as AlertPriority;
      filteredAlerts = alerts.filter((a) => a.prioridad === targetPriority);
    }

    // Ordenar por prioridad (ALTA -> MEDIA -> BAJA) y limitar
    const priorityOrder: Record<AlertPriority, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
    const sortedAlerts = filteredAlerts.sort((a, b) => {
      const priorityDiff = priorityOrder[a.prioridad] - priorityOrder[b.prioridad];
      if (priorityDiff !== 0) return priorityDiff;
      return a.productName.localeCompare(b.productName);
    });

    const limitedAlerts = sortedAlerts.slice(0, limite);

    // Calcular resumen
    const summary: AlertSummary = {
      total: alerts.length,
      porTipo: {
        STOCK_BAJO: alerts.filter((a) => a.tipo === 'STOCK_BAJO').length,
        MARGEN_BAJO: alerts.filter((a) => a.tipo === 'MARGEN_BAJO').length,
        SIN_VENTAS: alerts.filter((a) => a.tipo === 'SIN_VENTAS').length,
        ROTACION_LENTA: alerts.filter((a) => a.tipo === 'ROTACION_LENTA').length,
      },
      porPrioridad: {
        ALTA: alerts.filter((a) => a.prioridad === 'ALTA').length,
        MEDIA: alerts.filter((a) => a.prioridad === 'MEDIA').length,
        BAJA: alerts.filter((a) => a.prioridad === 'BAJA').length,
      },
    };

    // Cache headers
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600'); // 5 min cache

    return NextResponse.json(
      {
        alerts: limitedAlerts,
        resumen: summary,
      },
      { headers }
    );
  } catch (error) {
    console.error('Error obteniendo alertas de productos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
