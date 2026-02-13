import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, QuoteStatus } from '@prisma/client';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// Helper: calcular tendencia comparando período actual vs anterior
function calcularTendencia(actual: number, anterior: number): { valor: number; variacion: number; tendencia: 'up' | 'down' | 'stable' } {
  let variacion = 0;
  let tendencia: 'up' | 'down' | 'stable' = 'stable';

  if (anterior > 0) {
    variacion = Math.round(((actual - anterior) / anterior) * 1000) / 10;
  } else if (actual > 0) {
    variacion = 100;
  }

  if (variacion > 1) tendencia = 'up';
  else if (variacion < -1) tendencia = 'down';
  else tendencia = 'stable';

  return { valor: actual, variacion, tendencia };
}

// GET - Obtener estadísticas de cotizaciones
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);

    // Parámetros de período
    const periodoParam = searchParams.get('periodo') || '30d';
    const vendedorId = searchParams.get('vendedorId');

    // Calcular fechas según período
    const ahora = new Date();
    let diasPeriodo: number;

    switch (periodoParam) {
      case '7d': diasPeriodo = 7; break;
      case '30d': diasPeriodo = 30; break;
      case '90d': diasPeriodo = 90; break;
      case '1y': diasPeriodo = 365; break;
      default: diasPeriodo = 30;
    }

    const fechaDesde = new Date(ahora.getTime() - diasPeriodo * 24 * 60 * 60 * 1000);

    // Período anterior (mismo rango de días, corrido hacia atrás)
    const fechaDesdeAnterior = new Date(fechaDesde.getTime() - diasPeriodo * 24 * 60 * 60 * 1000);
    const fechaHastaAnterior = fechaDesde;

    // Base where - sin ViewMode porque cotizaciones no usan docType fiscal
    const baseWhere: Prisma.QuoteWhereInput = {
      companyId,
      createdAt: { gte: fechaDesde },
      ...(vendedorId && { sellerId: parseInt(vendedorId) }),
    };

    // Si el usuario no es admin, solo ve sus cotizaciones
    const isAdmin = user!.role === 'ADMIN' || user!.role === 'OWNER';
    if (!isAdmin && !vendedorId) {
      baseWhere.sellerId = user!.id;
    }

    // Base where para período anterior
    const baseWhereAnterior: Prisma.QuoteWhereInput = {
      ...baseWhere,
      createdAt: { gte: fechaDesdeAnterior, lt: fechaHastaAnterior },
    };

    // Ejecutar todas las consultas en paralelo para optimizar
    const [
      totalesResult,
      porEstadoResult,
      topClientesResult,
      topVendedoresResult,
      porVencerResult,
      evolucionResult,
      tiemposResult,
      // Período anterior
      totalesAnteriorResult,
      porEstadoAnteriorResult,
    ] = await Promise.all([
      // 1. Totales generales
      prisma.quote.aggregate({
        where: baseWhere,
        _count: true,
        _sum: { total: true },
        _avg: { total: true }
      }),

      // 2. Por estado
      prisma.quote.groupBy({
        by: ['estado'],
        where: baseWhere,
        _count: true,
        _sum: { total: true }
      }),

      // 3. Top 5 clientes
      prisma.quote.groupBy({
        by: ['clientId'],
        where: baseWhere,
        _count: true,
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5
      }),

      // 4. Top 5 vendedores
      prisma.quote.groupBy({
        by: ['sellerId'],
        where: {
          ...baseWhere,
          sellerId: { not: null }
        },
        _count: true,
        _sum: { total: true },
        orderBy: { _count: { sellerId: 'desc' } },
        take: 5
      }),

      // 5. Por vencer (próximos 7 días)
      prisma.quote.findMany({
        where: {
          companyId,
          estado: { in: ['BORRADOR', 'ENVIADA', 'EN_NEGOCIACION'] },
          fechaValidez: {
            gte: ahora,
            lte: new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          id: true,
          numero: true,
          fechaValidez: true,
          total: true,
          client: {
            select: { legalName: true, name: true }
          }
        },
        orderBy: { fechaValidez: 'asc' },
        take: 10
      }),

      // 6. Evolución mensual (últimos 6 meses)
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as mes,
          COUNT(*) FILTER (WHERE estado = 'ENVIADA' OR estado = 'EN_NEGOCIACION' OR estado = 'ACEPTADA' OR estado = 'CONVERTIDA' OR estado = 'PERDIDA') as enviadas,
          COUNT(*) FILTER (WHERE estado = 'ACEPTADA' OR estado = 'CONVERTIDA') as aceptadas,
          COUNT(*) FILTER (WHERE estado = 'PERDIDA') as perdidas,
          COALESCE(SUM(total), 0) as monto_total
        FROM "quotes"
        WHERE "companyId" = ${companyId}
          AND "createdAt" >= ${new Date(ahora.getTime() - 180 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY mes DESC
        LIMIT 6
      ` as Promise<Array<{ mes: string; enviadas: bigint; aceptadas: bigint; perdidas: bigint; monto_total: number }>>,

      // 7. Tiempos promedio
      prisma.$queryRaw`
        SELECT
          AVG(EXTRACT(EPOCH FROM ("fechaEnvio" - "fechaEmision")) / 86400) as promedio_envio,
          AVG(EXTRACT(EPOCH FROM ("fechaCierre" - "fechaEnvio")) / 86400) as promedio_cierre,
          AVG(EXTRACT(EPOCH FROM ("convertidaAt" - "fechaEmision")) / 86400) as promedio_conversion
        FROM "quotes"
        WHERE "companyId" = ${companyId}
          AND "createdAt" >= ${fechaDesde}
      ` as Promise<Array<{ promedio_envio: number | null; promedio_cierre: number | null; promedio_conversion: number | null }>>,

      // 8. Totales período anterior
      prisma.quote.aggregate({
        where: baseWhereAnterior,
        _count: true,
        _sum: { total: true },
        _avg: { total: true }
      }),

      // 9. Por estado período anterior
      prisma.quote.groupBy({
        by: ['estado'],
        where: baseWhereAnterior,
        _count: true,
        _sum: { total: true }
      }),
    ]);

    // Obtener nombres de clientes para top
    const clientIds = topClientesResult.map(c => c.clientId);
    const clientes = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, legalName: true, name: true }
    });
    const clientesMap = new Map(clientes.map(c => [c.id, c]));

    // Obtener nombres de vendedores para top
    const sellerIds = topVendedoresResult.map(v => v.sellerId).filter((id): id is number => id !== null);
    const vendedores = await prisma.user.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, name: true }
    });
    const vendedoresMap = new Map(vendedores.map(v => [v.id, v]));

    // Calcular métricas de conversión - período actual
    const estadosMap: Record<string, { count: number; total: number }> = {};
    for (const estado of porEstadoResult) {
      estadosMap[estado.estado] = {
        count: estado._count,
        total: Number(estado._sum.total || 0)
      };
    }

    const enviadas = (estadosMap['ENVIADA']?.count || 0) +
                     (estadosMap['EN_NEGOCIACION']?.count || 0) +
                     (estadosMap['ACEPTADA']?.count || 0) +
                     (estadosMap['CONVERTIDA']?.count || 0) +
                     (estadosMap['PERDIDA']?.count || 0);
    const aceptadas = (estadosMap['ACEPTADA']?.count || 0) + (estadosMap['CONVERTIDA']?.count || 0);
    const convertidas = estadosMap['CONVERTIDA']?.count || 0;
    const perdidas = estadosMap['PERDIDA']?.count || 0;

    // Calcular métricas de conversión - período anterior
    const estadosMapAnterior: Record<string, { count: number; total: number }> = {};
    for (const estado of porEstadoAnteriorResult) {
      estadosMapAnterior[estado.estado] = {
        count: estado._count,
        total: Number(estado._sum.total || 0)
      };
    }

    const enviadasAnterior = (estadosMapAnterior['ENVIADA']?.count || 0) +
                             (estadosMapAnterior['EN_NEGOCIACION']?.count || 0) +
                             (estadosMapAnterior['ACEPTADA']?.count || 0) +
                             (estadosMapAnterior['CONVERTIDA']?.count || 0) +
                             (estadosMapAnterior['PERDIDA']?.count || 0);
    const aceptadasAnterior = (estadosMapAnterior['ACEPTADA']?.count || 0) + (estadosMapAnterior['CONVERTIDA']?.count || 0);

    const tasaAceptacionActual = enviadas > 0 ? (aceptadas / enviadas) * 100 : 0;
    const tasaAceptacionAnterior = enviadasAnterior > 0 ? (aceptadasAnterior / enviadasAnterior) * 100 : 0;

    // Calcular conteo de cotizaciones aceptadas por cliente para tasa
    const clientesConAceptadas = await prisma.quote.groupBy({
      by: ['clientId'],
      where: {
        ...baseWhere,
        estado: { in: ['ACEPTADA', 'CONVERTIDA'] }
      },
      _count: true
    });
    const aceptadasPorCliente = new Map(clientesConAceptadas.map(c => [c.clientId, c._count]));

    // Calcular conteo de cotizaciones aceptadas por vendedor para tasa
    const vendedoresConAceptadas = await prisma.quote.groupBy({
      by: ['sellerId'],
      where: {
        ...baseWhere,
        estado: { in: ['ACEPTADA', 'CONVERTIDA'] },
        sellerId: { not: null }
      },
      _count: true
    });
    const aceptadasPorVendedor = new Map(vendedoresConAceptadas.map(v => [v.sellerId!, v._count]));

    // Construir respuesta
    const response = {
      periodo: {
        desde: fechaDesde,
        hasta: ahora
      },

      totales: {
        cantidad: calcularTendencia(totalesResult._count, totalesAnteriorResult._count),
        montoTotal: calcularTendencia(
          Number(totalesResult._sum.total || 0),
          Number(totalesAnteriorResult._sum.total || 0)
        ),
        promedioMonto: calcularTendencia(
          Number(totalesResult._avg.total || 0),
          Number(totalesAnteriorResult._avg.total || 0)
        ),
      },

      porEstado: {
        BORRADOR: estadosMap['BORRADOR']?.count || 0,
        ENVIADA: estadosMap['ENVIADA']?.count || 0,
        EN_NEGOCIACION: estadosMap['EN_NEGOCIACION']?.count || 0,
        ACEPTADA: estadosMap['ACEPTADA']?.count || 0,
        CONVERTIDA: estadosMap['CONVERTIDA']?.count || 0,
        PERDIDA: estadosMap['PERDIDA']?.count || 0,
        VENCIDA: estadosMap['VENCIDA']?.count || 0
      },

      conversion: {
        enviadas: calcularTendencia(enviadas, enviadasAnterior),
        aceptadas: calcularTendencia(aceptadas, aceptadasAnterior),
        convertidas,
        perdidas,
        tasaAceptacion: calcularTendencia(tasaAceptacionActual, tasaAceptacionAnterior),
        tasaConversion: aceptadas > 0 ? (convertidas / aceptadas) * 100 : 0,
        tasaPerdida: enviadas > 0 ? (perdidas / enviadas) * 100 : 0
      },

      tiempos: {
        promedioEnvio: tiemposResult[0]?.promedio_envio ? Math.round(tiemposResult[0].promedio_envio * 10) / 10 : null,
        promedioCierre: tiemposResult[0]?.promedio_cierre ? Math.round(tiemposResult[0].promedio_cierre * 10) / 10 : null,
        promedioConversion: tiemposResult[0]?.promedio_conversion ? Math.round(tiemposResult[0].promedio_conversion * 10) / 10 : null
      },

      topClientes: topClientesResult.map(c => {
        const cliente = clientesMap.get(c.clientId);
        const aceptadasCliente = aceptadasPorCliente.get(c.clientId) || 0;
        return {
          id: c.clientId,
          nombre: cliente?.legalName || cliente?.name || 'Cliente desconocido',
          cotizaciones: c._count,
          aceptadas: aceptadasCliente,
          montoTotal: Number(c._sum.total || 0)
        };
      }),

      topVendedores: topVendedoresResult.map(v => {
        const vendedor = vendedoresMap.get(v.sellerId!);
        const totalVendedor = v._count;
        const aceptadasVendedor = aceptadasPorVendedor.get(v.sellerId!) || 0;
        return {
          id: v.sellerId,
          nombre: vendedor?.name || 'Vendedor desconocido',
          cotizaciones: totalVendedor,
          aceptadas: aceptadasVendedor,
          tasaAceptacion: totalVendedor > 0 ? (aceptadasVendedor / totalVendedor) * 100 : 0,
          montoTotal: Number(v._sum.total || 0)
        };
      }),

      porVencer: {
        cantidad: porVencerResult.length,
        items: porVencerResult.map(q => {
          const diasRestantes = Math.ceil((new Date(q.fechaValidez).getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: q.id,
            numero: q.numero,
            cliente: q.client.legalName || q.client.name || 'Sin nombre',
            fechaValidez: q.fechaValidez,
            diasRestantes,
            total: Number(q.total)
          };
        })
      },

      evolucionMensual: (evolucionResult as Array<{ mes: string; enviadas: bigint; aceptadas: bigint; perdidas: bigint; monto_total: number }>)
        .map(e => ({
          mes: e.mes,
          enviadas: Number(e.enviadas),
          aceptadas: Number(e.aceptadas),
          perdidas: Number(e.perdidas),
          montoTotal: Number(e.monto_total)
        }))
        .reverse()
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching cotizaciones stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener las estadísticas', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
