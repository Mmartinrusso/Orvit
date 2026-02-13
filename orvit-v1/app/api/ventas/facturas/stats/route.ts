import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * GET - Obtener estadísticas completas de facturas
 * Retorna todos los KPIs en una sola llamada
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const viewMode = getViewMode(request);
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    const where = applyViewMode(
      {
        companyId: user!.companyId,
        ...(fechaDesde &&
          fechaHasta && {
            fechaEmision: {
              gte: new Date(fechaDesde),
              lte: new Date(fechaHasta),
            },
          }),
      },
      viewMode
    );

    // Get all invoices for stats
    const facturas = await prisma.salesInvoice.findMany({
      where,
      select: {
        id: true,
        estado: true,
        total: true,
        saldoPendiente: true,
        fechaVencimiento: true,
      },
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    // Calculate stats
    const stats = {
      // Count by status
      porEstado: {
        BORRADOR: facturas.filter((f) => f.estado === 'BORRADOR').length,
        EMITIDA: facturas.filter((f) => f.estado === 'EMITIDA').length,
        ENVIADA: facturas.filter((f) => f.estado === 'ENVIADA').length,
        PARCIALMENTE_COBRADA: facturas.filter((f) => f.estado === 'PARCIALMENTE_COBRADA').length,
        COBRADA: facturas.filter((f) => f.estado === 'COBRADA').length,
        VENCIDA: facturas.filter((f) => f.estado === 'VENCIDA').length,
        ANULADA: facturas.filter((f) => f.estado === 'ANULADA').length,
      },

      // Total counts
      total: facturas.length,

      // Overdue invoices (emitidas or parcialmente cobradas past due date)
      vencidas: facturas.filter(
        (f) =>
          (f.estado === 'EMITIDA' || f.estado === 'PARCIALMENTE_COBRADA') &&
          f.fechaVencimiento &&
          new Date(f.fechaVencimiento) < now &&
          f.saldoPendiente > 0
      ).length,

      // Amounts
      totalFacturado: facturas
        .filter((f) => f.estado !== 'ANULADA' && f.estado !== 'BORRADOR')
        .reduce((sum, f) => sum + Number(f.total), 0),

      totalCobrado: facturas
        .filter((f) => f.estado !== 'ANULADA' && f.estado !== 'BORRADOR')
        .reduce((sum, f) => sum + (Number(f.total) - Number(f.saldoPendiente)), 0),

      totalPendiente: facturas
        .filter((f) => f.estado !== 'ANULADA' && f.estado !== 'BORRADOR' && f.estado !== 'COBRADA')
        .reduce((sum, f) => sum + Number(f.saldoPendiente), 0),

      totalVencido: facturas
        .filter(
          (f) =>
            (f.estado === 'EMITIDA' || f.estado === 'PARCIALMENTE_COBRADA') &&
            f.fechaVencimiento &&
            new Date(f.fechaVencimiento) < now &&
            f.saldoPendiente > 0
        )
        .reduce((sum, f) => sum + Number(f.saldoPendiente), 0),

      // Averages
      promedioFactura:
        facturas.length > 0
          ? facturas
              .filter((f) => f.estado !== 'ANULADA' && f.estado !== 'BORRADOR')
              .reduce((sum, f) => sum + Number(f.total), 0) / facturas.length
          : 0,

      // Cobrado percentage
      porcentajeCobrado:
        facturas.length > 0
          ? (facturas
              .filter((f) => f.estado !== 'ANULADA' && f.estado !== 'BORRADOR')
              .reduce((sum, f) => sum + (Number(f.total) - Number(f.saldoPendiente)), 0) /
              facturas
                .filter((f) => f.estado !== 'ANULADA' && f.estado !== 'BORRADOR')
                .reduce((sum, f) => sum + Number(f.total), 0)) *
            100
          : 0,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
