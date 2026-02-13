/**
 * Payment Anomaly Detection API
 *
 * GET: Detect payment anomalies using ML patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import {
  detectPaymentAnomalies,
  buildClientPaymentProfile,
  type PaymentAnomaly
} from '@/lib/ventas/payment-anomaly-detector';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/view-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const minSeverity = searchParams.get('minSeverity') as 'low' | 'medium' | 'high' | null;
    const clientId = searchParams.get('clientId');
    const viewMode = getViewMode(request);

    // Get recent payments
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause: any = applyViewMode({
      companyId: user!.companyId,
      fechaPago: { gte: startDate },
    }, viewMode);

    if (clientId) {
      whereClause.clientId = clientId;
    }

    const recentPayments = await prisma.clientPayment.findMany({
      where: whereClause,
      include: {
        client: true,
        allocations: {
          include: {
            invoice: true,
          },
        },
      },
      orderBy: { fechaPago: 'desc' },
    });

    // Get historical payments for comparison (last 6 months)
    const historicalStart = new Date();
    historicalStart.setMonth(historicalStart.getMonth() - 6);

    const historicalPayments = await prisma.clientPayment.findMany({
      where: applyViewMode({
        companyId: user!.companyId,
        fechaPago: { gte: historicalStart, lt: startDate },
      }, viewMode),
      orderBy: { fechaPago: 'desc' },
    });

    // Build client payment profiles
    const clientIds = [...new Set(recentPayments.map(p => p.clientId).filter(Boolean))];
    const clientProfiles = new Map<string, ReturnType<typeof buildClientPaymentProfile>>();

    for (const cId of clientIds) {
      if (!cId) continue;
      const clientHistorical = historicalPayments.filter(p => p.clientId === cId);
      if (clientHistorical.length >= 3) {
        const profile = buildClientPaymentProfile(
          clientHistorical.map(p => ({
            id: p.id,
            monto: p.totalPago?.toNumber() || 0,
            fecha: p.fechaPago,
            metodoPago: getPrimaryPaymentMethod(p),
            clientId: p.clientId,
          }))
        );
        clientProfiles.set(cId, profile);
      }
    }

    // Detect anomalies
    const paymentsForAnalysis = recentPayments.map(p => ({
      id: p.id,
      monto: p.totalPago?.toNumber() || 0,
      fecha: p.fechaPago,
      metodoPago: getPrimaryPaymentMethod(p),
      clientId: p.clientId,
      invoiceId: p.allocations[0]?.invoiceId,
      referencia: p.numero,
    }));

    const allPaymentsForStats = [...historicalPayments, ...recentPayments].map(p => ({
      id: p.id,
      monto: p.totalPago?.toNumber() || 0,
      fecha: p.fechaPago,
      metodoPago: getPrimaryPaymentMethod(p),
      clientId: p.clientId,
    }));

    const anomalies = detectPaymentAnomalies(paymentsForAnalysis, allPaymentsForStats, clientProfiles);

    // Filter by severity if specified
    let filteredAnomalies = anomalies;
    if (minSeverity) {
      const severityOrder = { low: 1, medium: 2, high: 3 };
      const minLevel = severityOrder[minSeverity];
      filteredAnomalies = anomalies.filter(a => severityOrder[a.severity] >= minLevel);
    }

    // Enrich with payment and client details
    const enrichedAnomalies = filteredAnomalies.map(anomaly => {
      const payment = recentPayments.find(p => p.id === anomaly.paymentId);
      return {
        ...anomaly,
        payment: payment ? {
          id: payment.id,
          monto: payment.totalPago?.toNumber(),
          fecha: payment.fechaPago,
          metodoPago: getPrimaryPaymentMethod(payment),
          referencia: payment.numero,
        } : null,
        client: payment?.client ? {
          id: payment.client.id,
          legalName: payment.client.legalName,
        } : null,
        invoice: payment?.allocations?.[0]?.invoice ? {
          id: payment.allocations[0].invoice.id,
          numero: payment.allocations[0].invoice.numeroCompleto,
        } : null,
      };
    });

    // Calculate summary stats
    const stats = {
      totalPaymentsAnalyzed: recentPayments.length,
      totalAnomalies: anomalies.length,
      bySeverity: {
        high: anomalies.filter(a => a.severity === 'high').length,
        medium: anomalies.filter(a => a.severity === 'medium').length,
        low: anomalies.filter(a => a.severity === 'low').length,
      },
      byType: anomalies.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      anomalyRate: recentPayments.length > 0
        ? ((anomalies.length / recentPayments.length) * 100).toFixed(2)
        : '0.00',
    };

    return NextResponse.json({
      anomalies: enrichedAnomalies,
      stats,
      period: {
        from: startDate.toISOString(),
        to: new Date().toISOString(),
        days,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error detecting payment anomalies:', err);
    return NextResponse.json(
      { error: 'Error al detectar anomalías de pago' },
      { status: 500 }
    );
  }
}

// Helper function to determine primary payment method
function getPrimaryPaymentMethod(payment: any): string {
  const methods = [
    { name: 'EFECTIVO', amount: payment.efectivo?.toNumber() || 0 },
    { name: 'TRANSFERENCIA', amount: payment.transferencia?.toNumber() || 0 },
    { name: 'CHEQUE', amount: (payment.chequesTerceros?.toNumber() || 0) + (payment.chequesPropios?.toNumber() || 0) },
    { name: 'TARJETA_CREDITO', amount: payment.tarjetaCredito?.toNumber() || 0 },
    { name: 'TARJETA_DEBITO', amount: payment.tarjetaDebito?.toNumber() || 0 },
    { name: 'OTROS', amount: payment.otrosMedios?.toNumber() || 0 },
  ];

  const primary = methods.reduce((max, m) => m.amount > max.amount ? m : max, methods[0]);
  return primary.name;
}
