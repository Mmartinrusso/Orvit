/**
 * Cron Job de Billing
 * Ejecutar diariamente para:
 * - Generar facturas de renovación
 * - Resetear tokens mensuales
 * - Marcar facturas vencidas
 * - Suspender suscripciones morosas
 *
 * Configurar en Vercel/servidor: GET /api/cron/billing
 * Con header: Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateRenewalInvoice } from '@/lib/billing/invoicing';
import { resetMonthlyAllowance } from '@/lib/billing/tokens';
import { logBillingAction } from '@/lib/billing/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos máximo

// Verificar autorización del cron
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET no configurado');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Verificar autorización
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const results = {
    renewals: { processed: 0, errors: 0 },
    tokenResets: { processed: 0, errors: 0 },
    overdueInvoices: { processed: 0 },
    suspendedSubscriptions: { processed: 0 },
    startedAt: new Date().toISOString(),
    completedAt: '',
  };

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ================================================
    // 1. GENERAR FACTURAS DE RENOVACIÓN
    // Suscripciones cuyo período termina hoy o mañana
    // ================================================
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const subscriptionsToRenew = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        plan: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    for (const subscription of subscriptionsToRenew) {
      try {
        // Verificar que no exista ya una factura para este período
        const existingInvoice = await prisma.billingInvoice.findFirst({
          where: {
            subscriptionId: subscription.id,
            periodStart: subscription.currentPeriodEnd,
          },
        });

        if (!existingInvoice) {
          const invoice = await generateRenewalInvoice(subscription.id);
          console.log(`Factura ${invoice.number} generada para ${subscription.user.email}`);
          results.renewals.processed++;
        }
      } catch (error) {
        console.error(`Error generando factura para suscripción ${subscription.id}:`, error);
        results.renewals.errors++;
      }
    }

    // ================================================
    // 2. RESETEAR TOKENS MENSUALES
    // Suscripciones cuyo período empezó hoy
    // ================================================
    const subscriptionsToResetTokens = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING'] },
        currentPeriodStart: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    for (const subscription of subscriptionsToResetTokens) {
      try {
        await resetMonthlyAllowance(subscription.id);
        console.log(`Tokens reseteados para suscripción ${subscription.id}`);
        results.tokenResets.processed++;
      } catch (error) {
        console.error(`Error reseteando tokens para ${subscription.id}:`, error);
        results.tokenResets.errors++;
      }
    }

    // ================================================
    // 3. MARCAR FACTURAS VENCIDAS COMO UNCOLLECTIBLE
    // Facturas OPEN con más de 30 días de vencimiento
    // ================================================
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const overdueInvoices = await prisma.billingInvoice.updateMany({
      where: {
        status: 'OPEN',
        dueDate: {
          lt: thirtyDaysAgo,
        },
      },
      data: {
        status: 'UNCOLLECTIBLE',
      },
    });

    results.overdueInvoices.processed = overdueInvoices.count;

    // ================================================
    // 4. SUSPENDER SUSCRIPCIONES CON FACTURAS IMPAGAS
    // Si tienen facturas OPEN vencidas por más de 15 días
    // ================================================
    const fifteenDaysAgo = new Date(today);
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    // Encontrar suscripciones con facturas vencidas
    const subscriptionsWithOverdue = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        invoices: {
          some: {
            status: 'OPEN',
            dueDate: {
              lt: fifteenDaysAgo,
            },
          },
        },
      },
    });

    for (const subscription of subscriptionsWithOverdue) {
      try {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'PAST_DUE' },
        });

        await logBillingAction(
          0, // Sistema
          'SUBSCRIPTION_STATUS_CHANGE',
          'subscription',
          subscription.id,
          { status: 'ACTIVE' },
          { status: 'PAST_DUE', reason: 'Facturas vencidas' }
        );

        console.log(`Suscripción ${subscription.id} marcada como PAST_DUE`);
        results.suspendedSubscriptions.processed++;
      } catch (error) {
        console.error(`Error suspendiendo suscripción ${subscription.id}:`, error);
      }
    }

    results.completedAt = new Date().toISOString();

    // Log del resultado
    console.log('Cron de billing completado:', results);

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error) {
    console.error('Error en cron de billing:', error);
    return NextResponse.json(
      { error: 'Error ejecutando cron de billing' },
      { status: 500 }
    );
  }
}
