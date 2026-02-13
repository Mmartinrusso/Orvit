import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

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

interface Insight {
  id: string;
  type: 'warning' | 'opportunity' | 'info' | 'success';
  icon: string;
  title: string;
  description: string;
  metric?: string;
  action?: {
    label: string;
    path: string;
  };
  priority: number; // 1-5, 5 being highest
}

// Detect anomalies in purchasing patterns
async function detectAnomalies(companyId: number, viewMode: string): Promise<Insight[]> {
  const insights: Insight[] = [];
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  try {
    // 1. Detect price increases > 20%
    const itemsWithPriceIncrease = await prisma.$queryRaw<Array<{
      descripcion: string;
      precio_actual: number;
      precio_anterior: number;
      variacion: number;
    }>>`
      WITH recent_prices AS (
        SELECT
          pri.descripcion,
          pri."precioUnitario" as precio,
          pr."fechaEmision",
          ROW_NUMBER() OVER (PARTITION BY pri.descripcion ORDER BY pr."fechaEmision" DESC) as rn
        FROM "PurchaseReceiptItem" pri
        JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
        WHERE pri."companyId" = ${companyId}
          AND pr."fechaEmision" >= ${threeMonthsAgo}
          AND pri."precioUnitario" > 0
      )
      SELECT
        r1.descripcion,
        r1.precio as precio_actual,
        r2.precio as precio_anterior,
        ((r1.precio - r2.precio) / r2.precio * 100) as variacion
      FROM recent_prices r1
      JOIN recent_prices r2 ON r1.descripcion = r2.descripcion AND r2.rn = 2
      WHERE r1.rn = 1
        AND r2.precio > 0
        AND ((r1.precio - r2.precio) / r2.precio * 100) > 20
      ORDER BY variacion DESC
      LIMIT 5
    `;

    if (itemsWithPriceIncrease.length > 0) {
      const topItem = itemsWithPriceIncrease[0];
      insights.push({
        id: 'price-increase',
        type: 'warning',
        icon: 'trending-up',
        title: 'Aumentos de precio detectados',
        description: `${itemsWithPriceIncrease.length} items con aumentos >20%. Mayor: "${topItem.descripcion.substring(0, 30)}..." (+${Math.round(topItem.variacion)}%)`,
        metric: `+${Math.round(topItem.variacion)}%`,
        action: {
          label: 'Ver items afectados',
          path: '/administracion/compras/stock?orden=variacion'
        },
        priority: 4
      });
    }

    // 2. Detect proveedores with increasing debt
    const proveedoresConDeudaCreciente = await prisma.$queryRaw<Array<{
      proveedor_id: number;
      nombre: string;
      deuda_actual: number;
      facturas_vencidas: number;
    }>>`
      SELECT
        s.id as proveedor_id,
        s.name as nombre,
        SUM(pr.total) as deuda_actual,
        COUNT(CASE WHEN pr."fechaVencimiento" < NOW() THEN 1 END) as facturas_vencidas
      FROM "PurchaseReceipt" pr
      JOIN suppliers s ON s.id = pr."proveedorId"
      WHERE pr."companyId" = ${companyId}
        AND pr.estado IN ('pendiente', 'parcial')
      GROUP BY s.id, s.name
      HAVING COUNT(CASE WHEN pr."fechaVencimiento" < NOW() THEN 1 END) >= 3
      ORDER BY facturas_vencidas DESC
      LIMIT 3
    `;

    if (proveedoresConDeudaCreciente.length > 0) {
      insights.push({
        id: 'debt-accumulation',
        type: 'warning',
        icon: 'alert-triangle',
        title: 'Deuda acumulada con proveedores',
        description: `${proveedoresConDeudaCreciente.length} proveedores con 3+ facturas vencidas. Riesgo de relacion comercial.`,
        action: {
          label: 'Ver cuentas corrientes',
          path: '/administracion/compras/cuentas-corrientes?vencidas=true'
        },
        priority: 5
      });
    }

    // 3. Detect potential savings - same item, different prices from suppliers
    const itemsConVariacionPrecios = await prisma.$queryRaw<Array<{
      descripcion: string;
      precio_min: number;
      precio_max: number;
      diferencia_pct: number;
      cant_proveedores: number;
    }>>`
      SELECT
        pri.descripcion,
        MIN(pri."precioUnitario") as precio_min,
        MAX(pri."precioUnitario") as precio_max,
        ((MAX(pri."precioUnitario") - MIN(pri."precioUnitario")) / MIN(pri."precioUnitario") * 100) as diferencia_pct,
        COUNT(DISTINCT pr."proveedorId") as cant_proveedores
      FROM "PurchaseReceiptItem" pri
      JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
      WHERE pri."companyId" = ${companyId}
        AND pr."fechaEmision" >= ${sixMonthsAgo}
        AND pri."precioUnitario" > 0
      GROUP BY pri.descripcion
      HAVING COUNT(DISTINCT pr."proveedorId") >= 2
        AND ((MAX(pri."precioUnitario") - MIN(pri."precioUnitario")) / MIN(pri."precioUnitario") * 100) > 15
      ORDER BY diferencia_pct DESC
      LIMIT 5
    `;

    if (itemsConVariacionPrecios.length > 0) {
      const potentialSavings = itemsConVariacionPrecios.reduce((sum, i) => {
        return sum + (Number(i.precio_max) - Number(i.precio_min));
      }, 0);

      insights.push({
        id: 'price-optimization',
        type: 'opportunity',
        icon: 'piggy-bank',
        title: 'Oportunidad de ahorro',
        description: `${itemsConVariacionPrecios.length} items comprados a diferentes precios (diferencia >15%). Considera consolidar proveedores.`,
        metric: `Ahorro pot: $${Math.round(potentialSavings / 1000)}K`,
        action: {
          label: 'Analizar precios',
          path: '/administracion/compras/analisis-precios'
        },
        priority: 3
      });
    }

    // 4. Detect suppliers with good payment history (for pronto pago)
    const proveedoresConDescuento = await prisma.purchaseReceipt.count({
      where: applyViewMode({
        companyId,
        prontoPagoDisponible: true,
        prontoPagoFecha: { gte: now },
        estado: 'pendiente'
      }, viewMode)
    });

    if (proveedoresConDescuento > 0) {
      insights.push({
        id: 'pronto-pago',
        type: 'opportunity',
        icon: 'clock',
        title: 'Descuentos por pronto pago',
        description: `${proveedoresConDescuento} facturas con descuento por pronto pago disponible. No dejes pasar el ahorro.`,
        action: {
          label: 'Ver descuentos',
          path: '/administracion/compras/comprobantes?prontoPago=disponible'
        },
        priority: 4
      });
    }

    // 5. Detect seasonal patterns
    const currentMonth = now.getMonth();
    const lastYearSameMonth = new Date(now.getFullYear() - 1, currentMonth, 1);
    const lastYearSameMonthEnd = new Date(now.getFullYear() - 1, currentMonth + 1, 0);

    const [comprasEsteMes, comprasMismoMesAnterior] = await Promise.all([
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          fechaEmision: { gte: new Date(now.getFullYear(), now.getMonth(), 1) }
        }, viewMode),
        _sum: { total: true }
      }),
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          fechaEmision: { gte: lastYearSameMonth, lte: lastYearSameMonthEnd }
        }, viewMode),
        _sum: { total: true }
      })
    ]);

    const esteMes = Number(comprasEsteMes._sum.total || 0);
    const mismoMesAnterior = Number(comprasMismoMesAnterior._sum.total || 0);

    if (mismoMesAnterior > 0 && esteMes > 0) {
      const variacionInteranual = ((esteMes - mismoMesAnterior) / mismoMesAnterior) * 100;
      if (Math.abs(variacionInteranual) > 25) {
        insights.push({
          id: 'seasonal-pattern',
          type: variacionInteranual > 0 ? 'info' : 'success',
          icon: 'calendar',
          title: variacionInteranual > 0 ? 'Compras elevadas este mes' : 'Compras reducidas este mes',
          description: `${variacionInteranual > 0 ? '+' : ''}${Math.round(variacionInteranual)}% vs mismo mes del ano anterior. ${variacionInteranual > 0 ? 'Verifica si es esperado.' : 'Buen control de gastos.'}`,
          metric: `${variacionInteranual > 0 ? '+' : ''}${Math.round(variacionInteranual)}%`,
          priority: 2
        });
      }
    }

    // 6. Stock alerts
    const stockCritico = await prisma.$queryRaw<[{count: bigint}]>`
      SELECT COUNT(*) as count
      FROM "SupplierItem" si
      JOIN "Stock" s ON s."supplierItemId" = si.id
      WHERE si."companyId" = ${companyId}
        AND si."stockMinimo" > 0
        AND s.cantidad <= 0
        AND si.activo = true
    `;

    const stockCriticoCount = Number(stockCritico[0]?.count || 0);
    if (stockCriticoCount > 0) {
      insights.push({
        id: 'stock-critical',
        type: 'warning',
        icon: 'package-x',
        title: 'Stock critico',
        description: `${stockCriticoCount} items sin existencia. Pueden afectar produccion o ventas.`,
        metric: `${stockCriticoCount} items`,
        action: {
          label: 'Ver stock critico',
          path: '/administracion/compras/stock?filtro=sin_stock'
        },
        priority: 5
      });
    }

    // 7. Purchase concentration risk
    const topProveedor = await prisma.purchaseReceipt.groupBy({
      by: ['proveedorId'],
      where: applyViewMode({
        companyId,
        fechaEmision: { gte: sixMonthsAgo }
      }, viewMode),
      _sum: { total: true }
    });

    if (topProveedor.length > 0) {
      const totalCompras = topProveedor.reduce((sum, p) => sum + Number(p._sum.total || 0), 0);
      const maxProveedor = Math.max(...topProveedor.map(p => Number(p._sum.total || 0)));
      const concentracion = (maxProveedor / totalCompras) * 100;

      if (concentracion > 40) {
        const topProvId = topProveedor.find(p => Number(p._sum.total) === maxProveedor)?.proveedorId;
        const prov = topProvId ? await prisma.suppliers.findUnique({
          where: { id: topProvId },
          select: { name: true }
        }) : null;

        insights.push({
          id: 'concentration-risk',
          type: 'info',
          icon: 'pie-chart',
          title: 'Alta concentracion de compras',
          description: `${Math.round(concentracion)}% de tus compras dependen de ${prov?.name || 'un proveedor'}. Considera diversificar.`,
          metric: `${Math.round(concentracion)}%`,
          priority: 2
        });
      }
    }

  } catch (error) {
    console.error('Error detecting anomalies:', error);
  }

  return insights.sort((a, b) => b.priority - a.priority);
}

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

    const viewMode = getViewMode(request);

    const insights = await detectAnomalies(companyId, viewMode);

    return NextResponse.json({
      insights,
      generatedAt: new Date().toISOString(),
      count: insights.length
    });
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return NextResponse.json(
      { error: 'Error al generar insights' },
      { status: 500 }
    );
  }
}
