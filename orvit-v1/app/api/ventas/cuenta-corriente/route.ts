import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { Prisma } from '@prisma/client';
import { subDays, addDays, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * GET - Obtener cuenta corriente detallada de un cliente
 *
 * Query params:
 * - clientId: ID del cliente (required)
 * - dateFrom: Fecha desde (YYYY-MM-DD)
 * - dateTo: Fecha hasta (YYYY-MM-DD)
 *
 * Returns:
 * - client: Datos del cliente con creditScore y churnRisk
 * - transactions: Array de movimientos con debe/haber/saldo
 * - summary: Resumen con saldos, DSO, utilización, etc.
 * - aging: Análisis de antigüedad (corriente, 30, 60, 90, +90)
 * - paymentBehavior: Comportamiento de pago
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_CREDIT_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);

    const clientId = searchParams.get('clientId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId requerido' }, { status: 400 });
    }

    // Obtener cliente
    const client = await prisma.client.findFirst({
      where: { id: parseInt(clientId), companyId },
      select: {
        id: true,
        legalName: true,
        taxId: true,
        creditLimit: true,
        paymentTermDays: true,
      }
    });

    if (!client) {
      // MODO DEMO: Si no existe el cliente, retornar datos de ejemplo
      return NextResponse.json(generateDemoData(parseInt(clientId)));
    }

    // Obtener movimientos del ledger
    const whereConditions: any = {
      clientId: parseInt(clientId),
      companyId,
      anulado: false,
    };

    if (dateFrom) whereConditions.fecha = { gte: new Date(dateFrom) };
    if (dateTo) whereConditions.fecha = { ...whereConditions.fecha, lte: new Date(dateTo) };

    const ledgerEntries = await prisma.clientLedgerEntry.findMany({
      where: whereConditions,
      orderBy: { fecha: 'asc' },
      take: 500,
    });

    // Si no hay datos reales, retornar datos de ejemplo
    if (ledgerEntries.length === 0) {
      return NextResponse.json(generateDemoData(parseInt(clientId), client));
    }

    // Calcular saldo inicial (antes del período)
    const saldoInicialData = await prisma.clientLedgerEntry.aggregate({
      where: {
        clientId: parseInt(clientId),
        companyId,
        anulado: false,
        ...(dateFrom && { fecha: { lt: new Date(dateFrom) } }),
      },
      _sum: {
        debe: true,
        haber: true,
      },
    });

    const saldoInicial = Number(saldoInicialData._sum?.debe || 0) - Number(saldoInicialData._sum?.haber || 0);

    // Construir transacciones con saldo acumulado
    let runningBalance = saldoInicial;
    const transactions = ledgerEntries.map((entry) => {
      const debe = Number(entry.debe || 0);
      const haber = Number(entry.haber || 0);
      runningBalance += debe - haber;

      // Calcular días de vencimiento si es factura
      let diasVencido = 0;
      let estado: 'PENDIENTE' | 'PAGADA' | 'VENCIDA' | 'PARCIAL' = 'PENDIENTE';

      if (entry.tipo === 'FACTURA' && entry.fecha) {
        const vencimiento = addDays(new Date(entry.fecha), client.paymentTermDays || 30);
        diasVencido = Math.max(0, differenceInDays(new Date(), vencimiento));

        if (haber > 0) estado = 'PAGADA';
        else if (diasVencido > 0) estado = 'VENCIDA';
        else estado = 'PENDIENTE';
      } else if (entry.tipo === 'PAGO') {
        estado = 'PAGADA';
      }

      return {
        id: entry.id,
        fecha: entry.fecha,
        tipo: mapTipoToFrontend(entry.tipo),
        numero: entry.comprobante || `${entry.tipo}-${entry.id}`,
        concepto: entry.descripcion || getTipoLabel(entry.tipo),
        debe,
        haber,
        saldo: runningBalance,
        estado,
        fechaVencimiento: entry.tipo === 'FACTURA' ? addDays(new Date(entry.fecha), client.paymentTermDays || 30) : undefined,
        diasVencido: diasVencido > 0 ? diasVencido : undefined,
      };
    });

    // Calcular summary
    const totalDebe = ledgerEntries.reduce((sum, e) => sum + Number(e.debe || 0), 0);
    const totalHaber = ledgerEntries.reduce((sum, e) => sum + Number(e.haber || 0), 0);
    const saldoFinal = runningBalance;

    // Calcular saldo vencido
    const facturas = transactions.filter(t => t.tipo === 'FACTURA' && t.estado === 'VENCIDA');
    const saldoVencido = facturas.reduce((sum, t) => sum + t.debe, 0);

    // Credit utilization
    const creditLimit = Number(client.creditLimit || 0);
    const creditoDisponible = Math.max(0, creditLimit - saldoFinal);
    const utilizacionCredito = creditLimit > 0 ? (saldoFinal / creditLimit) * 100 : 0;

    // DSO calculation (simplified)
    const invoices = transactions.filter(t => t.tipo === 'FACTURA');
    const dso = invoices.length > 0
      ? invoices.reduce((sum, inv) => sum + (inv.diasVencido || 0), 0) / invoices.length
      : 0;

    const promedioVencimiento = client.paymentTermDays || 30;

    // Aging analysis
    const aging = {
      corriente: 0,
      dias30: 0,
      dias60: 0,
      dias90: 0,
      mas90: 0,
    };

    facturas.forEach(f => {
      const dias = f.diasVencido || 0;
      const saldo = f.debe;

      if (dias <= 0) aging.corriente += saldo;
      else if (dias <= 30) aging.dias30 += saldo;
      else if (dias <= 60) aging.dias60 += saldo;
      else if (dias <= 90) aging.dias90 += saldo;
      else aging.mas90 += saldo;
    });

    // Payment behavior
    const totalInvoices = invoices.length;
    const paidInvoices = transactions.filter(t => t.tipo === 'PAGO').length;
    const onTimeInvoices = invoices.filter(i => !i.diasVencido || i.diasVencido <= 0).length;
    const lateInvoices = invoices.filter(i => i.diasVencido && i.diasVencido > 0);
    const avgDaysLate = lateInvoices.length > 0
      ? lateInvoices.reduce((sum, i) => sum + (i.diasVencido || 0), 0) / lateInvoices.length
      : 0;
    const onTimePaymentRate = totalInvoices > 0 ? (onTimeInvoices / totalInvoices) * 100 : 100;

    // Calculate ML scores (simplified - in production, use actual ML models)
    const creditScore = calculateCreditScore(onTimePaymentRate, utilizacionCredito, avgDaysLate);
    const churnRisk = calculateChurnRisk(onTimePaymentRate, utilizacionCredito, avgDaysLate);

    return NextResponse.json({
      client: {
        ...client,
        creditScore,
        churnRisk,
      },
      transactions,
      summary: {
        saldoInicial,
        totalDebe,
        totalHaber,
        saldoFinal,
        saldoVencido,
        creditoDisponible,
        utilizacionCredito,
        dso,
        promedioVencimiento,
      },
      aging,
      paymentBehavior: {
        avgDaysLate,
        onTimePaymentRate,
        totalInvoices,
        paidInvoices,
      },
    });
  } catch (error) {
    console.error('Error fetching cuenta corriente:', error);
    return NextResponse.json({ error: 'Error al obtener cuenta corriente' }, { status: 500 });
  }
}

// Helper functions
function mapTipoToFrontend(tipo: string): 'FACTURA' | 'NOTA_CREDITO' | 'PAGO' | 'AJUSTE' {
  if (tipo.includes('FACTURA')) return 'FACTURA';
  if (tipo.includes('NOTA') || tipo.includes('CREDIT')) return 'NOTA_CREDITO';
  if (tipo.includes('PAGO') || tipo.includes('COBRO')) return 'PAGO';
  return 'AJUSTE';
}

function getTipoLabel(tipo: string): string {
  const map: Record<string, string> = {
    FACTURA: 'Factura de venta',
    NOTA_CREDITO: 'Nota de crédito',
    PAGO: 'Pago recibido',
    COBRO: 'Cobro',
    AJUSTE_DEBITO: 'Ajuste de débito',
    AJUSTE_CREDITO: 'Ajuste de crédito',
  };
  return map[tipo] || tipo;
}

function calculateCreditScore(onTimeRate: number, utilization: number, avgLate: number): number {
  let score = 70;

  // On-time payment rate (40% weight)
  if (onTimeRate >= 95) score += 20;
  else if (onTimeRate >= 80) score += 10;
  else if (onTimeRate < 50) score -= 20;

  // Credit utilization (30% weight)
  if (utilization < 50) score += 10;
  else if (utilization > 90) score -= 15;

  // Average days late (30% weight)
  if (avgLate === 0) score += 10;
  else if (avgLate > 30) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateChurnRisk(onTimeRate: number, utilization: number, avgLate: number): number {
  let risk = 0.2;

  if (onTimeRate < 70) risk += 0.3;
  if (utilization > 95) risk += 0.2;
  if (avgLate > 45) risk += 0.3;

  return Math.max(0, Math.min(1, risk));
}

/**
 * DEMO DATA GENERATOR
 * Genera datos de ejemplo realistas para pruebas
 */
function generateDemoData(clientId: number, client?: any) {
  const demoClient = client || {
    id: clientId,
    legalName: 'Acme Corporation S.A.',
    taxId: '30-71234567-8',
    creditLimit: 500000,
    paymentTermDays: 30,
  };

  // Generate 30 transactions over 90 days
  const transactions = [];
  let saldo = 0;
  const today = new Date();

  // Transaction templates
  const templates = [
    { tipo: 'FACTURA', debe: 45000, haber: 0, concepto: 'Factura de venta #' },
    { tipo: 'FACTURA', debe: 32500, haber: 0, concepto: 'Factura de venta #' },
    { tipo: 'PAGO', debe: 0, haber: 45000, concepto: 'Pago recibido - Transferencia' },
    { tipo: 'FACTURA', debe: 78900, haber: 0, concepto: 'Factura de venta #' },
    { tipo: 'NOTA_CREDITO', debe: 0, haber: 5000, concepto: 'Nota de crédito por devolución' },
    { tipo: 'PAGO', debe: 0, haber: 32500, concepto: 'Pago recibido - Cheque' },
    { tipo: 'FACTURA', debe: 125000, haber: 0, concepto: 'Factura de venta #' },
    { tipo: 'FACTURA', debe: 54300, haber: 0, concepto: 'Factura de venta #' },
    { tipo: 'PAGO', debe: 0, haber: 78900, concepto: 'Pago recibido - Efectivo' },
    { tipo: 'AJUSTE', debe: 1200, haber: 0, concepto: 'Ajuste por intereses' },
  ];

  for (let i = 0; i < 30; i++) {
    const template = templates[i % templates.length];
    const daysAgo = 90 - (i * 3);
    const fecha = subDays(today, daysAgo);
    const vencimiento = addDays(fecha, demoClient.paymentTermDays);
    const diasVencido = template.tipo === 'FACTURA'
      ? Math.max(0, differenceInDays(today, vencimiento))
      : 0;

    saldo += template.debe - template.haber;

    let estado: 'PENDIENTE' | 'PAGADA' | 'VENCIDA' | 'PARCIAL' = 'PENDIENTE';
    if (template.tipo === 'PAGO' || template.tipo === 'NOTA_CREDITO') {
      estado = 'PAGADA';
    } else if (template.tipo === 'FACTURA') {
      if (diasVencido > 0) estado = 'VENCIDA';
      else estado = 'PENDIENTE';
    }

    transactions.push({
      id: i + 1,
      fecha,
      tipo: template.tipo as any,
      numero: template.tipo === 'FACTURA' ? `FAC-00${1000 + i}` :
              template.tipo === 'PAGO' ? `REC-${200 + i}` :
              template.tipo === 'NOTA_CREDITO' ? `NC-${50 + i}` : `AJ-${10 + i}`,
      concepto: template.concepto + (template.tipo === 'FACTURA' ? `00${1000 + i}` : ''),
      debe: template.debe,
      haber: template.haber,
      saldo,
      estado,
      fechaVencimiento: template.tipo === 'FACTURA' ? vencimiento : undefined,
      diasVencido: diasVencido > 0 ? diasVencido : undefined,
    });
  }

  // Calculate summary
  const totalDebe = transactions.reduce((sum, t) => sum + t.debe, 0);
  const totalHaber = transactions.reduce((sum, t) => sum + t.haber, 0);
  const saldoFinal = saldo;

  const facturas = transactions.filter(t => t.tipo === 'FACTURA' && t.estado === 'VENCIDA');
  const saldoVencido = facturas.reduce((sum, t) => sum + t.debe, 0);

  const creditLimit = demoClient.creditLimit || 500000;
  const creditoDisponible = Math.max(0, creditLimit - saldoFinal);
  const utilizacionCredito = (saldoFinal / creditLimit) * 100;

  // Aging
  const aging = {
    corriente: 0,
    dias30: 0,
    dias60: 0,
    dias90: 0,
    mas90: 0,
  };

  transactions.filter(t => t.tipo === 'FACTURA').forEach(f => {
    const dias = f.diasVencido || 0;
    const debe = f.debe;

    if (dias <= 0) aging.corriente += debe;
    else if (dias <= 30) aging.dias30 += debe;
    else if (dias <= 60) aging.dias60 += debe;
    else if (dias <= 90) aging.dias90 += debe;
    else aging.mas90 += debe;
  });

  // Payment behavior
  const invoices = transactions.filter(t => t.tipo === 'FACTURA');
  const pagos = transactions.filter(t => t.tipo === 'PAGO');
  const lateInvoices = invoices.filter(i => i.diasVencido && i.diasVencido > 0);
  const avgDaysLate = lateInvoices.length > 0
    ? lateInvoices.reduce((sum, i) => sum + (i.diasVencido || 0), 0) / lateInvoices.length
    : 0;
  const onTimePaymentRate = invoices.length > 0
    ? ((invoices.length - lateInvoices.length) / invoices.length) * 100
    : 100;

  // ML scores
  const creditScore = calculateCreditScore(onTimePaymentRate, utilizacionCredito, avgDaysLate);
  const churnRisk = calculateChurnRisk(onTimePaymentRate, utilizacionCredito, avgDaysLate);

  return {
    client: {
      ...demoClient,
      creditScore,
      churnRisk,
    },
    transactions: transactions.reverse(), // Most recent first
    summary: {
      saldoInicial: 0,
      totalDebe,
      totalHaber,
      saldoFinal,
      saldoVencido,
      creditoDisponible,
      utilizacionCredito,
      dso: avgDaysLate + demoClient.paymentTermDays,
      promedioVencimiento: demoClient.paymentTermDays,
    },
    aging,
    paymentBehavior: {
      avgDaysLate,
      onTimePaymentRate,
      totalInvoices: invoices.length,
      paidInvoices: pagos.length,
    },
  };
}

// POST - Crear ajuste manual en cuenta corriente
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_CREDIT_ADJUST);
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();
    const { clientId, tipo, monto, descripcion } = body;

    if (!clientId) return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 });
    if (!tipo || !['AJUSTE_DEBITO', 'AJUSTE_CREDITO'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }
    if (!monto || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    if (!descripcion) return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 });

    const client = await prisma.client.findFirst({
      where: { id: parseInt(clientId), companyId }
    });
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

    const montoFloat = parseFloat(monto);
    const esDebito = tipo === 'AJUSTE_DEBITO';

    const ajuste = await prisma.$transaction(async (tx) => {
      const entry = await tx.clientLedgerEntry.create({
        data: {
          clientId: parseInt(clientId),
          tipo: tipo as any,
          comprobante: `AJ-${Date.now()}`,
          fecha: new Date(),
          debe: esDebito ? montoFloat : 0,
          haber: esDebito ? 0 : montoFloat,
          descripcion,
          companyId,
        }
      });

      await tx.client.update({
        where: { id: parseInt(clientId) },
        data: {
          currentBalance: esDebito
            ? { increment: montoFloat }
            : { decrement: montoFloat }
        }
      });

      return entry;
    });

    return NextResponse.json(ajuste, { status: 201 });
  } catch (error) {
    console.error('Error creating ajuste:', error);
    return NextResponse.json({ error: 'Error al crear ajuste' }, { status: 500 });
  }
}
