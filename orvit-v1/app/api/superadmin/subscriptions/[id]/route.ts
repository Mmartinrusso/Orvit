import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { logBillingAction } from '@/lib/billing/audit';
import { getTokenHistory } from '@/lib/billing/tokens';

export const dynamic = 'force-dynamic';

// GET - Obtener detalle de una suscripción
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        plan: true,
        companies: {
          select: {
            id: true,
            name: true,
            cuit: true,
            createdAt: true,
            _count: {
              select: { users: true },
            },
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            dueDate: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    // Obtener historial de tokens reciente
    const tokenHistory = await getTokenHistory(params.id, { limit: 20 });

    return NextResponse.json({
      subscription: {
        ...subscription,
        plan: {
          ...subscription.plan,
          monthlyPrice: Number(subscription.plan.monthlyPrice),
          annualPrice: subscription.plan.annualPrice
            ? Number(subscription.plan.annualPrice)
            : null,
        },
        invoices: subscription.invoices.map(inv => ({
          ...inv,
          total: Number(inv.total),
        })),
        companies: subscription.companies.map(c => ({
          ...c,
          usersCount: c._count.users,
        })),
        tokens: {
          included: subscription.includedTokensRemaining,
          purchased: subscription.purchasedTokensBalance,
          usedThisPeriod: subscription.tokensUsedThisPeriod,
          available: subscription.includedTokensRemaining + subscription.purchasedTokensBalance,
          history: tokenHistory.transactions,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json({ error: 'Error al obtener suscripción' }, { status: 500 });
  }
}

// PUT - Actualizar suscripción (cambiar plan, ciclo, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { planId, billingCycle, status } = body;

    const updateData: any = {};
    const oldValue: any = {};
    const newValue: any = {};

    // Cambio de plan
    if (planId && planId !== subscription.planId) {
      const newPlan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });

      if (!newPlan) {
        return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
      }

      if (!newPlan.isActive) {
        return NextResponse.json({ error: 'El plan no está activo' }, { status: 400 });
      }

      updateData.planId = planId;
      oldValue.planId = subscription.planId;
      newValue.planId = planId;

      // Si el nuevo plan tiene más tokens, ajustar el allowance
      if (newPlan.includedTokensMonthly > subscription.plan.includedTokensMonthly) {
        const difference = newPlan.includedTokensMonthly - subscription.plan.includedTokensMonthly;
        updateData.includedTokensRemaining = subscription.includedTokensRemaining + difference;
      }
    }

    // Cambio de ciclo
    if (billingCycle && billingCycle !== subscription.billingCycle) {
      updateData.billingCycle = billingCycle;
      oldValue.billingCycle = subscription.billingCycle;
      newValue.billingCycle = billingCycle;

      // Recalcular fecha de fin de período
      const newPeriodEnd = new Date(subscription.currentPeriodStart);
      if (billingCycle === 'MONTHLY') {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      } else {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      }
      updateData.currentPeriodEnd = newPeriodEnd;
      updateData.nextBillingDate = newPeriodEnd;
    }

    // Cambio de estado manual (solo ciertos estados)
    if (status && status !== subscription.status) {
      const allowedTransitions: Record<string, string[]> = {
        TRIALING: ['ACTIVE', 'CANCELED'],
        ACTIVE: ['PAUSED', 'CANCELED'],
        PAST_DUE: ['ACTIVE', 'CANCELED', 'PAUSED'],
        PAUSED: ['ACTIVE', 'CANCELED'],
        CANCELED: [], // No se puede reactivar una suscripción cancelada
      };

      if (!allowedTransitions[subscription.status]?.includes(status)) {
        return NextResponse.json(
          { error: `No se puede cambiar de ${subscription.status} a ${status}` },
          { status: 400 }
        );
      }

      updateData.status = status;
      oldValue.status = subscription.status;
      newValue.status = status;

      if (status === 'CANCELED') {
        updateData.canceledAt = new Date();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No hay cambios para aplicar' }, { status: 400 });
    }

    const updated = await prisma.subscription.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: true,
      },
    });

    // Audit log
    const action = planId && planId !== subscription.planId
      ? 'PLAN_CHANGE'
      : billingCycle && billingCycle !== subscription.billingCycle
        ? 'BILLING_CYCLE_CHANGE'
        : status === 'CANCELED'
          ? 'SUBSCRIPTION_CANCELED'
          : status === 'PAUSED'
            ? 'SUBSCRIPTION_PAUSED'
            : status === 'ACTIVE'
              ? 'SUBSCRIPTION_REACTIVATED'
              : 'PLAN_CHANGE';

    await logBillingAction(
      auth.userId,
      action,
      'subscription',
      params.id,
      oldValue,
      newValue
    );

    return NextResponse.json({
      success: true,
      subscription: {
        ...updated,
        plan: {
          ...updated.plan,
          monthlyPrice: Number(updated.plan.monthlyPrice),
          annualPrice: updated.plan.annualPrice ? Number(updated.plan.annualPrice) : null,
        },
      },
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Error al actualizar suscripción' }, { status: 500 });
  }
}

// DELETE - Cancelar suscripción (no elimina, solo cancela)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    if (subscription.status === 'CANCELED') {
      return NextResponse.json({ error: 'La suscripción ya está cancelada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const immediate = searchParams.get('immediate') === 'true';

    let updateData: any = {};

    if (immediate) {
      // Cancelación inmediata
      updateData = {
        status: 'CANCELED',
        canceledAt: new Date(),
        cancelAtPeriodEnd: false,
      };
    } else {
      // Cancelar al final del período
      updateData = {
        cancelAtPeriodEnd: true,
      };
    }

    const updated = await prisma.subscription.update({
      where: { id: params.id },
      data: updateData,
    });

    // Audit log
    await logBillingAction(
      auth.userId,
      'SUBSCRIPTION_CANCELED',
      'subscription',
      params.id,
      { status: subscription.status, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd },
      { status: updated.status, cancelAtPeriodEnd: updated.cancelAtPeriodEnd, immediate }
    );

    return NextResponse.json({
      success: true,
      message: immediate
        ? 'Suscripción cancelada inmediatamente'
        : 'Suscripción se cancelará al final del período actual',
      subscription: updated,
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json({ error: 'Error al cancelar suscripción' }, { status: 500 });
  }
}
