/**
 * API para el portal del cliente - Mi Suscripción
 * Accesible por cualquier usuario autenticado (para ver su propia suscripción)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { getTokenBalance, getTokenHistory } from '@/lib/billing/tokens';
import { getActiveRedemption, validateCoupon } from '@/lib/billing/coupons';

export const dynamic = 'force-dynamic';

// GET - Obtener mi suscripción y datos de billing
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include')?.split(',') || [];

    // Obtener suscripción del usuario
    const subscription = await prisma.subscription.findUnique({
      where: { userId: auth.userId },
      include: {
        plan: true,
        autoPaymentConfig: true,
        companies: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json({
        hasSubscription: false,
        message: 'No tienes una suscripción activa',
      });
    }

    // Datos básicos
    const response: any = {
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingDate: subscription.nextBillingDate,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
        plan: {
          id: subscription.plan.id,
          name: subscription.plan.displayName,
          monthlyPrice: Number(subscription.plan.monthlyPrice),
          annualPrice: subscription.plan.annualPrice ? Number(subscription.plan.annualPrice) : null,
          features: subscription.plan.features,
          maxCompanies: subscription.plan.maxCompanies,
          maxUsersPerCompany: subscription.plan.maxUsersPerCompany,
          includedTokensMonthly: subscription.plan.includedTokensMonthly,
        },
        companies: subscription.companies,
        companiesCount: subscription.companies.length,
      },
    };

    // Tokens
    const tokenBalance = await getTokenBalance(subscription.id);
    response.tokens = tokenBalance;

    // Auto-payment config
    if (subscription.autoPaymentConfig) {
      response.autoPayment = {
        isEnabled: subscription.autoPaymentConfig.isEnabled,
        provider: subscription.autoPaymentConfig.provider,
        cardLast4: subscription.autoPaymentConfig.cardLast4,
        cardBrand: subscription.autoPaymentConfig.cardBrand,
        cardExpMonth: subscription.autoPaymentConfig.cardExpMonth,
        cardExpYear: subscription.autoPaymentConfig.cardExpYear,
        lastPaymentAt: subscription.autoPaymentConfig.lastPaymentAt,
        failedAttempts: subscription.autoPaymentConfig.failedAttempts,
      };
    }

    // Cupón activo
    const activeRedemption = await getActiveRedemption(subscription.id);
    if (activeRedemption) {
      response.activeCoupon = activeRedemption;
    }

    // Incluir facturas recientes si se solicita
    if (include.includes('invoices')) {
      const invoices = await prisma.billingInvoice.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          currency: true,
          dueDate: true,
          paidAt: true,
          createdAt: true,
        },
      });

      response.recentInvoices = invoices.map(inv => ({
        ...inv,
        total: Number(inv.total),
      }));
    }

    // Incluir historial de tokens si se solicita
    if (include.includes('tokenHistory')) {
      const history = await getTokenHistory(subscription.id, { limit: 20 });
      response.tokenHistory = history;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json({ error: 'Error al obtener suscripción' }, { status: 500 });
  }
}

// POST - Acciones sobre mi suscripción
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const subscription = await prisma.subscription.findUnique({
      where: { userId: auth.userId },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No tienes una suscripción' }, { status: 404 });
    }

    switch (action) {
      // Validar un cupón
      case 'validate_coupon': {
        const { code, amount } = body;
        if (!code) {
          return NextResponse.json({ error: 'code es requerido' }, { status: 400 });
        }

        const invoiceAmount = amount || Number(
          subscription.billingCycle === 'MONTHLY'
            ? (await prisma.subscriptionPlan.findUnique({ where: { id: subscription.planId } }))?.monthlyPrice || 0
            : (await prisma.subscriptionPlan.findUnique({ where: { id: subscription.planId } }))?.annualPrice || 0
        );

        const result = await validateCoupon(code, subscription.id, invoiceAmount);
        return NextResponse.json(result);
      }

      // Cancelar al final del período
      case 'cancel': {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            cancelAtPeriodEnd: true,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Tu suscripción se cancelará al final del período actual',
          cancelAt: subscription.currentPeriodEnd,
        });
      }

      // Reactivar suscripción
      case 'reactivate': {
        if (!subscription.cancelAtPeriodEnd) {
          return NextResponse.json({ error: 'La suscripción no está marcada para cancelar' }, { status: 400 });
        }

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            cancelAtPeriodEnd: false,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Tu suscripción ha sido reactivada',
        });
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing action:', error);
    return NextResponse.json({ error: 'Error al procesar acción' }, { status: 500 });
  }
}
