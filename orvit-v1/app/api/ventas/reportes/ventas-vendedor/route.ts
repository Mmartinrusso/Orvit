import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

// GET - Reporte de ventas por vendedor
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const vendedorId = searchParams.get('vendedorId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    const dateFilter = {
      ...(fechaDesde && { gte: new Date(fechaDesde) }),
      ...(fechaHasta && { lte: new Date(fechaHasta) }),
    };

    // Si se especifica un vendedor, obtener solo ese
    if (vendedorId) {
      const vendedor = await prisma.user.findFirst({
        where: { id: parseInt(vendedorId) },
        select: { id: true, name: true, email: true },
      });

      if (!vendedor) {
        return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 });
      }

      // Obtener métricas del vendedor (Quote doesn't have docType)
      const [cotizaciones, ordenes, facturas] = await Promise.all([
        prisma.quote.findMany({
          where: {
            companyId,
            sellerId: parseInt(vendedorId),
            ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
          },
          select: {
            id: true,
            numero: true,
            fechaEmision: true,
            estado: true,
            total: true,
            client: { select: { legalName: true, name: true } },
          },
          orderBy: { fechaEmision: 'desc' },
          take: 100,
        }),
        prisma.sale.findMany({
          where: applyViewMode({
            companyId,
            sellerId: parseInt(vendedorId),
            ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
          }, viewMode),
          select: {
            id: true,
            numero: true,
            fechaEmision: true,
            estado: true,
            total: true,
            client: { select: { legalName: true, name: true } },
          },
          orderBy: { fechaEmision: 'desc' },
          take: 100,
        }),
        prisma.salesInvoice.findMany({
          where: applyViewMode({
            companyId,
            sale: { sellerId: parseInt(vendedorId) },
            ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
          }, viewMode),
          select: {
            id: true,
            numero: true,
            fechaEmision: true,
            estado: true,
            total: true,
            saldoPendiente: true,
            client: { select: { legalName: true, name: true } },
          },
          orderBy: { fechaEmision: 'desc' },
          take: 100,
        }),
      ]);

      const totales = {
        cotizacionesEmitidas: cotizaciones.length,
        cotizacionesAceptadas: cotizaciones.filter(c => c.estado === 'ACEPTADA').length,
        cotizacionesTotal: cotizaciones.reduce((sum, c) => sum + Number(c.total), 0),
        tasaConversion: cotizaciones.length > 0
          ? Math.round((cotizaciones.filter(c => c.estado === 'ACEPTADA').length / cotizaciones.length) * 100)
          : 0,

        ordenesGeneradas: ordenes.length,
        ordenesTotal: ordenes.reduce((sum, o) => sum + Number(o.total), 0),

        facturasEmitidas: facturas.length,
        facturasTotal: facturas.reduce((sum, f) => sum + Number(f.total), 0),
        facturasCobradas: facturas.filter(f => f.estado === 'COBRADA').length,
        facturasPendientes: facturas.filter(f => ['EMITIDA', 'PARCIALMENTE_COBRADA'].includes(f.estado)).length,
      };

      // Clientes únicos
      const clientesUnicos = new Set([
        ...ordenes.map(o => o.client?.legalName || o.client?.name),
        ...facturas.map(f => f.client?.legalName || f.client?.name),
      ]).size;

      const response = NextResponse.json({
        vendedor,
        periodo: {
          desde: fechaDesde || 'Inicio',
          hasta: fechaHasta || 'Hoy',
        },
        cotizaciones,
        ordenes,
        facturas,
        totales: {
          ...totales,
          clientesAtendidos: clientesUnicos,
          ticketPromedio: totales.ordenesGeneradas > 0
            ? Math.round(totales.ordenesTotal / totales.ordenesGeneradas)
            : 0,
        },
        generadoEn: new Date().toISOString(),
      });

      // Add cache headers (30 seconds cache for reports)
      response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

      return response;
    }

    // Si no se especifica vendedor, mostrar ranking de todos los vendedores
    const vendedores = await prisma.user.findMany({
      where: {
        companies: { some: { companyId } },
      },
      select: { id: true, name: true, email: true },
    });

    // Obtener métricas agregadas por vendedor
    const rankingVendedores = await Promise.all(
      vendedores.map(async (vendedor) => {
        const [ordenesCount, ordenesTotal, facturasTotal] = await Promise.all([
          prisma.sale.count({
            where: applyViewMode({
              companyId,
              sellerId: vendedor.id,
              ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
            }, viewMode),
          }),
          prisma.sale.aggregate({
            where: applyViewMode({
              companyId,
              sellerId: vendedor.id,
              ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
            }, viewMode),
            _sum: { total: true },
          }),
          prisma.salesInvoice.aggregate({
            where: applyViewMode({
              companyId,
              sale: { sellerId: vendedor.id },
              ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
            }, viewMode),
            _sum: { total: true },
          }),
        ]);

        return {
          vendedor,
          ordenes: ordenesCount,
          totalVentas: Number(ordenesTotal._sum.total || 0),
          totalFacturado: Number(facturasTotal._sum.total || 0),
          ticketPromedio: ordenesCount > 0
            ? Math.round(Number(ordenesTotal._sum.total || 0) / ordenesCount)
            : 0,
        };
      })
    );

    // Ordenar por total de ventas
    rankingVendedores.sort((a, b) => b.totalVentas - a.totalVentas);

    // Calcular participación
    const totalGeneral = rankingVendedores.reduce((sum, v) => sum + v.totalVentas, 0);
    const rankingConParticipacion = rankingVendedores.map((v, index) => ({
      ...v,
      posicion: index + 1,
      participacion: totalGeneral > 0
        ? Math.round((v.totalVentas / totalGeneral) * 100)
        : 0,
    }));

    const response = NextResponse.json({
      periodo: {
        desde: fechaDesde || 'Inicio',
        hasta: fechaHasta || 'Hoy',
      },
      ranking: rankingConParticipacion,
      totales: {
        vendedores: vendedores.length,
        totalVentas: totalGeneral,
        promedioVendedor: vendedores.length > 0
          ? Math.round(totalGeneral / vendedores.length)
          : 0,
      },
      generadoEn: new Date().toISOString(),
    });

    // Add cache headers (30 seconds cache for reports)
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    return response;
  } catch (error) {
    console.error('Error generando reporte ventas-vendedor:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
