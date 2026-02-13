/**
 * Bank Reconciliation Suggestions API
 *
 * GET: Get ML-powered reconciliation suggestions for unmatched bank movements
 * POST: Confirm a reconciliation match (for learning)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import {
  generateReconciliationSuggestions,
  learnReconciliationPattern,
  getReconciliationStats,
  type BankMovement,
  type PaymentCandidate
} from '@/lib/tesoreria/bank-reconciliation-ml';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/view-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get('accountId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const viewMode = getViewMode(request);

    // Get unreconciled bank movements
    // Note: BankMovement does NOT have docType field, so viewMode is not applied here
    const whereClause: any = {
      companyId: user!.companyId,
      conciliado: false,
    };

    if (bankAccountId) {
      whereClause.bankAccountId = parseInt(bankAccountId);
    }

    const bankMovements = await prisma.bankMovement.findMany({
      where: whereClause,
      orderBy: { fecha: 'desc' },
      take: limit,
      include: {
        bankAccount: {
          select: { nombre: true, banco: true },
        },
      },
    });

    // Transform to expected format
    // BankMovement uses ingreso/egreso instead of a single monto field
    const movements: BankMovement[] = bankMovements.map(m => {
      const ingreso = Number(m.ingreso) || 0;
      const egreso = Number(m.egreso) || 0;
      const monto = ingreso > 0 ? ingreso : egreso;
      return {
        id: m.id,
        fecha: m.fecha,
        concepto: m.descripcion || '',
        referencia: m.referenciaExterna,
        monto,
        tipo: ingreso > 0 ? 'CREDITO' as const : 'DEBITO' as const,
        reconciled: m.conciliado,
      };
    });

    // Get client payments (for matching credits)
    const clientPayments = await prisma.clientPayment.findMany({
      where: applyViewMode({
        companyId: user!.companyId,
        estado: 'CONFIRMADO',
        fechaPago: {
          gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Last 60 days
        },
      }, viewMode),
      include: {
        client: {
          select: { id: true, legalName: true },
        },
      },
      orderBy: { fechaPago: 'desc' },
    });

    // Transform client payments
    const paymentCandidates: PaymentCandidate[] = clientPayments.map(p => ({
      id: p.id,
      numero: p.numero,
      fecha: p.fechaPago,
      monto: p.totalPago?.toNumber() || 0,
      clientName: p.client?.legalName || '',
      clientId: p.clientId || '',
      tipo: 'CLIENTE',
      referencia: p.numeroOperacion,
    }));

    // TODO: Add supplier payments (PaymentOrder) when needed
    // const supplierPayments = await prisma.paymentOrder.findMany(...)

    // Get learned patterns from previous reconciliations
    const learnedPatterns = await getLearnedPatterns(user!.companyId);

    // Generate suggestions
    const suggestions = generateReconciliationSuggestions(
      movements,
      paymentCandidates,
      learnedPatterns
    );

    // Get statistics
    const stats = getReconciliationStats(suggestions);

    return NextResponse.json({
      suggestions: suggestions.map(s => ({
        ...s,
        bankMovement: {
          ...s.bankMovement,
          bankAccount: bankMovements.find(m => m.id === s.bankMovement.id)?.bankAccount,
        },
        matches: s.matches.map(m => ({
          ...m,
          payment: paymentCandidates.find(p => p.id === m.paymentId),
        })),
      })),
      stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error generating reconciliation suggestions:', err);
    return NextResponse.json(
      { error: 'Error al generar sugerencias de conciliación' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_MATCH);
    if (error) return error;

    const body = await request.json();
    const { bankMovementId, paymentId, paymentType } = body;

    if (!bankMovementId || !paymentId) {
      return NextResponse.json(
        { error: 'bankMovementId y paymentId son requeridos' },
        { status: 400 }
      );
    }

    // Verify bank movement
    const bankMovement = await prisma.bankMovement.findFirst({
      where: {
        id: bankMovementId,
        companyId: user!.companyId,
      },
    });

    if (!bankMovement) {
      return NextResponse.json(
        { error: 'Movimiento bancario no encontrado' },
        { status: 404 }
      );
    }

    // Get payment details for learning
    let clientId: string | null = null;
    if (paymentType === 'CLIENTE') {
      const payment = await prisma.clientPayment.findFirst({
        where: {
          id: paymentId,
          companyId: user!.companyId,
        },
      });
      clientId = payment?.clientId || null;
    }

    // Update bank movement as reconciled
    await prisma.bankMovement.update({
      where: { id: bankMovementId },
      data: {
        conciliado: true,
        conciliadoAt: new Date(),
        conciliadoBy: user!.id,
        // Store reference to matched payment
        referenciaExterna: `${paymentType}:${paymentId}`,
      },
    });

    // Learn from this reconciliation
    if (clientId && bankMovement.descripcion) {
      await saveLearnedPattern(
        user!.companyId,
        bankMovement.descripcion,
        clientId
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Conciliación registrada exitosamente',
      bankMovementId,
      paymentId,
    });
  } catch (err) {
    console.error('Error confirming reconciliation:', err);
    return NextResponse.json(
      { error: 'Error al confirmar conciliación' },
      { status: 500 }
    );
  }
}

/**
 * Get learned patterns for a company from database
 */
async function getLearnedPatterns(companyId: number): Promise<Map<string, string>> {
  try {
    // Try to get from a settings table or JSON field
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { treasuryConfig: true },
    });

    if (company?.treasuryConfig) {
      const config = company.treasuryConfig as any;
      if (config.reconciliationPatterns) {
        return new Map(Object.entries(config.reconciliationPatterns));
      }
    }
  } catch (e) {
    // Ignore errors, return empty map
  }
  return new Map();
}

/**
 * Save a learned pattern to database
 */
async function saveLearnedPattern(
  companyId: number,
  bankConcept: string,
  clientId: string
): Promise<void> {
  try {
    const patterns = await getLearnedPatterns(companyId);
    const updatedPatterns = learnReconciliationPattern(bankConcept, clientId, patterns);

    // Convert Map to object for JSON storage
    const patternsObject = Object.fromEntries(updatedPatterns);

    await prisma.treasuryConfig.upsert({
      where: { companyId },
      update: {
        reconciliationPatterns: patternsObject,
      },
      create: {
        companyId,
        reconciliationPatterns: patternsObject,
      },
    });
  } catch (e) {
    console.error('Error saving reconciliation pattern:', e);
    // Non-critical, don't throw
  }
}
