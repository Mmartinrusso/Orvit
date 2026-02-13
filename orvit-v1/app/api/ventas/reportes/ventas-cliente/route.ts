import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

// GET - Reporte de ventas por cliente
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('clienteId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    if (!clienteId) {
      return NextResponse.json({ error: 'clienteId es requerido' }, { status: 400 });
    }

    // Verificar que el cliente pertenece a la empresa
    const cliente = await prisma.client.findFirst({
      where: { id: clienteId, companyId },
      select: {
        id: true,
        name: true,
        legalName: true,
        cuit: true,
        email: true,
        phone: true,
        address: true,
        currentBalance: true,
        creditLimit: true,
      }
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Base filters
    const dateFilter = {
      ...(fechaDesde && { gte: new Date(fechaDesde) }),
      ...(fechaHasta && { lte: new Date(fechaHasta) }),
    };

    // Obtener cotizaciones del cliente (Quote doesn't have docType)
    const cotizaciones = await prisma.quote.findMany({
      where: {
        clientId: clienteId,
        companyId,
        ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
      },
      select: {
        id: true,
        numero: true,
        fechaEmision: true,
        fechaValidez: true,
        estado: true,
        total: true,
        moneda: true,
      },
      orderBy: { fechaEmision: 'desc' },
      take: 50,
    });

    // Obtener órdenes de venta del cliente
    const ordenes = await prisma.sale.findMany({
      where: applyViewMode({
        clientId: clienteId,
        companyId,
        ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
      }, viewMode),
      select: {
        id: true,
        numero: true,
        fechaEmision: true,
        estado: true,
        total: true,
        moneda: true,
        seller: { select: { id: true, name: true } },
        _count: { select: { invoices: true, deliveries: true } },
      },
      orderBy: { fechaEmision: 'desc' },
      take: 100,
    });

    // Obtener facturas del cliente
    const facturas = await prisma.salesInvoice.findMany({
      where: applyViewMode({
        clientId: clienteId,
        companyId,
        ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
      }, viewMode),
      select: {
        id: true,
        numero: true,
        tipo: true,
        fechaEmision: true,
        fechaVencimiento: true,
        estado: true,
        total: true,
        saldoPendiente: true,
        moneda: true,
      },
      orderBy: { fechaEmision: 'desc' },
      take: 100,
    });

    // Obtener pagos del cliente
    const pagos = await prisma.clientPayment.findMany({
      where: applyViewMode({
        clientId: clienteId,
        companyId,
        ...(Object.keys(dateFilter).length > 0 && { fechaPago: dateFilter }),
      }, viewMode),
      select: {
        id: true,
        numero: true,
        fechaPago: true,
        totalPago: true,
        efectivo: true,
        transferencia: true,
        chequesTerceros: true,
        estado: true,
        allocations: {
          select: {
            montoAplicado: true,
            invoice: { select: { numero: true } },
          },
        },
      },
      orderBy: { fechaPago: 'desc' },
      take: 100,
    });

    // Calcular totales
    const totales = {
      cotizacionesTotal: cotizaciones.reduce((sum, c) => sum + Number(c.total), 0),
      cotizacionesPendientes: cotizaciones.filter(c => ['BORRADOR', 'ENVIADA'].includes(c.estado)).length,
      cotizacionesAceptadas: cotizaciones.filter(c => c.estado === 'ACEPTADA').length,

      ordenesTotal: ordenes.reduce((sum, o) => sum + Number(o.total), 0),
      ordenesPendientes: ordenes.filter(o => ['BORRADOR', 'CONFIRMADA'].includes(o.estado)).length,
      ordenesCompletadas: ordenes.filter(o => o.estado === 'ENTREGADA').length,

      facturasTotal: facturas.reduce((sum, f) => sum + Number(f.total), 0),
      facturasPendientes: facturas.filter(f => ['EMITIDA', 'PARCIALMENTE_COBRADA'].includes(f.estado)).length,
      facturasCobradas: facturas.filter(f => f.estado === 'COBRADA').length,
      saldoPendienteTotal: facturas.reduce((sum, f) => sum + Number(f.saldoPendiente || 0), 0),

      pagosTotal: pagos.reduce((sum, p) => sum + Number(p.totalPago), 0),
      pagosConfirmados: pagos.filter(p => p.estado === 'CONFIRMADO').length,
    };

    // Promedio de días de pago (facturas cobradas)
    const facturasCobradas = facturas.filter(f => f.estado === 'COBRADA');
    let promedioDiasPago = 0;
    if (facturasCobradas.length > 0) {
      // Este cálculo es simplificado, en producción se calcularía con los pagos reales
      promedioDiasPago = 30; // Placeholder
    }

    const response = NextResponse.json({
      cliente,
      periodo: {
        desde: fechaDesde || 'Inicio',
        hasta: fechaHasta || 'Hoy',
      },
      cotizaciones,
      ordenes,
      facturas,
      pagos,
      totales: {
        ...totales,
        promedioDiasPago,
        deudaActual: Number(cliente.currentBalance) || 0,
        limiteCredito: Number(cliente.creditLimit) || 0,
        creditoDisponible: (Number(cliente.creditLimit) || 0) - (Number(cliente.currentBalance) || 0),
      },
      generadoEn: new Date().toISOString(),
    });

    // Add cache headers (30 seconds cache for reports)
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    return response;
  } catch (error) {
    console.error('Error generando reporte ventas-cliente:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
