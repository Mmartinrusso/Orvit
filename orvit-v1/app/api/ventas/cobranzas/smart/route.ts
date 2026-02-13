/**
 * Smart Collections API
 *
 * GET: Get prioritized collection recommendations
 * POST: Execute collection action and log result
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import {
  getSmartCollectionPriorities,
  getDunningStatus,
  getCollectionRecommendations,
  type CollectionPriority
} from '@/lib/ventas/smart-collections';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/view-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const riskFilter = searchParams.get('risk') as 'low' | 'medium' | 'high' | 'critical' | null;
    const includeRecommendations = searchParams.get('recommendations') === 'true';
    const viewMode = getViewMode(request);

    // Get overdue invoices
    const overdueInvoices = await prisma.salesInvoice.findMany({
      where: applyViewMode({
        companyId: user!.companyId,
        estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] },
        fechaVencimiento: { lt: new Date() },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      include: {
        client: true,
        paymentAllocations: {
          include: {
            payment: true,
          },
          orderBy: { fechaAplicacion: 'desc' },
          take: 5,
        },
        collectionAttempts: {
          orderBy: { attemptDate: 'desc' },
        },
      },
      orderBy: { fechaVencimiento: 'asc' },
    });

    // Get client payment history for scoring
    const clientIds = [...new Set(overdueInvoices.map(inv => inv.clientId).filter(Boolean))];

    const clientPaymentHistory = await prisma.clientPayment.groupBy({
      by: ['clientId'],
      where: {
        companyId: user!.companyId,
        clientId: { in: clientIds as string[] },
      },
      _count: { id: true },
      _sum: { totalPago: true },
      _avg: { totalPago: true },
    });

    const clientHistoryMap = new Map(
      clientPaymentHistory.map(h => [h.clientId, {
        totalPayments: h._count.id,
        totalAmount: h._sum.totalPago?.toNumber() || 0,
        avgAmount: h._avg.totalPago?.toNumber() || 0,
      }])
    );

    // Calculate priorities
    const priorities: (CollectionPriority & {
      dunningStatus: ReturnType<typeof getDunningStatus>;
      invoice: any;
      client: any;
      recommendations?: any;
    })[] = overdueInvoices.map(invoice => {
      const client = invoice.client;
      const clientHistory = client ? clientHistoryMap.get(client.id) : null;
      const attempts = invoice.collectionAttempts || [];

      const daysOverdue = Math.floor(
        (new Date().getTime() - new Date(invoice.fechaVencimiento!).getTime()) / (1000 * 60 * 60 * 24)
      );

      const amount = invoice.saldoPendiente?.toNumber() || 0;

      // Calculate client risk score (0-100)
      let clientRiskScore = 50; // Default medium risk
      if (clientHistory) {
        // Good payment history reduces risk
        if (clientHistory.totalPayments > 10) clientRiskScore -= 20;
        else if (clientHistory.totalPayments > 5) clientRiskScore -= 10;

        // High average payment amount is good
        if (clientHistory.avgAmount > 10000) clientRiskScore -= 10;
      }

      // Previous failed attempts increase risk
      const failedAttempts = attempts.filter(a => a.result === 'NO_RESPUESTA' || a.result === 'RECHAZADO').length;
      clientRiskScore += failedAttempts * 5;

      clientRiskScore = Math.max(0, Math.min(100, clientRiskScore));

      // Calculate priority score
      const priority = getSmartCollectionPriorities([{
        invoiceId: invoice.id,
        invoiceNumber: invoice.numeroCompleto,
        clientId: client?.id || '',
        clientName: client?.legalName || 'Unknown',
        amount,
        daysOverdue,
        clientRiskScore,
        previousAttempts: attempts.length,
        lastAttemptDate: attempts[0]?.attemptDate || null,
        lastAttemptResult: attempts[0]?.result || null,
      }])[0];

      // Get dunning status
      const dunningStatus = getDunningStatus(daysOverdue, attempts.length);

      return {
        ...priority,
        dunningStatus,
        invoice: {
          id: invoice.id,
          numero: invoice.numeroCompleto,
          fechaEmision: invoice.fechaEmision,
          fechaVencimiento: invoice.fechaVencimiento,
          total: invoice.total?.toNumber() || 0,
          saldoPendiente: amount,
        },
        client: client ? {
          id: client.id,
          legalName: client.legalName,
          email: client.email,
          phone: client.phone,
        } : null,
        recommendations: includeRecommendations
          ? getCollectionRecommendations(daysOverdue, attempts.length, clientRiskScore)
          : undefined,
      };
    });

    // Filter by risk if specified
    let filteredPriorities = priorities;
    if (riskFilter) {
      filteredPriorities = priorities.filter(p => p.riskCategory === riskFilter);
    }

    // Sort by priority score (highest first) and limit
    const sortedPriorities = filteredPriorities
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, limit);

    // Calculate summary stats
    const stats = {
      totalOverdue: priorities.length,
      totalAmount: priorities.reduce((sum, p) => sum + p.amount, 0),
      byRisk: {
        critical: priorities.filter(p => p.riskCategory === 'critical').length,
        high: priorities.filter(p => p.riskCategory === 'high').length,
        medium: priorities.filter(p => p.riskCategory === 'medium').length,
        low: priorities.filter(p => p.riskCategory === 'low').length,
      },
      avgDaysOverdue: priorities.length > 0
        ? Math.round(priorities.reduce((sum, p) => sum + p.daysOverdue, 0) / priorities.length)
        : 0,
      expectedRecovery: priorities.reduce((sum, p) => sum + (p.amount * p.expectedRecoveryRate), 0),
    };

    return NextResponse.json({
      priorities: sortedPriorities,
      stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error getting smart collections:', err);
    return NextResponse.json(
      { error: 'Error al obtener prioridades de cobranza' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_EDIT);
    if (error) return error;

    const body = await request.json();
    const { invoiceId, attemptType, result, notes, nextFollowUpDate, contactMethod } = body;

    if (!invoiceId || !attemptType || !result) {
      return NextResponse.json(
        { error: 'invoiceId, attemptType y result son requeridos' },
        { status: 400 }
      );
    }

    // Verify invoice belongs to company
    const invoice = await prisma.salesInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId: user!.companyId,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      );
    }

    // Log collection attempt
    const attempt = await prisma.collectionAttempt.create({
      data: {
        invoiceId,
        companyId: user!.companyId,
        userId: user!.id,
        attemptType, // 'EMAIL', 'PHONE', 'VISIT', 'LETTER', 'WHATSAPP', 'SMS'
        result, // 'CONTACTADO', 'NO_RESPUESTA', 'COMPROMISO_PAGO', 'RECHAZADO', 'PAGO_PARCIAL', 'PAGO_TOTAL'
        notes,
        contactMethod,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
        attemptDate: new Date(),
      },
    });

    // If promise to pay, update invoice notes
    if (result === 'COMPROMISO_PAGO' && nextFollowUpDate) {
      await prisma.salesInvoice.update({
        where: { id: invoiceId },
        data: {
          notas: `${invoice.notas || ''}\n[${new Date().toLocaleDateString()}] Compromiso de pago para ${new Date(nextFollowUpDate).toLocaleDateString()}`,
        },
      });
    }

    return NextResponse.json(attempt, { status: 201 });
  } catch (err) {
    console.error('Error logging collection attempt:', err);
    return NextResponse.json(
      { error: 'Error al registrar intento de cobranza' },
      { status: 500 }
    );
  }
}
