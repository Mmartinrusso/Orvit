import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

// GET - Estado de cuenta de un cliente
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

    // Verificar cliente
    const cliente = await prisma.client.findFirst({
      where: { id: clienteId, companyId },
      select: {
        id: true,
        name: true,
        legalName: true,
        cuit: true,
        email: true,
        currentBalance: true,
        creditLimit: true,
      }
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const dateFilter = {
      ...(fechaDesde && { gte: new Date(fechaDesde) }),
      ...(fechaHasta && { lte: new Date(fechaHasta) }),
    };

    // Obtener movimientos del ledger
    const movimientos = await prisma.clientLedgerEntry.findMany({
      where: applyViewMode({
        clientId: clienteId,
        companyId,
        ...(Object.keys(dateFilter).length > 0 && { fecha: dateFilter }),
      }, viewMode),
      orderBy: { fecha: 'desc' },
      take: 200,
    });

    // Obtener facturas pendientes
    const facturasPendientes = await prisma.salesInvoice.findMany({
      where: applyViewMode({
        clientId: clienteId,
        companyId,
        estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      select: {
        id: true,
        numero: true,
        fechaEmision: true,
        fechaVencimiento: true,
        total: true,
        saldoPendiente: true,
        estado: true,
      },
      orderBy: { fechaEmision: 'desc' },
    });

    // Obtener pagos del período
    const pagos = await prisma.clientPayment.findMany({
      where: applyViewMode({
        clientId: clienteId,
        companyId,
        estado: 'CONFIRMADO',
        ...(Object.keys(dateFilter).length > 0 && { fechaPago: dateFilter }),
      }, viewMode),
      select: {
        id: true,
        numero: true,
        fechaPago: true,
        totalPago: true,
        estado: true,
      },
      orderBy: { fechaPago: 'desc' },
    });

    // Calcular totales
    const totalFacturado = facturasPendientes.reduce((sum, f) => sum + Number(f.total), 0);
    const totalPendiente = facturasPendientes.reduce((sum, f) => sum + Number(f.saldoPendiente), 0);
    const totalPagado = pagos.reduce((sum, p) => sum + Number(p.totalPago), 0);

    // Calcular saldo inicial si hay filtro de fecha
    let saldoInicial = 0;
    if (fechaDesde) {
      const movimientosAnteriores = await prisma.clientLedgerEntry.aggregate({
        where: {
          clientId: clienteId,
          companyId,
          fecha: { lt: new Date(fechaDesde) },
        },
        _sum: {
          debe: true,
          haber: true,
        },
      });
      saldoInicial = Number(movimientosAnteriores._sum.debe || 0) - Number(movimientosAnteriores._sum.haber || 0);
    }

    // Calcular saldo corriente para cada movimiento
    let saldoAcumulado = saldoInicial;
    const movimientosConSaldo = movimientos.reverse().map(m => {
      saldoAcumulado += Number(m.debe) - Number(m.haber);
      return {
        ...m,
        saldoAcumulado,
      };
    }).reverse();

    const response = NextResponse.json({
      cliente,
      periodo: {
        desde: fechaDesde || 'Inicio',
        hasta: fechaHasta || 'Hoy',
      },
      saldoInicial,
      movimientos: movimientosConSaldo,
      facturasPendientes,
      pagos,
      totales: {
        totalFacturado,
        totalPendiente,
        totalPagado,
        saldoActual: Number(cliente.currentBalance || 0),
        creditoDisponible: cliente.creditLimit
          ? Number(cliente.creditLimit) - Number(cliente.currentBalance || 0)
          : null,
      },
      generadoEn: new Date().toISOString(),
    });

    // Add cache headers (30 seconds cache for reports)
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    return response;
  } catch (error) {
    console.error('Error generando estado de cuenta:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
