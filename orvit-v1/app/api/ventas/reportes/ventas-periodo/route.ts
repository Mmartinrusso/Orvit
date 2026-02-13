import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

type Agrupacion = 'diario' | 'semanal' | 'mensual';

// GET - Reporte de ventas por período
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const agrupacion = (searchParams.get('agrupacion') || 'mensual') as Agrupacion;
    const fechaDesdeParam = searchParams.get('fechaDesde');
    const fechaHastaParam = searchParams.get('fechaHasta');

    // Si no hay fechas, usar últimos 12 meses
    const fechaHasta = fechaHastaParam ? new Date(fechaHastaParam) : new Date();
    const fechaDesde = fechaDesdeParam
      ? new Date(fechaDesdeParam)
      : new Date(fechaHasta.getFullYear(), fechaHasta.getMonth() - 11, 1);

    // Obtener todas las órdenes en el rango
    const ordenes = await prisma.sale.findMany({
      where: applyViewMode({
        companyId,
        fechaEmision: {
          gte: fechaDesde,
          lte: fechaHasta,
        },
      }, viewMode),
      select: {
        id: true,
        fechaEmision: true,
        total: true,
        estado: true,
      },
      orderBy: { fechaEmision: 'asc' },
    });

    // Obtener todas las facturas en el rango
    const facturas = await prisma.salesInvoice.findMany({
      where: applyViewMode({
        companyId,
        fechaEmision: {
          gte: fechaDesde,
          lte: fechaHasta,
        },
      }, viewMode),
      select: {
        id: true,
        fechaEmision: true,
        total: true,
        saldoPendiente: true,
        estado: true,
      },
      orderBy: { fechaEmision: 'asc' },
    });

    // Obtener todos los pagos en el rango
    const pagos = await prisma.clientPayment.findMany({
      where: applyViewMode({
        companyId,
        fechaPago: {
          gte: fechaDesde,
          lte: fechaHasta,
        },
        estado: 'CONFIRMADO',
      }, viewMode),
      select: {
        id: true,
        fechaPago: true,
        totalPago: true,
      },
      orderBy: { fechaPago: 'asc' },
    });

    // Función para obtener clave de agrupación
    const getGroupKey = (fecha: Date): string => {
      const d = new Date(fecha);
      switch (agrupacion) {
        case 'diario':
          return d.toISOString().split('T')[0]; // YYYY-MM-DD
        case 'semanal':
          // Obtener inicio de semana (lunes)
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(d.setDate(diff));
          return `Sem ${monday.toISOString().split('T')[0]}`;
        case 'mensual':
        default:
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
    };

    // Agrupar datos
    const periodos = new Map<string, {
      periodo: string;
      ordenes: number;
      ordenesTotal: number;
      facturas: number;
      facturasTotal: number;
      cobrado: number;
      pendiente: number;
    }>();

    // Inicializar períodos vacíos
    const current = new Date(fechaDesde);
    while (current <= fechaHasta) {
      const key = getGroupKey(current);
      if (!periodos.has(key)) {
        periodos.set(key, {
          periodo: key,
          ordenes: 0,
          ordenesTotal: 0,
          facturas: 0,
          facturasTotal: 0,
          cobrado: 0,
          pendiente: 0,
        });
      }
      // Avanzar según agrupación
      if (agrupacion === 'diario') {
        current.setDate(current.getDate() + 1);
      } else if (agrupacion === 'semanal') {
        current.setDate(current.getDate() + 7);
      } else {
        current.setMonth(current.getMonth() + 1);
      }
    }

    // Procesar órdenes
    ordenes.forEach(o => {
      const key = getGroupKey(new Date(o.fechaEmision));
      const periodo = periodos.get(key);
      if (periodo) {
        periodo.ordenes++;
        periodo.ordenesTotal += Number(o.total);
      }
    });

    // Procesar facturas
    facturas.forEach(f => {
      const key = getGroupKey(new Date(f.fechaEmision));
      const periodo = periodos.get(key);
      if (periodo) {
        periodo.facturas++;
        periodo.facturasTotal += Number(f.total);
        periodo.pendiente += Number(f.saldoPendiente || 0);
      }
    });

    // Procesar pagos
    pagos.forEach(p => {
      const key = getGroupKey(new Date(p.fechaPago));
      const periodo = periodos.get(key);
      if (periodo) {
        periodo.cobrado += Number(p.totalPago);
      }
    });

    // Convertir a array y ordenar
    const datosAgrupados = Array.from(periodos.values())
      .sort((a, b) => a.periodo.localeCompare(b.periodo));

    // Calcular totales generales
    const totales = {
      ordenes: ordenes.length,
      ordenesTotal: ordenes.reduce((sum, o) => sum + Number(o.total), 0),
      facturas: facturas.length,
      facturasTotal: facturas.reduce((sum, f) => sum + Number(f.total), 0),
      cobrado: pagos.reduce((sum, p) => sum + Number(p.totalPago), 0),
      pendiente: facturas.reduce((sum, f) => sum + Number(f.saldoPendiente || 0), 0),
    };

    // Calcular variación vs período anterior
    const mitad = Math.floor(datosAgrupados.length / 2);
    const periodoActual = datosAgrupados.slice(mitad);
    const periodoAnterior = datosAgrupados.slice(0, mitad);

    const totalActual = periodoActual.reduce((sum, p) => sum + p.ordenesTotal, 0);
    const totalAnterior = periodoAnterior.reduce((sum, p) => sum + p.ordenesTotal, 0);

    const variacion = totalAnterior > 0
      ? Math.round(((totalActual - totalAnterior) / totalAnterior) * 100)
      : 0;

    // Calcular promedios
    const promedios = {
      ordenPorPeriodo: datosAgrupados.length > 0
        ? Math.round(totales.ordenes / datosAgrupados.length)
        : 0,
      ventaPorPeriodo: datosAgrupados.length > 0
        ? Math.round(totales.ordenesTotal / datosAgrupados.length)
        : 0,
      ticketPromedio: totales.ordenes > 0
        ? Math.round(totales.ordenesTotal / totales.ordenes)
        : 0,
    };

    const response = NextResponse.json({
      periodo: {
        desde: fechaDesde.toISOString().split('T')[0],
        hasta: fechaHasta.toISOString().split('T')[0],
        agrupacion,
      },
      datos: datosAgrupados,
      totales,
      promedios,
      variacion: {
        porcentaje: variacion,
        tendencia: variacion > 0 ? 'alza' : variacion < 0 ? 'baja' : 'estable',
      },
      generadoEn: new Date().toISOString(),
    });

    // Add cache headers (30 seconds cache for reports)
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    return response;
  } catch (error) {
    console.error('Error generando reporte ventas-periodo:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
