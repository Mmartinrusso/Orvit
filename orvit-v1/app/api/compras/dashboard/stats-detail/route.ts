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
    const { searchParams } = new URL(request.url);
    const statType = searchParams.get('type') || 'compras';

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
    const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    let result: any = {};

    switch (statType) {
      case 'compras': {
        // Detailed purchase stats with ABC analysis and category breakdown
        const [
          comprasMes,
          comprasLastMonth,
          comprasSemana,
          comprasHoy,
          comprasAnio,
          comprasLastYear,
          comprasPorDia,
          comprasPorSemana,
          topProvMes,
          comprasPorMes,
          comprasPorCategoria
        ] = await Promise.all([
          // Este mes
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({ companyId, fechaEmision: { gte: startOfMonth } }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          // Mes anterior
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({ companyId, fechaEmision: { gte: startOfLastMonth, lte: endOfLastMonth } }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          // Esta semana
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({
              companyId,
              fechaEmision: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
            }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          // Hoy
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({
              companyId,
              fechaEmision: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
            }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          // Este año
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({ companyId, fechaEmision: { gte: startOfYear } }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          // Año anterior (para YoY)
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({ companyId, fechaEmision: { gte: startOfLastYear, lte: endOfLastYear } }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          // Por día de la semana
          prisma.$queryRaw<Array<{ dia: number; total: any; cantidad: any }>>`
            SELECT
              EXTRACT(DOW FROM "fechaEmision") as dia,
              COALESCE(SUM(total), 0) as total,
              COUNT(*) as cantidad
            FROM "PurchaseReceipt"
            WHERE "companyId" = ${companyId}
              AND "fechaEmision" >= ${threeMonthsAgo}
            GROUP BY EXTRACT(DOW FROM "fechaEmision")
            ORDER BY dia
          `,
          // Por semana últimos 3 meses
          prisma.$queryRaw<Array<{ semana: string; total: any; cantidad: any }>>`
            SELECT
              TO_CHAR(DATE_TRUNC('week', "fechaEmision"), 'YYYY-WW') as semana,
              COALESCE(SUM(total), 0) as total,
              COUNT(*) as cantidad
            FROM "PurchaseReceipt"
            WHERE "companyId" = ${companyId}
              AND "fechaEmision" >= ${threeMonthsAgo}
            GROUP BY DATE_TRUNC('week', "fechaEmision")
            ORDER BY semana DESC
            LIMIT 12
          `,
          // Top proveedores del mes
          prisma.purchaseReceipt.groupBy({
            by: ['proveedorId'],
            where: applyViewMode({ companyId, fechaEmision: { gte: startOfMonth } }, viewMode),
            _sum: { total: true },
            _count: true,
            orderBy: { _sum: { total: 'desc' } },
            take: 10
          }),
          // Compras por mes (últimos 12 meses)
          prisma.$queryRaw<Array<{ mes: string; total: any; cantidad: any }>>`
            SELECT
              TO_CHAR(DATE_TRUNC('month', "fechaEmision"), 'YYYY-MM') as mes,
              COALESCE(SUM(total), 0) as total,
              COUNT(*) as cantidad
            FROM "PurchaseReceipt"
            WHERE "companyId" = ${companyId}
              AND "fechaEmision" >= ${twelveMonthsAgo}
            GROUP BY DATE_TRUNC('month', "fechaEmision")
            ORDER BY mes DESC
          `,
          // Compras por categoría (si existen categorías)
          prisma.$queryRaw<Array<{ categoria: string; categoryId: number | null; total: any; cantidad: any }>>`
            SELECT
              COALESCE(sc.name, 'Sin Categoría') as categoria,
              sc.id as "categoryId",
              COALESCE(SUM(pri.subtotal), 0) as total,
              COUNT(DISTINCT pr.id) as cantidad
            FROM "PurchaseReceiptItem" pri
            JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
            LEFT JOIN supplies s ON s.id = pri."supplierItemId"
            LEFT JOIN supply_categories sc ON sc.id = s."categoryId"
            WHERE pr."companyId" = ${companyId}
              AND pr."fechaEmision" >= ${startOfMonth}
            GROUP BY sc.name, sc.id
            ORDER BY total DESC
          `
        ]);

        // Get proveedor names
        const provIds = topProvMes.map(p => p.proveedorId);
        const proveedores = await prisma.suppliers.findMany({
          where: { id: { in: provIds } },
          select: { id: true, name: true }
        });
        const provMap = new Map(proveedores.map(p => [p.id, p.name]));

        // Calculate ABC analysis for suppliers (80/15/5 rule)
        const totalCompras = topProvMes.reduce((s, p) => s + Number(p._sum.total || 0), 0);
        let acumulado = 0;
        const proveedoresABC = topProvMes.map(p => {
          const total = Number(p._sum.total || 0);
          acumulado += total;
          const porcentaje = totalCompras > 0 ? (total / totalCompras * 100) : 0;
          const porcentajeAcumulado = totalCompras > 0 ? (acumulado / totalCompras * 100) : 0;
          let clasificacion = 'C';
          if (porcentajeAcumulado <= 80) clasificacion = 'A';
          else if (porcentajeAcumulado <= 95) clasificacion = 'B';

          return {
            id: p.proveedorId,
            nombre: provMap.get(p.proveedorId) || 'Desconocido',
            total,
            cantidad: p._count,
            porcentaje,
            porcentajeAcumulado,
            clasificacion
          };
        });

        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

        // Calculate concentration metrics
        const top3Total = proveedoresABC.slice(0, 3).reduce((s, p) => s + p.total, 0);
        const concentracionTop3 = totalCompras > 0 ? (top3Total / totalCompras * 100) : 0;

        result = {
          resumen: {
            hoy: { total: Number(comprasHoy._sum.total || 0), cantidad: comprasHoy._count },
            semana: { total: Number(comprasSemana._sum.total || 0), cantidad: comprasSemana._count },
            mes: { total: Number(comprasMes._sum.total || 0), cantidad: comprasMes._count },
            mesAnterior: { total: Number(comprasLastMonth._sum.total || 0), cantidad: comprasLastMonth._count },
            anio: { total: Number(comprasAnio._sum.total || 0), cantidad: comprasAnio._count },
            anioAnterior: { total: Number(comprasLastYear._sum.total || 0), cantidad: comprasLastYear._count },
            variacionMes: comprasLastMonth._sum.total
              ? ((Number(comprasMes._sum.total || 0) - Number(comprasLastMonth._sum.total)) / Number(comprasLastMonth._sum.total) * 100)
              : 0,
            variacionYoY: comprasLastYear._sum.total
              ? ((Number(comprasAnio._sum.total || 0) - Number(comprasLastYear._sum.total)) / Number(comprasLastYear._sum.total) * 100)
              : 0,
            promedioMensual: comprasPorMes.length > 0
              ? comprasPorMes.reduce((s, m) => s + Number(m.total), 0) / comprasPorMes.length
              : 0,
            ticketPromedio: comprasMes._count > 0
              ? Number(comprasMes._sum.total || 0) / comprasMes._count
              : 0
          },
          porDiaSemana: comprasPorDia.map(d => ({
            dia: diasSemana[Number(d.dia)],
            total: Number(d.total),
            cantidad: Number(d.cantidad)
          })),
          porSemana: comprasPorSemana.map(s => ({
            semana: s.semana,
            total: Number(s.total),
            cantidad: Number(s.cantidad)
          })).reverse(),
          porMes: comprasPorMes.map(m => ({
            mes: m.mes,
            total: Number(m.total),
            cantidad: Number(m.cantidad)
          })).reverse(),
          topProveedores: proveedoresABC,
          porCategoria: comprasPorCategoria.map(c => ({
            categoria: c.categoria,
            categoryId: c.categoryId,
            total: Number(c.total),
            cantidad: Number(c.cantidad),
            porcentaje: totalCompras > 0 ? (Number(c.total) / totalCompras * 100) : 0
          })),
          metricas: {
            concentracionTop3,
            cantidadProveedoresActivos: topProvMes.length,
            clasificacionABC: {
              A: proveedoresABC.filter(p => p.clasificacion === 'A').length,
              B: proveedoresABC.filter(p => p.clasificacion === 'B').length,
              C: proveedoresABC.filter(p => p.clasificacion === 'C').length
            }
          }
        };
        break;
      }

      case 'deuda': {
        // Enhanced debt stats with aging and credit analysis
        const [
          deudaTotal,
          deudaPorProveedor,
          deudaPorVencimiento,
          facturasPendientes,
          pagosProgramados,
          historiaPagos,
          proveedoresConLimite
        ] = await Promise.all([
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({ companyId, estado: { in: ['pendiente', 'parcial'] } }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          prisma.purchaseReceipt.groupBy({
            by: ['proveedorId'],
            where: applyViewMode({ companyId, estado: { in: ['pendiente', 'parcial'] } }, viewMode),
            _sum: { total: true },
            _count: true,
            orderBy: { _sum: { total: 'desc' } },
            take: 15
          }),
          prisma.$queryRaw<Array<{ bucket: string; total: any; cantidad: any }>>`
            SELECT
              CASE
                WHEN "fechaVencimiento" < NOW() - INTERVAL '90 days' THEN 'vencido_90'
                WHEN "fechaVencimiento" < NOW() - INTERVAL '60 days' THEN 'vencido_60'
                WHEN "fechaVencimiento" < NOW() - INTERVAL '30 days' THEN 'vencido_30'
                WHEN "fechaVencimiento" < NOW() THEN 'vencido'
                WHEN "fechaVencimiento" <= NOW() + INTERVAL '7 days' THEN '7_dias'
                WHEN "fechaVencimiento" <= NOW() + INTERVAL '15 days' THEN '15_dias'
                WHEN "fechaVencimiento" <= NOW() + INTERVAL '30 days' THEN '30_dias'
                ELSE 'mas_30_dias'
              END as bucket,
              COALESCE(SUM(total), 0) as total,
              COUNT(*) as cantidad
            FROM "PurchaseReceipt"
            WHERE "companyId" = ${companyId}
              AND estado IN ('pendiente', 'parcial')
            GROUP BY bucket
          `,
          prisma.purchaseReceipt.findMany({
            where: applyViewMode({
              companyId,
              estado: { in: ['pendiente', 'parcial'] },
              fechaVencimiento: { lt: now }
            }, viewMode),
            select: {
              id: true,
              numero: true,
              total: true,
              fechaVencimiento: true,
              fechaEmision: true,
              proveedor: { select: { id: true, name: true } }
            },
            orderBy: { fechaVencimiento: 'asc' },
            take: 20
          }),
          prisma.paymentRequest.findMany({
            where: applyViewMode({
              companyId,
              estado: { in: ['PENDIENTE', 'APROBADA'] }
            }, viewMode),
            select: {
              id: true,
              monto: true,
              fechaSugerida: true,
              estado: true
            },
            take: 10
          }),
          // Historia de pagos últimos 6 meses
          prisma.$queryRaw<Array<{ mes: string; total_pagado: any; cantidad: any }>>`
            SELECT
              TO_CHAR(DATE_TRUNC('month', "fechaPago"), 'YYYY-MM') as mes,
              COALESCE(SUM("montoPagado"), 0) as total_pagado,
              COUNT(*) as cantidad
            FROM "PaymentOrder"
            WHERE "companyId" = ${companyId}
              AND estado = 'pagado'
              AND "fechaPago" >= ${sixMonthsAgo}
            GROUP BY DATE_TRUNC('month', "fechaPago")
            ORDER BY mes DESC
          `,
          // Proveedores con límite de crédito
          prisma.suppliers.findMany({
            where: {
              companyId,
              creditLimit: { not: null }
            },
            select: {
              id: true,
              name: true,
              creditLimit: true
            }
          })
        ]);

        const provIds = deudaPorProveedor.map(p => p.proveedorId);
        const proveedores = await prisma.suppliers.findMany({
          where: { id: { in: provIds } },
          select: { id: true, name: true, creditLimit: true }
        });
        const provMap = new Map(proveedores.map(p => [p.id, { name: p.name, limit: p.creditLimit }]));

        // Calculate days sales outstanding (DSO)
        const pagosUltimos90 = await prisma.paymentOrder.aggregate({
          where: applyViewMode({
            companyId,
            estado: 'pagado',
            fechaPago: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) }
          }, viewMode),
          _sum: { montoPagado: true }
        });
        const promedioDeuda = Number(deudaTotal._sum.total || 0);
        const pagos90Dias = Number(pagosUltimos90._sum.montoPagado || 0);
        const dso = pagos90Dias > 0 ? Math.round((promedioDeuda / (pagos90Dias / 90))) : 0;

        // Calcular antigüedad promedio de deuda
        const deudaVencida = facturasPendientes.reduce((s, f) => {
          const dias = Math.max(0, Math.floor((now.getTime() - new Date(f.fechaVencimiento).getTime()) / (1000 * 60 * 60 * 24)));
          return s + dias * Number(f.total);
        }, 0);
        const antiguedadPromedio = promedioDeuda > 0 ? Math.round(deudaVencida / promedioDeuda) : 0;

        result = {
          resumen: {
            deudaTotal: Number(deudaTotal._sum.total || 0),
            facturasVencidas: facturasPendientes.length,
            montoVencido: facturasPendientes.reduce((s, f) => s + Number(f.total || 0), 0),
            cantidadPendientes: deudaTotal._count,
            dso,
            antiguedadPromedioDias: antiguedadPromedio
          },
          porVencimiento: {
            vencido90: deudaPorVencimiento.find(d => d.bucket === 'vencido_90') || { total: 0, cantidad: 0 },
            vencido60: deudaPorVencimiento.find(d => d.bucket === 'vencido_60') || { total: 0, cantidad: 0 },
            vencido30: deudaPorVencimiento.find(d => d.bucket === 'vencido_30') || { total: 0, cantidad: 0 },
            vencido: deudaPorVencimiento.find(d => d.bucket === 'vencido') || { total: 0, cantidad: 0 },
            dias7: deudaPorVencimiento.find(d => d.bucket === '7_dias') || { total: 0, cantidad: 0 },
            dias15: deudaPorVencimiento.find(d => d.bucket === '15_dias') || { total: 0, cantidad: 0 },
            dias30: deudaPorVencimiento.find(d => d.bucket === '30_dias') || { total: 0, cantidad: 0 },
            mas30: deudaPorVencimiento.find(d => d.bucket === 'mas_30_dias') || { total: 0, cantidad: 0 }
          },
          porProveedor: deudaPorProveedor.map(p => {
            const info = provMap.get(p.proveedorId);
            const deuda = Number(p._sum.total || 0);
            const limite = info?.limit ? Number(info.limit) : null;
            return {
              id: p.proveedorId,
              nombre: info?.name || 'Desconocido',
              total: deuda,
              cantidad: p._count,
              limiteCredito: limite,
              utilizacion: limite ? Math.round((deuda / limite) * 100) : null
            };
          }),
          facturasVencidas: facturasPendientes.map(f => ({
            id: f.id,
            numero: f.numero,
            total: Number(f.total),
            vencimiento: f.fechaVencimiento,
            emision: f.fechaEmision,
            diasVencido: Math.floor((now.getTime() - new Date(f.fechaVencimiento).getTime()) / (1000 * 60 * 60 * 24)),
            proveedor: f.proveedor.name,
            proveedorId: f.proveedor.id
          })),
          historiaPagos: historiaPagos.map(h => ({
            mes: h.mes,
            totalPagado: Number(h.total_pagado),
            cantidad: Number(h.cantidad)
          })),
          pagosProgramados: pagosProgramados.map(p => ({
            id: p.id,
            monto: Number(p.monto),
            fecha: p.fechaSugerida,
            estado: p.estado
          }))
        };
        break;
      }

      case 'ordenes': {
        // Enhanced order stats with performance metrics
        const [
          ordenesPorEstado,
          ordenesUltimas,
          tiempoPromedio,
          ordenesPorProveedor,
          ordenesPorMes,
          tasaRechazo,
          ordenesPendientesAprobacion
        ] = await Promise.all([
          prisma.purchaseOrder.groupBy({
            by: ['estado'],
            where: applyViewMode({ companyId }, viewMode),
            _count: true,
            _sum: { total: true }
          }),
          prisma.purchaseOrder.findMany({
            where: applyViewMode({ companyId }, viewMode),
            select: {
              id: true,
              numero: true,
              estado: true,
              total: true,
              createdAt: true,
              proveedor: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 15
          }),
          // Tiempo promedio de procesamiento
          prisma.$queryRaw<[{ avg_days: any; min_days: any; max_days: any }]>`
            SELECT
              AVG(EXTRACT(EPOCH FROM ("fechaConfirmacion" - "createdAt")) / 86400) as avg_days,
              MIN(EXTRACT(EPOCH FROM ("fechaConfirmacion" - "createdAt")) / 86400) as min_days,
              MAX(EXTRACT(EPOCH FROM ("fechaConfirmacion" - "createdAt")) / 86400) as max_days
            FROM "PurchaseOrder"
            WHERE "companyId" = ${companyId}
              AND "fechaConfirmacion" IS NOT NULL
              AND "createdAt" >= ${threeMonthsAgo}
          `,
          prisma.purchaseOrder.groupBy({
            by: ['proveedorId'],
            where: applyViewMode({ companyId, createdAt: { gte: threeMonthsAgo } }, viewMode),
            _count: true,
            _sum: { total: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10
          }),
          // Órdenes por mes
          prisma.$queryRaw<Array<{ mes: string; total: any; cantidad: any }>>`
            SELECT
              TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as mes,
              COALESCE(SUM(total), 0) as total,
              COUNT(*) as cantidad
            FROM "PurchaseOrder"
            WHERE "companyId" = ${companyId}
              AND "createdAt" >= ${sixMonthsAgo}
            GROUP BY DATE_TRUNC('month', "createdAt")
            ORDER BY mes DESC
          `,
          // Tasa de rechazo
          prisma.$queryRaw<[{ total: any; rechazadas: any }]>`
            SELECT
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE estado = 'RECHAZADA') as rechazadas
            FROM "PurchaseOrder"
            WHERE "companyId" = ${companyId}
              AND "createdAt" >= ${threeMonthsAgo}
          `,
          // Órdenes pendientes de aprobación
          prisma.purchaseOrder.findMany({
            where: applyViewMode({
              companyId,
              estado: 'PENDIENTE_APROBACION'
            }, viewMode),
            select: {
              id: true,
              numero: true,
              total: true,
              createdAt: true,
              proveedor: { select: { name: true } }
            },
            orderBy: { createdAt: 'asc' },
            take: 10
          })
        ]);

        const provIds = ordenesPorProveedor.map(p => p.proveedorId);
        const proveedores = await prisma.suppliers.findMany({
          where: { id: { in: provIds } },
          select: { id: true, name: true }
        });
        const provMap = new Map(proveedores.map(p => [p.id, p.name]));

        const totalOrdenes = Number(tasaRechazo[0]?.total || 0);
        const rechazadas = Number(tasaRechazo[0]?.rechazadas || 0);

        result = {
          porEstado: ordenesPorEstado.map(e => ({
            estado: e.estado,
            cantidad: e._count,
            total: Number(e._sum.total || 0)
          })),
          ultimasOrdenes: ordenesUltimas.map(o => ({
            id: o.id,
            numero: o.numero,
            estado: o.estado,
            total: Number(o.total || 0),
            fecha: o.createdAt,
            proveedor: o.proveedor.name
          })),
          tiempoProcesamientoDias: {
            promedio: Number(tiempoPromedio[0]?.avg_days || 0),
            minimo: Number(tiempoPromedio[0]?.min_days || 0),
            maximo: Number(tiempoPromedio[0]?.max_days || 0)
          },
          porProveedor: ordenesPorProveedor.map(p => ({
            id: p.proveedorId,
            nombre: provMap.get(p.proveedorId) || 'Desconocido',
            cantidad: p._count,
            total: Number(p._sum.total || 0)
          })),
          porMes: ordenesPorMes.map(m => ({
            mes: m.mes,
            total: Number(m.total),
            cantidad: Number(m.cantidad)
          })).reverse(),
          metricas: {
            tasaRechazo: totalOrdenes > 0 ? (rechazadas / totalOrdenes * 100) : 0,
            ordenesRechazadas: rechazadas,
            totalOrdenes
          },
          pendientesAprobacion: ordenesPendientesAprobacion.map(o => ({
            id: o.id,
            numero: o.numero,
            total: Number(o.total || 0),
            fecha: o.createdAt,
            diasPendiente: Math.floor((now.getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
            proveedor: o.proveedor.name
          }))
        };
        break;
      }

      case 'flujo': {
        // Enhanced cash flow with projections
        const [
          proximo7,
          proximo15,
          proximo30,
          proximo60,
          proximo90,
          facturasPorDia,
          pagosRealizados,
          pagosProyectados
        ] = await Promise.all([
          prisma.purchaseReceipt.findMany({
            where: applyViewMode({
              companyId,
              estado: { in: ['pendiente', 'parcial'] },
              fechaVencimiento: {
                gte: now,
                lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
              }
            }, viewMode),
            select: {
              id: true,
              numero: true,
              total: true,
              fechaVencimiento: true,
              proveedor: { select: { name: true } }
            },
            orderBy: { fechaVencimiento: 'asc' }
          }),
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({
              companyId,
              estado: { in: ['pendiente', 'parcial'] },
              fechaVencimiento: {
                gte: now,
                lte: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
              }
            }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({
              companyId,
              estado: { in: ['pendiente', 'parcial'] },
              fechaVencimiento: {
                gte: now,
                lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
              }
            }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({
              companyId,
              estado: { in: ['pendiente', 'parcial'] },
              fechaVencimiento: {
                gte: now,
                lte: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
              }
            }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({
              companyId,
              estado: { in: ['pendiente', 'parcial'] },
              fechaVencimiento: {
                gte: now,
                lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
              }
            }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          prisma.$queryRaw<Array<{ dia: string; total: any; cantidad: any }>>`
            SELECT
              DATE("fechaVencimiento") as dia,
              COALESCE(SUM(total), 0) as total,
              COUNT(*) as cantidad
            FROM "PurchaseReceipt"
            WHERE "companyId" = ${companyId}
              AND estado IN ('pendiente', 'parcial')
              AND "fechaVencimiento" >= NOW()
              AND "fechaVencimiento" <= NOW() + INTERVAL '30 days'
            GROUP BY DATE("fechaVencimiento")
            ORDER BY dia
          `,
          prisma.paymentOrder.aggregate({
            where: applyViewMode({
              companyId,
              estado: 'pagado',
              fechaPago: { gte: startOfMonth }
            }, viewMode),
            _sum: { montoPagado: true },
            _count: true
          }),
          // Pagos por semana (proyección)
          prisma.$queryRaw<Array<{ semana: string; total: any; cantidad: any }>>`
            SELECT
              TO_CHAR(DATE_TRUNC('week', "fechaVencimiento"), 'YYYY-WW') as semana,
              COALESCE(SUM(total), 0) as total,
              COUNT(*) as cantidad
            FROM "PurchaseReceipt"
            WHERE "companyId" = ${companyId}
              AND estado IN ('pendiente', 'parcial')
              AND "fechaVencimiento" >= NOW()
              AND "fechaVencimiento" <= NOW() + INTERVAL '90 days'
            GROUP BY DATE_TRUNC('week', "fechaVencimiento")
            ORDER BY semana
          `
        ]);

        result = {
          resumen: {
            proximo7: {
              total: proximo7.reduce((s, f) => s + Number(f.total || 0), 0),
              cantidad: proximo7.length,
              facturas: proximo7.map(f => ({
                id: f.id,
                numero: f.numero,
                total: Number(f.total),
                vencimiento: f.fechaVencimiento,
                proveedor: f.proveedor.name
              }))
            },
            proximo15: {
              total: Number(proximo15._sum.total || 0),
              cantidad: proximo15._count
            },
            proximo30: {
              total: Number(proximo30._sum.total || 0),
              cantidad: proximo30._count
            },
            proximo60: {
              total: Number(proximo60._sum.total || 0),
              cantidad: proximo60._count
            },
            proximo90: {
              total: Number(proximo90._sum.total || 0),
              cantidad: proximo90._count
            }
          },
          calendarioPagos: facturasPorDia.map(d => ({
            dia: d.dia,
            total: Number(d.total),
            cantidad: Number(d.cantidad)
          })),
          proyeccionSemanal: pagosProyectados.map(p => ({
            semana: p.semana,
            total: Number(p.total),
            cantidad: Number(p.cantidad)
          })),
          pagosRealizadosMes: {
            total: Number(pagosRealizados._sum.montoPagado || 0),
            cantidad: pagosRealizados._count
          }
        };
        break;
      }

      case 'items': {
        // Enhanced item analysis with ABC classification and price trends
        const [topItems, precioEvolucion] = await Promise.all([
          prisma.$queryRaw<Array<{
            descripcion: string;
            total_comprado: any;
            cantidad_total: any;
            precio_promedio: any;
            precio_min: any;
            precio_max: any;
            cant_compras: any;
            cant_proveedores: any;
            ultima_compra: Date;
            primera_compra: Date;
          }>>`
            SELECT
              pri.descripcion,
              SUM(pri.subtotal) as total_comprado,
              SUM(pri.cantidad) as cantidad_total,
              AVG(pri."precioUnitario") as precio_promedio,
              MIN(pri."precioUnitario") as precio_min,
              MAX(pri."precioUnitario") as precio_max,
              COUNT(DISTINCT pri."comprobanteId") as cant_compras,
              COUNT(DISTINCT pr."proveedorId") as cant_proveedores,
              MAX(pr."fechaEmision") as ultima_compra,
              MIN(pr."fechaEmision") as primera_compra
            FROM "PurchaseReceiptItem" pri
            JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
            WHERE pri."companyId" = ${companyId}
              AND pr."fechaEmision" >= ${sixMonthsAgo}
            GROUP BY pri.descripcion
            ORDER BY total_comprado DESC
            LIMIT 30
          `,
          // Evolución de precios top 5 items (por mes)
          prisma.$queryRaw<Array<{
            descripcion: string;
            mes: string;
            precio_promedio: any;
          }>>`
            WITH top_items AS (
              SELECT descripcion
              FROM "PurchaseReceiptItem" pri
              JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
              WHERE pri."companyId" = ${companyId}
                AND pr."fechaEmision" >= ${sixMonthsAgo}
              GROUP BY descripcion
              ORDER BY SUM(subtotal) DESC
              LIMIT 5
            )
            SELECT
              pri.descripcion,
              TO_CHAR(DATE_TRUNC('month', pr."fechaEmision"), 'YYYY-MM') as mes,
              AVG(pri."precioUnitario") as precio_promedio
            FROM "PurchaseReceiptItem" pri
            JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
            WHERE pri."companyId" = ${companyId}
              AND pr."fechaEmision" >= ${sixMonthsAgo}
              AND pri.descripcion IN (SELECT descripcion FROM top_items)
            GROUP BY pri.descripcion, DATE_TRUNC('month', pr."fechaEmision")
            ORDER BY pri.descripcion, mes
          `
        ]);

        // Calculate ABC classification for items
        const totalComprado = topItems.reduce((s, i) => s + Number(i.total_comprado || 0), 0);
        let acumulado = 0;
        const itemsABC = topItems.map(item => {
          const total = Number(item.total_comprado || 0);
          acumulado += total;
          const porcentaje = totalComprado > 0 ? (total / totalComprado * 100) : 0;
          const porcentajeAcumulado = totalComprado > 0 ? (acumulado / totalComprado * 100) : 0;
          let clasificacion = 'C';
          if (porcentajeAcumulado <= 80) clasificacion = 'A';
          else if (porcentajeAcumulado <= 95) clasificacion = 'B';

          const precioMin = Number(item.precio_min || 0);
          const precioMax = Number(item.precio_max || 0);
          const variacionPrecio = precioMin > 0 ? ((precioMax - precioMin) / precioMin * 100) : 0;

          return {
            descripcion: item.descripcion,
            totalComprado: total,
            cantidadTotal: Number(item.cantidad_total || 0),
            precioPromedio: Number(item.precio_promedio || 0),
            precioMin,
            precioMax,
            variacionPrecio,
            cantidadCompras: Number(item.cant_compras || 0),
            cantidadProveedores: Number(item.cant_proveedores || 0),
            ultimaCompra: item.ultima_compra,
            primeraCompra: item.primera_compra,
            porcentaje,
            clasificacion
          };
        });

        // Group price evolution by item
        const evolucionPorItem: Record<string, Array<{ mes: string; precio: number }>> = {};
        for (const p of precioEvolucion) {
          if (!evolucionPorItem[p.descripcion]) {
            evolucionPorItem[p.descripcion] = [];
          }
          evolucionPorItem[p.descripcion].push({
            mes: p.mes,
            precio: Number(p.precio_promedio || 0)
          });
        }

        result = {
          items: itemsABC,
          evolucionPrecios: evolucionPorItem,
          metricas: {
            totalItems: topItems.length,
            clasificacionABC: {
              A: itemsABC.filter(i => i.clasificacion === 'A').length,
              B: itemsABC.filter(i => i.clasificacion === 'B').length,
              C: itemsABC.filter(i => i.clasificacion === 'C').length
            },
            itemsMultiProveedor: itemsABC.filter(i => i.cantidadProveedores > 1).length
          }
        };
        break;
      }

      case 'recepciones': {
        // Enhanced reception stats with quality metrics
        const [
          recepcionesMes,
          recepcionesLastMonth,
          recepcionesHoy,
          recepcionesPorDia,
          ultimasRecepciones,
          recepcionesConDiferencias,
          leadTimeProveedor
        ] = await Promise.all([
          prisma.goodsReceipt.aggregate({
            where: applyViewMode({ companyId, createdAt: { gte: startOfMonth } }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          prisma.goodsReceipt.aggregate({
            where: applyViewMode({ companyId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          prisma.goodsReceipt.aggregate({
            where: applyViewMode({
              companyId,
              createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
            }, viewMode),
            _sum: { total: true },
            _count: true
          }),
          prisma.$queryRaw<Array<{ dia: string; total: any; cantidad: any }>>`
            SELECT
              DATE("createdAt") as dia,
              COALESCE(SUM(total), 0) as total,
              COUNT(*) as cantidad
            FROM "GoodsReceipt"
            WHERE "companyId" = ${companyId}
              AND "createdAt" >= ${startOfMonth}
            GROUP BY DATE("createdAt")
            ORDER BY dia DESC
            LIMIT 15
          `,
          prisma.goodsReceipt.findMany({
            where: applyViewMode({ companyId }, viewMode),
            select: {
              id: true,
              numero: true,
              total: true,
              createdAt: true,
              estado: true,
              proveedor: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 15
          }),
          // Recepciones con diferencias
          prisma.goodsReceipt.count({
            where: applyViewMode({
              companyId,
              createdAt: { gte: threeMonthsAgo },
              estado: { in: ['PARCIAL', 'CON_DIFERENCIAS'] }
            }, viewMode)
          }),
          // Lead time promedio por proveedor
          prisma.$queryRaw<Array<{ proveedor_id: number; proveedor: string; lead_time_dias: any; entregas: any }>>`
            SELECT
              gr."proveedorId" as proveedor_id,
              s.name as proveedor,
              AVG(EXTRACT(EPOCH FROM (gr."createdAt" - po."createdAt")) / 86400) as lead_time_dias,
              COUNT(*) as entregas
            FROM "GoodsReceipt" gr
            JOIN "PurchaseOrder" po ON po.id = gr."purchaseOrderId"
            JOIN suppliers s ON s.id = gr."proveedorId"
            WHERE gr."companyId" = ${companyId}
              AND gr."createdAt" >= ${threeMonthsAgo}
              AND po."createdAt" IS NOT NULL
            GROUP BY gr."proveedorId", s.name
            HAVING COUNT(*) >= 3
            ORDER BY lead_time_dias ASC
            LIMIT 10
          `
        ]);

        const totalRecepciones = await prisma.goodsReceipt.count({
          where: applyViewMode({ companyId, createdAt: { gte: threeMonthsAgo } }, viewMode)
        });

        result = {
          resumen: {
            hoy: { total: Number(recepcionesHoy._sum.total || 0), cantidad: recepcionesHoy._count },
            mes: { total: Number(recepcionesMes._sum.total || 0), cantidad: recepcionesMes._count },
            mesAnterior: { total: Number(recepcionesLastMonth._sum.total || 0), cantidad: recepcionesLastMonth._count },
            variacion: recepcionesLastMonth._sum.total
              ? ((Number(recepcionesMes._sum.total || 0) - Number(recepcionesLastMonth._sum.total)) / Number(recepcionesLastMonth._sum.total) * 100)
              : 0
          },
          porDia: recepcionesPorDia.map(d => ({
            dia: d.dia,
            total: Number(d.total),
            cantidad: Number(d.cantidad)
          })),
          ultimas: ultimasRecepciones.map(r => ({
            id: r.id,
            numero: r.numero,
            total: Number(r.total || 0),
            fecha: r.createdAt,
            estado: r.estado,
            proveedor: r.proveedor.name
          })),
          metricas: {
            tasaDiferencias: totalRecepciones > 0
              ? (recepcionesConDiferencias / totalRecepciones * 100)
              : 0,
            recepcionesConDiferencias
          },
          leadTimeProveedores: leadTimeProveedor.map(p => ({
            proveedorId: p.proveedor_id,
            proveedor: p.proveedor,
            leadTimeDias: Number(p.lead_time_dias || 0),
            entregas: Number(p.entregas || 0)
          }))
        };
        break;
      }

      case 'categorias': {
        // Category spending analysis (NEW)
        const [categorias, gastoPorCategoria, tendenciaCategorias] = await Promise.all([
          prisma.supplyCategory.findMany({
            where: { companyId, isActive: true },
            select: {
              id: true,
              name: true,
              code: true,
              color: true,
              parentId: true,
              _count: { select: { supplies: true } }
            },
            orderBy: { sortOrder: 'asc' }
          }),
          prisma.$queryRaw<Array<{ categoria_id: number | null; categoria: string; total: any; cantidad_items: any; cantidad_facturas: any }>>`
            SELECT
              sc.id as categoria_id,
              COALESCE(sc.name, 'Sin Categoría') as categoria,
              COALESCE(SUM(pri.subtotal), 0) as total,
              COUNT(DISTINCT pri.id) as cantidad_items,
              COUNT(DISTINCT pr.id) as cantidad_facturas
            FROM "PurchaseReceiptItem" pri
            JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
            LEFT JOIN supplies s ON s.id = pri."supplierItemId"
            LEFT JOIN supply_categories sc ON sc.id = s."categoryId"
            WHERE pr."companyId" = ${companyId}
              AND pr."fechaEmision" >= ${threeMonthsAgo}
            GROUP BY sc.id, sc.name
            ORDER BY total DESC
          `,
          prisma.$queryRaw<Array<{ categoria: string; mes: string; total: any }>>`
            SELECT
              COALESCE(sc.name, 'Sin Categoría') as categoria,
              TO_CHAR(DATE_TRUNC('month', pr."fechaEmision"), 'YYYY-MM') as mes,
              COALESCE(SUM(pri.subtotal), 0) as total
            FROM "PurchaseReceiptItem" pri
            JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
            LEFT JOIN supplies s ON s.id = pri."supplierItemId"
            LEFT JOIN supply_categories sc ON sc.id = s."categoryId"
            WHERE pr."companyId" = ${companyId}
              AND pr."fechaEmision" >= ${sixMonthsAgo}
            GROUP BY sc.name, DATE_TRUNC('month', pr."fechaEmision")
            ORDER BY sc.name, mes
          `
        ]);

        const totalGasto = gastoPorCategoria.reduce((s, c) => s + Number(c.total || 0), 0);

        // Group trends by category
        const tendenciaPorCategoria: Record<string, Array<{ mes: string; total: number }>> = {};
        for (const t of tendenciaCategorias) {
          if (!tendenciaPorCategoria[t.categoria]) {
            tendenciaPorCategoria[t.categoria] = [];
          }
          tendenciaPorCategoria[t.categoria].push({
            mes: t.mes,
            total: Number(t.total || 0)
          });
        }

        result = {
          categorias: categorias.map(c => ({
            id: c.id,
            nombre: c.name,
            codigo: c.code,
            color: c.color,
            parentId: c.parentId,
            cantidadInsumos: c._count.supplies
          })),
          gastoPorCategoria: gastoPorCategoria.map(c => ({
            categoriaId: c.categoria_id,
            categoria: c.categoria,
            total: Number(c.total || 0),
            cantidadItems: Number(c.cantidad_items || 0),
            cantidadFacturas: Number(c.cantidad_facturas || 0),
            porcentaje: totalGasto > 0 ? (Number(c.total || 0) / totalGasto * 100) : 0
          })),
          tendencia: tendenciaPorCategoria,
          resumen: {
            totalCategorias: categorias.length,
            totalGasto,
            categoriasConGasto: gastoPorCategoria.filter(c => Number(c.total) > 0).length
          }
        };
        break;
      }

      case 'servicios': {
        // Service contracts analysis (NEW)
        const [contratos, gastoMensual, porTipo, proxVencimientos] = await Promise.all([
          prisma.serviceContract.findMany({
            where: { companyId, estado: { in: ['ACTIVO', 'POR_VENCER'] } },
            select: {
              id: true,
              numero: true,
              nombre: true,
              tipo: true,
              estado: true,
              montoPeriodo: true,
              frecuenciaPago: true,
              fechaFin: true,
              proveedor: { select: { name: true } },
              machine: { select: { name: true } }
            },
            orderBy: { fechaFin: 'asc' }
          }),
          // Calcular gasto mensual estimado
          prisma.$queryRaw<[{ gasto_mensual: any }]>`
            SELECT SUM(
              CASE "frecuenciaPago"
                WHEN 'UNICO' THEN 0
                WHEN 'MENSUAL' THEN COALESCE("montoPeriodo", 0)
                WHEN 'BIMESTRAL' THEN COALESCE("montoPeriodo", 0) / 2
                WHEN 'TRIMESTRAL' THEN COALESCE("montoPeriodo", 0) / 3
                WHEN 'CUATRIMESTRAL' THEN COALESCE("montoPeriodo", 0) / 4
                WHEN 'SEMESTRAL' THEN COALESCE("montoPeriodo", 0) / 6
                WHEN 'ANUAL' THEN COALESCE("montoPeriodo", 0) / 12
                ELSE 0
              END
            ) as gasto_mensual
            FROM service_contracts
            WHERE "companyId" = ${companyId}
              AND estado IN ('ACTIVO', 'POR_VENCER')
          `,
          // Por tipo
          prisma.serviceContract.groupBy({
            by: ['tipo'],
            where: { companyId, estado: { in: ['ACTIVO', 'POR_VENCER'] } },
            _count: true,
            _sum: { montoPeriodo: true }
          }),
          // Próximos vencimientos
          prisma.serviceContract.findMany({
            where: {
              companyId,
              estado: { in: ['ACTIVO', 'POR_VENCER'] },
              fechaFin: {
                gte: now,
                lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
              }
            },
            select: {
              id: true,
              nombre: true,
              tipo: true,
              fechaFin: true,
              montoPeriodo: true,
              proveedor: { select: { name: true } }
            },
            orderBy: { fechaFin: 'asc' },
            take: 10
          })
        ]);

        const tipoLabels: Record<string, string> = {
          SEGURO_MAQUINARIA: 'Seguro Maquinaria',
          SEGURO_VEHICULO: 'Seguro Vehículo',
          SEGURO_INSTALACIONES: 'Seguro Instalaciones',
          SEGURO_RESPONSABILIDAD: 'Seguro RC',
          SERVICIO_TECNICO: 'Servicio Técnico',
          MANTENIMIENTO_PREVENTIVO: 'Mant. Preventivo',
          CALIBRACION: 'Calibración',
          CERTIFICACION: 'Certificación',
          ALQUILER_EQUIPO: 'Alquiler Equipo',
          LICENCIA_SOFTWARE: 'Licencia Software',
          CONSULTORIA: 'Consultoría',
          VIGILANCIA: 'Vigilancia',
          LIMPIEZA: 'Limpieza',
          TRANSPORTE: 'Transporte',
          OTRO: 'Otro'
        };

        result = {
          contratos: contratos.map(c => ({
            id: c.id,
            numero: c.numero,
            nombre: c.nombre,
            tipo: c.tipo,
            tipoLabel: tipoLabels[c.tipo] || c.tipo,
            estado: c.estado,
            montoPeriodo: Number(c.montoPeriodo || 0),
            frecuenciaPago: c.frecuenciaPago,
            fechaFin: c.fechaFin,
            proveedor: c.proveedor.name,
            maquina: c.machine?.name || null
          })),
          porTipo: porTipo.map(t => ({
            tipo: t.tipo,
            tipoLabel: tipoLabels[t.tipo] || t.tipo,
            cantidad: t._count,
            montoTotal: Number(t._sum.montoPeriodo || 0)
          })),
          proxVencimientos: proxVencimientos.map(p => ({
            id: p.id,
            nombre: p.nombre,
            tipo: tipoLabels[p.tipo] || p.tipo,
            fechaFin: p.fechaFin,
            diasRestantes: Math.ceil((new Date(p.fechaFin!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
            montoPeriodo: Number(p.montoPeriodo || 0),
            proveedor: p.proveedor.name
          })),
          resumen: {
            totalContratos: contratos.length,
            gastoMensualEstimado: Number(gastoMensual[0]?.gasto_mensual || 0),
            gastoAnualEstimado: Number(gastoMensual[0]?.gasto_mensual || 0) * 12,
            contratosProxVencer: proxVencimientos.length
          }
        };
        break;
      }

      default:
        result = { error: 'Tipo de estadística no válido' };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching stats detail:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas detalladas' },
      { status: 500 }
    );
  }
}
