import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

// GET - Reporte de cobranzas pendientes con aging
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('clienteId');
    const vendedorId = searchParams.get('vendedorId');
    // Pagination for todasLasFacturas
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '100'), 500); // Max 500

    const hoy = new Date();

    // Obtener facturas pendientes (EMITIDA o PARCIALMENTE_COBRADA)
    const facturasPendientes = await prisma.salesInvoice.findMany({
      where: applyViewMode({
        companyId,
        estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
        saldoPendiente: { gt: 0 },
        ...(clienteId && { clientId: clienteId }),
        ...(vendedorId && { sale: { sellerId: parseInt(vendedorId) } }),
      }, viewMode),
      select: {
        id: true,
        numero: true,
        tipo: true,
        fechaEmision: true,
        fechaVencimiento: true,
        total: true,
        saldoPendiente: true,
        estado: true,
        client: {
          select: {
            id: true,
            legalName: true,
            name: true,
            phone: true,
            email: true,
            currentBalance: true,
          },
        },
        sale: {
          select: {
            numero: true,
            seller: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { fechaVencimiento: 'asc' },
    });

    // Calcular días de atraso y categorizar
    const facturasConAging = facturasPendientes.map(f => {
      const fechaVenc = f.fechaVencimiento ? new Date(f.fechaVencimiento) : new Date(f.fechaEmision);
      const diasAtraso = Math.floor((hoy.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));

      let categoria: 'vigente' | '1-30' | '31-60' | '61-90' | '90+';
      if (diasAtraso <= 0) {
        categoria = 'vigente';
      } else if (diasAtraso <= 30) {
        categoria = '1-30';
      } else if (diasAtraso <= 60) {
        categoria = '31-60';
      } else if (diasAtraso <= 90) {
        categoria = '61-90';
      } else {
        categoria = '90+';
      }

      return {
        ...f,
        diasAtraso: Math.max(0, diasAtraso),
        categoria,
        saldoPendiente: Number(f.saldoPendiente),
      };
    });

    // Agrupar por categoría de aging
    const aging = {
      vigente: { count: 0, monto: 0, facturas: [] as typeof facturasConAging },
      '1-30': { count: 0, monto: 0, facturas: [] as typeof facturasConAging },
      '31-60': { count: 0, monto: 0, facturas: [] as typeof facturasConAging },
      '61-90': { count: 0, monto: 0, facturas: [] as typeof facturasConAging },
      '90+': { count: 0, monto: 0, facturas: [] as typeof facturasConAging },
    };

    facturasConAging.forEach(f => {
      aging[f.categoria].count++;
      aging[f.categoria].monto += f.saldoPendiente;
      aging[f.categoria].facturas.push(f);
    });

    // Agrupar por cliente
    const clientesMap = new Map<string, {
      cliente: typeof facturasConAging[0]['client'];
      facturas: number;
      montoTotal: number;
      diasPromedioAtraso: number;
      facturasList: typeof facturasConAging;
    }>();

    facturasConAging.forEach(f => {
      const clienteId = f.client.id;
      if (!clientesMap.has(clienteId)) {
        clientesMap.set(clienteId, {
          cliente: f.client,
          facturas: 0,
          montoTotal: 0,
          diasPromedioAtraso: 0,
          facturasList: [],
        });
      }
      const entry = clientesMap.get(clienteId)!;
      entry.facturas++;
      entry.montoTotal += f.saldoPendiente;
      entry.facturasList.push(f);
    });

    // Calcular promedio de días de atraso por cliente
    clientesMap.forEach(entry => {
      const totalDias = entry.facturasList.reduce((sum, f) => sum + f.diasAtraso, 0);
      entry.diasPromedioAtraso = Math.round(totalDias / entry.facturas);
    });

    // Convertir a array y ordenar por monto descendente
    const porCliente = Array.from(clientesMap.values())
      .sort((a, b) => b.montoTotal - a.montoTotal);

    // Totales generales
    const totales = {
      facturas: facturasConAging.length,
      montoTotal: facturasConAging.reduce((sum, f) => sum + f.saldoPendiente, 0),
      clientes: clientesMap.size,
      diasPromedioAtraso: facturasConAging.length > 0
        ? Math.round(facturasConAging.reduce((sum, f) => sum + f.diasAtraso, 0) / facturasConAging.length)
        : 0,
    };

    // Top 10 facturas más antiguas
    const facturasUrgentes = [...facturasConAging]
      .filter(f => f.diasAtraso > 0)
      .sort((a, b) => b.diasAtraso - a.diasAtraso)
      .slice(0, 10);

    // Resumen de aging
    const resumenAging = [
      { categoria: 'Vigente', count: aging.vigente.count, monto: aging.vigente.monto, color: 'green' },
      { categoria: '1-30 días', count: aging['1-30'].count, monto: aging['1-30'].monto, color: 'yellow' },
      { categoria: '31-60 días', count: aging['31-60'].count, monto: aging['31-60'].monto, color: 'orange' },
      { categoria: '61-90 días', count: aging['61-90'].count, monto: aging['61-90'].monto, color: 'red' },
      { categoria: '+90 días', count: aging['90+'].count, monto: aging['90+'].monto, color: 'darkred' },
    ];

    // Paginate todasLasFacturas
    const totalFacturas = facturasConAging.length;
    const totalPages = Math.ceil(totalFacturas / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedFacturas = facturasConAging.slice(startIndex, startIndex + pageSize);

    const response = NextResponse.json({
      totales,
      aging: resumenAging,
      porCliente: porCliente.slice(0, 50), // Top 50 clientes
      facturasUrgentes,
      todasLasFacturas: paginatedFacturas,
      pagination: {
        page,
        pageSize,
        totalItems: totalFacturas,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      generadoEn: new Date().toISOString(),
    });

    // Add cache headers (30 seconds cache for reports)
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    return response;
  } catch (error) {
    console.error('Error generando reporte cobranzas-pendientes:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
