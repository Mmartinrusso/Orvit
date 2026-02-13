/**
 * GET /api/ventas/cuenta-corriente/[clientId]
 *
 * Returns current account statement for a specific client:
 * - All invoices, payments, credit notes
 * - Running balance
 * - Date range filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    clientId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PAGOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const clientId = params.clientId;

    const { searchParams } = new URL(request.url);
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    // Fetch client
    const client = await prisma.client.findFirst({
      where: applyViewMode({ id: clientId, companyId }, viewMode),
      select: {
        id: true,
        legalName: true,
        name: true,
        cuit: true,
        currentBalance: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Build date filter
    const dateFilter: any = {};
    if (fechaDesde) {
      dateFilter.gte = new Date(fechaDesde);
    }
    if (fechaHasta) {
      const endDate = new Date(fechaHasta);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.lte = endDate;
    }

    // Fetch all transactions
    const baseWhere = applyViewMode({ clientId, companyId }, viewMode);

    // Invoices
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        ...baseWhere,
        estado: { notIn: ['ANULADA'] },
        ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
      },
      select: {
        id: true,
        numero: true,
        fechaEmision: true,
        total: true,
        saldoPendiente: true,
        estado: true,
        tipo: true,
      },
      orderBy: { fechaEmision: 'asc' },
    });

    // Payments
    const payments = await prisma.clientPayment.findMany({
      where: {
        ...baseWhere,
        estado: { notIn: ['ANULADO'] },
        ...(Object.keys(dateFilter).length > 0 && { fechaPago: dateFilter }),
      },
      select: {
        id: true,
        numero: true,
        fechaPago: true,
        totalPago: true,
        estado: true,
        allocations: {
          select: {
            invoiceId: true,
            montoAplicado: true,
            invoice: {
              select: {
                numero: true,
              },
            },
          },
        },
      },
      orderBy: { fechaPago: 'asc' },
    });

    // Credit Notes (if model exists)
    let creditNotes: any[] = [];
    try {
      creditNotes = await prisma.creditNote.findMany({
        where: {
          ...baseWhere,
          estado: { notIn: ['ANULADA'] },
          ...(Object.keys(dateFilter).length > 0 && { fecha: dateFilter }),
        },
        select: {
          id: true,
          numero: true,
          fecha: true,
          total: true,
          estado: true,
          motivo: true,
        },
        orderBy: { fecha: 'asc' },
      });
    } catch (e) {
      // CreditNote model might not exist yet
      console.log('CreditNote model not available');
    }

    // Combine and sort all transactions
    interface Transaction {
      id: number;
      tipo: 'FACTURA' | 'PAGO' | 'NOTA_CREDITO';
      numero: string;
      fecha: Date;
      debe: number;
      haber: number;
      saldo?: number;
      estado: string;
      detalles?: string;
    }

    const transactions: Transaction[] = [
      ...invoices.map((inv) => ({
        id: inv.id,
        tipo: 'FACTURA' as const,
        numero: inv.numero,
        fecha: new Date(inv.fechaEmision),
        debe: parseFloat(inv.total.toString()),
        haber: 0,
        estado: inv.estado,
        detalles: inv.tipo || undefined,
      })),
      ...payments.map((pmt) => ({
        id: pmt.id,
        tipo: 'PAGO' as const,
        numero: pmt.numero,
        fecha: new Date(pmt.fechaPago),
        debe: 0,
        haber: parseFloat(pmt.totalPago.toString()),
        estado: pmt.estado,
        detalles: pmt.allocations
          .map((a) => `Aplicado a ${a.invoice.numero}`)
          .join(', '),
      })),
      ...creditNotes.map((cn) => ({
        id: cn.id,
        tipo: 'NOTA_CREDITO' as const,
        numero: cn.numero,
        fecha: new Date(cn.fecha),
        debe: 0,
        haber: parseFloat(cn.total.toString()),
        estado: cn.estado,
        detalles: cn.motivo || undefined,
      })),
    ];

    // Sort by date
    transactions.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    // Calculate running balance
    let saldoAcumulado = 0;

    // If date range filter is applied, calculate initial balance
    if (fechaDesde) {
      const initialBalance = await calculateInitialBalance(
        clientId,
        companyId,
        new Date(fechaDesde),
        viewMode
      );
      saldoAcumulado = initialBalance;
    }

    const transactionsWithBalance = transactions.map((txn) => {
      saldoAcumulado += txn.debe - txn.haber;
      return {
        ...txn,
        saldo: saldoAcumulado,
      };
    });

    // Summary
    const totalFacturado = invoices.reduce(
      (sum, inv) => sum + parseFloat(inv.total.toString()),
      0
    );
    const totalCobrado = payments.reduce(
      (sum, pmt) => sum + parseFloat(pmt.totalPago.toString()),
      0
    );
    const totalNotasCredito = creditNotes.reduce(
      (sum, cn) => sum + parseFloat(cn.total.toString()),
      0
    );
    const saldoActual = parseFloat(client.currentBalance?.toString() || '0');

    // Fetch last snapshot for monthly variation
    let ultimoSnapshot = null;
    let variacionMensual = null;
    try {
      const lastSnapshot = await prisma.clientBalanceSnapshot.findFirst({
        where: { clientId, companyId },
        orderBy: { periodo: 'desc' },
      });
      if (lastSnapshot) {
        const snapshotBalance = parseFloat(lastSnapshot.balance.toString());
        ultimoSnapshot = {
          periodo: lastSnapshot.periodo,
          balance: snapshotBalance,
          totalDebe: parseFloat(lastSnapshot.totalDebe.toString()),
          totalHaber: parseFloat(lastSnapshot.totalHaber.toString()),
          movimientos: lastSnapshot.movimientos,
        };
        variacionMensual = {
          monto: saldoActual - snapshotBalance,
          porcentaje: snapshotBalance !== 0
            ? Math.round(((saldoActual - snapshotBalance) / Math.abs(snapshotBalance)) * 10000) / 100
            : null,
        };
      }
    } catch {
      // ClientBalanceSnapshot table might not exist yet
    }

    return NextResponse.json({
      client: {
        id: client.id,
        nombre: client.legalName || client.name || 'Sin nombre',
        cuit: client.cuit,
        saldoActual,
      },
      transactions: transactionsWithBalance,
      summary: {
        totalFacturado,
        totalCobrado,
        totalNotasCredito,
        saldoActual,
        cantidadFacturas: invoices.length,
        cantidadPagos: payments.length,
        cantidadNotasCredito: creditNotes.length,
      },
      ultimoSnapshot,
      variacionMensual,
      filters: {
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
      },
    });
  } catch (error) {
    console.error('[CURRENT-ACCOUNT] Error:', error);
    return NextResponse.json(
      {
        error: 'Error al obtener estado de cuenta',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate initial balance before a specific date
 */
async function calculateInitialBalance(
  clientId: string,
  companyId: number,
  beforeDate: Date,
  viewMode: string
): Promise<number> {
  const baseWhere = applyViewMode({ clientId, companyId }, viewMode);

  // Sum all invoices before date
  const invoicesSum = await prisma.salesInvoice.aggregate({
    where: {
      ...baseWhere,
      fechaEmision: { lt: beforeDate },
      estado: { notIn: ['ANULADA'] },
    },
    _sum: {
      total: true,
    },
  });

  // Sum all payments before date
  const paymentsSum = await prisma.clientPayment.aggregate({
    where: {
      ...baseWhere,
      fechaPago: { lt: beforeDate },
      estado: { notIn: ['ANULADO'] },
    },
    _sum: {
      totalPago: true,
    },
  });

  // Sum all credit notes before date
  let creditNotesSum = 0;
  try {
    const result = await prisma.creditNote.aggregate({
      where: {
        ...baseWhere,
        fecha: { lt: beforeDate },
        estado: { notIn: ['ANULADA'] },
      },
      _sum: {
        total: true,
      },
    });
    creditNotesSum = parseFloat(result._sum.total?.toString() || '0');
  } catch (e) {
    // CreditNote model might not exist
  }

  const totalInvoices = parseFloat(invoicesSum._sum.total?.toString() || '0');
  const totalPayments = parseFloat(paymentsSum._sum.totalPago?.toString() || '0');

  return totalInvoices - totalPayments - creditNotesSum;
}
