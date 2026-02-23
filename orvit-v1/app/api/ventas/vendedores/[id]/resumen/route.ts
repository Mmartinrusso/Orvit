import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Resumen completo de un vendedor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.VENDEDORES_RESUMEN);
    if (error) return error;

    const companyId = user!.companyId;
    const { id } = await params;
    const sellerId = parseInt(id);
    if (isNaN(sellerId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    // Fechas por defecto: últimos 30 días
    const desde = fechaDesde ? new Date(fechaDesde) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const hasta = fechaHasta ? new Date(fechaHasta) : new Date();

    // Obtener info del vendedor
    const vendedor = await prisma.user.findFirst({
      where: { id: sellerId, companyId },
      select: { id: true, name: true, email: true },
    });

    if (!vendedor) {
      return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 });
    }

    // Buscar SalesRep asociado
    const salesRep = await prisma.salesRep.findFirst({
      where: {
        companyId,
        OR: [
          { email: vendedor.email || '' },
          { nombre: vendedor.name || '' },
        ],
      },
      select: {
        id: true,
        nombre: true,
        comision: true,
        cuotaMensual: true,
        ventasMes: true,
        ventasAnio: true,
        zona: { select: { id: true, nombre: true } },
      },
    });

    // Cotizaciones del vendedor en el periodo
    const cotizaciones = await prisma.quote.findMany({
      where: {
        companyId,
        sellerId,
        fechaEmision: { gte: desde, lte: hasta },
      },
      select: {
        id: true,
        numero: true,
        estado: true,
        fechaEmision: true,
        total: true,
        moneda: true,
        client: { select: { id: true, legalName: true } },
        _count: { select: { items: true } },
        items: {
          select: {
            id: true,
            descripcion: true,
            cantidad: true,
            precioUnitario: true,
            subtotal: true,
            costBreakdown: {
              select: { id: true, concepto: true, monto: true, orden: true },
              orderBy: { orden: 'asc' as const },
            },
          },
        },
        sale: { select: { id: true, numero: true, estado: true } },
      },
      orderBy: { fechaEmision: 'desc' },
    });

    // Ventas del vendedor en el periodo
    const ventas = await prisma.sale.findMany({
      where: {
        companyId,
        sellerId,
        fechaEmision: { gte: desde, lte: hasta },
      },
      select: {
        id: true,
        numero: true,
        estado: true,
        fechaEmision: true,
        total: true,
        moneda: true,
        comisionPorcentaje: true,
        comisionMonto: true,
        comisionPagada: true,
        client: { select: { id: true, legalName: true } },
        invoices: {
          select: {
            id: true,
            numeroCompleto: true,
            estado: true,
            total: true,
            saldoPendiente: true,
            fechaEmision: true,
          },
        },
        items: {
          select: {
            id: true,
            descripcion: true,
            cantidad: true,
            precioUnitario: true,
            subtotal: true,
            costBreakdown: {
              select: { id: true, concepto: true, monto: true, orden: true },
              orderBy: { orden: 'asc' as const },
            },
          },
        },
      },
      orderBy: { fechaEmision: 'desc' },
    });

    // Facturas del periodo
    const facturas = await prisma.salesInvoice.findMany({
      where: {
        companyId,
        sale: { sellerId },
        fechaEmision: { gte: desde, lte: hasta },
      },
      select: {
        id: true,
        tipo: true,
        letra: true,
        numeroCompleto: true,
        fechaEmision: true,
        estado: true,
        total: true,
        saldoPendiente: true,
        sale: { select: { id: true, numero: true } },
        client: { select: { legalName: true } },
      },
      orderBy: { fechaEmision: 'desc' },
    });

    // Calcular KPIs
    const cotizacionesEmitidas = cotizaciones.length;
    const cotizacionesAceptadas = cotizaciones.filter(c =>
      ['ACEPTADA', 'CONVERTIDA'].includes(c.estado)
    ).length;
    const tasaConversion = cotizacionesEmitidas > 0
      ? (cotizacionesAceptadas / cotizacionesEmitidas) * 100
      : 0;

    const ventasTotal = ventas.reduce((sum, v) => sum + Number(v.total), 0);
    const comisionesGeneradas = ventas.reduce((sum, v) => sum + Number(v.comisionMonto || 0), 0);
    const comisionesPagadas = ventas
      .filter(v => v.comisionPagada)
      .reduce((sum, v) => sum + Number(v.comisionMonto || 0), 0);
    const comisionesPendientes = comisionesGeneradas - comisionesPagadas;

    const facturasEmitidas = facturas.length;
    const facturasCobradas = facturas.filter(f => Number(f.saldoPendiente) === 0).length;
    const clientesAtendidos = new Set(ventas.map(v => v.client.id)).size;
    const ticketPromedio = ventas.length > 0 ? ventasTotal / ventas.length : 0;

    const cuotaMensual = salesRep ? Number(salesRep.cuotaMensual) : 0;
    const avanceCuotaPorcentaje = cuotaMensual > 0 ? (ventasTotal / cuotaMensual) * 100 : 0;

    // Datos de evolución mensual (últimos 6 meses)
    const evolucionMensual = [];
    for (let i = 5; i >= 0; i--) {
      const mesDate = new Date();
      mesDate.setMonth(mesDate.getMonth() - i);
      const mesInicio = new Date(mesDate.getFullYear(), mesDate.getMonth(), 1);
      const mesFin = new Date(mesDate.getFullYear(), mesDate.getMonth() + 1, 0);

      const ventasMes = ventas.filter(v => {
        const fecha = new Date(v.fechaEmision);
        return fecha >= mesInicio && fecha <= mesFin;
      });

      const totalMes = ventasMes.reduce((sum, v) => sum + Number(v.total), 0);
      const comisionesMes = ventasMes.reduce((sum, v) => sum + Number(v.comisionMonto || 0), 0);

      evolucionMensual.push({
        mes: mesInicio.toISOString().slice(0, 7),
        mesLabel: mesInicio.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
        ventas: totalMes,
        comisiones: comisionesMes,
      });
    }

    // Distribución de estados de cotizaciones
    const estadoDistribucion: Record<string, number> = {};
    for (const cot of cotizaciones) {
      estadoDistribucion[cot.estado] = (estadoDistribucion[cot.estado] || 0) + 1;
    }

    return NextResponse.json({
      vendedor,
      salesRep,
      periodo: { desde, hasta },
      cotizaciones,
      ventas,
      facturas,
      evolucionMensual,
      estadoDistribucion,
      kpis: {
        cotizacionesEmitidas,
        cotizacionesAceptadas,
        tasaConversion,
        ventasTotal,
        comisionesGeneradas,
        comisionesPagadas,
        comisionesPendientes,
        facturasEmitidas,
        facturasCobradas,
        clientesAtendidos,
        ticketPromedio,
        cuotaMensual,
        avanceCuotaPorcentaje,
      },
    });
  } catch (error) {
    console.error('Error fetching seller summary:', error);
    return NextResponse.json(
      { error: 'Error al obtener el resumen del vendedor' },
      { status: 500 }
    );
  }
}
