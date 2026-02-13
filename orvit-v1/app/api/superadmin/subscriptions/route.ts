import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { logBillingAction } from '@/lib/billing/audit';

export const dynamic = 'force-dynamic';

// Generar ID para suscripciones
function generateSubscriptionId(): string {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// GET - Listar todas las suscripciones
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const planId = searchParams.get('planId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: any = {};
    if (status) where.status = status;
    if (planId) where.planId = planId;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              displayName: true,
              monthlyPrice: true,
              annualPrice: true,
              maxCompanies: true,
              maxUsersPerCompany: true,
              includedTokensMonthly: true,
            },
          },
          _count: {
            select: { companies: true, invoices: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.subscription.count({ where }),
    ]);

    // Formatear respuesta
    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub.id,
      userId: sub.userId,
      status: sub.status,
      billingCycle: sub.billingCycle,
      startDate: sub.startDate,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      nextBillingDate: sub.nextBillingDate,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt,
      trialEndsAt: sub.trialEndsAt,
      // Tokens
      tokens: {
        included: sub.includedTokensRemaining,
        purchased: sub.purchasedTokensBalance,
        usedThisPeriod: sub.tokensUsedThisPeriod,
        available: sub.includedTokensRemaining + sub.purchasedTokensBalance,
      },
      // Usuario
      user: sub.user,
      // Plan
      plan: {
        ...sub.plan,
        monthlyPrice: Number(sub.plan.monthlyPrice),
        annualPrice: sub.plan.annualPrice ? Number(sub.plan.annualPrice) : null,
      },
      // Conteos
      companiesCount: sub._count.companies,
      invoicesCount: sub._count.invoices,
      // Timestamps
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    }));

    return NextResponse.json({
      subscriptions: formattedSubscriptions,
      total,
      hasMore: offset + subscriptions.length < total,
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Error al obtener suscripciones' }, { status: 500 });
  }
}

// POST - Crear nueva suscripción para un usuario
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      userId,
      planId,
      billingCycle = 'MONTHLY',
      startTrial = false,
      trialDays = 14,
    } = body;

    // Validaciones
    if (!userId || !planId) {
      return NextResponse.json(
        { error: 'Usuario y plan son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Verificar que no tenga ya una suscripción activa
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'El usuario ya tiene una suscripción. Modifíquela en lugar de crear una nueva.' },
        { status: 400 }
      );
    }

    // Verificar que el plan existe y está activo
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    if (!plan.isActive) {
      return NextResponse.json({ error: 'El plan no está activo' }, { status: 400 });
    }

    // Calcular fechas
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'MONTHLY') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Si es trial, la siguiente fecha de cobro es después del trial
    let trialEndsAt: Date | null = null;
    let nextBillingDate = periodEnd;
    let status: 'TRIALING' | 'ACTIVE' = 'ACTIVE';

    if (startTrial) {
      trialEndsAt = new Date(now);
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
      nextBillingDate = trialEndsAt;
      status = 'TRIALING';
    }

    const subscriptionId = generateSubscriptionId();

    const subscription = await prisma.subscription.create({
      data: {
        id: subscriptionId,
        userId,
        planId,
        status,
        billingCycle,
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate,
        trialEndsAt,
        includedTokensRemaining: plan.includedTokensMonthly,
        purchasedTokensBalance: 0,
        tokensUsedThisPeriod: 0,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        plan: true,
      },
    });

    // Audit log
    await logBillingAction(
      auth.userId,
      'SUBSCRIPTION_CREATED',
      'subscription',
      subscriptionId,
      null,
      {
        userId,
        planId,
        status,
        billingCycle,
        startTrial,
      }
    );

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        plan: {
          ...subscription.plan,
          monthlyPrice: Number(subscription.plan.monthlyPrice),
          annualPrice: subscription.plan.annualPrice
            ? Number(subscription.plan.annualPrice)
            : null,
        },
      },
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Error al crear suscripción' }, { status: 500 });
  }
}
