import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { BillingCycle } from '@prisma/client';
import { calculateProration, formatProrationForDisplay } from '@/lib/billing/proration';
import { createInvoice, InvoiceItemInput } from '@/lib/billing/invoicing';
import { logBillingAction } from '@/lib/billing/audit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/superadmin/subscriptions/[id]/change-plan
 * Cambia el plan de una suscripción con cálculo de prorrateo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      newPlanId,
      newBillingCycle,
      applyImmediately = true,
      generateInvoice = true,
      preview = false, // Si es true, solo devuelve el cálculo sin aplicar
    } = body;

    if (!newPlanId) {
      return NextResponse.json({ error: 'newPlanId es requerido' }, { status: 400 });
    }

    // Obtener suscripción actual
    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
      include: {
        plan: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    if (subscription.status === 'CANCELED') {
      return NextResponse.json(
        { error: 'No se puede cambiar el plan de una suscripción cancelada' },
        { status: 400 }
      );
    }

    // Obtener nuevo plan
    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: newPlanId },
    });

    if (!newPlan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    if (!newPlan.isActive) {
      return NextResponse.json({ error: 'El plan no está activo' }, { status: 400 });
    }

    // Determinar el nuevo ciclo
    const effectiveNewCycle: BillingCycle = newBillingCycle || subscription.billingCycle;

    // Calcular prorrateo
    const proration = calculateProration(
      {
        monthlyPrice: Number(subscription.plan.monthlyPrice),
        annualPrice: subscription.plan.annualPrice ? Number(subscription.plan.annualPrice) : null,
      },
      {
        monthlyPrice: Number(newPlan.monthlyPrice),
        annualPrice: newPlan.annualPrice ? Number(newPlan.annualPrice) : null,
      },
      subscription.billingCycle,
      effectiveNewCycle,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      new Date()
    );

    const prorationDisplay = formatProrationForDisplay(proration, subscription.plan.currency);

    // Si es solo preview, devolver el cálculo
    if (preview) {
      return NextResponse.json({
        preview: true,
        currentPlan: {
          id: subscription.plan.id,
          name: subscription.plan.displayName,
          monthlyPrice: Number(subscription.plan.monthlyPrice),
          billingCycle: subscription.billingCycle,
        },
        newPlan: {
          id: newPlan.id,
          name: newPlan.displayName,
          monthlyPrice: Number(newPlan.monthlyPrice),
          billingCycle: effectiveNewCycle,
        },
        proration: {
          ...proration,
          display: prorationDisplay,
        },
        applyImmediately,
      });
    }

    // Aplicar cambio
    const now = new Date();

    // Actualizar suscripción
    const updatedSubscription = await prisma.subscription.update({
      where: { id: params.id },
      data: {
        planId: newPlanId,
        billingCycle: effectiveNewCycle,
        // Actualizar tokens según el nuevo plan
        includedTokensRemaining: newPlan.includedTokensMonthly,
      },
      include: {
        plan: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Generar factura de prorrateo si hay monto a cobrar
    let prorationInvoice = null;

    if (generateInvoice && proration.netAmount !== 0) {
      const items: InvoiceItemInput[] = proration.items.map(item => ({
        type: 'PRORATION',
        description: item.description,
        quantity: item.days,
        unitPrice: item.dailyRate,
      }));

      prorationInvoice = await createInvoice({
        subscriptionId: params.id,
        periodStart: now,
        periodEnd: subscription.currentPeriodEnd,
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 días
        items,
        notes: `Ajuste por cambio de plan: ${subscription.plan.displayName} → ${newPlan.displayName}`,
      });

      // Si es crédito, la factura ya está "pagada" (es un crédito)
      if (proration.netAmount < 0) {
        await prisma.billingInvoice.update({
          where: { id: prorationInvoice.id },
          data: { status: 'PAID', paidAt: now },
        });
      }
    }

    // Audit log
    await logBillingAction(
      auth.userId,
      'PLAN_CHANGE',
      'subscription',
      params.id,
      {
        planId: subscription.plan.id,
        planName: subscription.plan.displayName,
        billingCycle: subscription.billingCycle,
      },
      {
        planId: newPlan.id,
        planName: newPlan.displayName,
        billingCycle: effectiveNewCycle,
        prorationAmount: proration.netAmount,
        prorationInvoiceId: prorationInvoice?.id,
      }
    );

    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        planId: updatedSubscription.planId,
        planName: updatedSubscription.plan.displayName,
        billingCycle: updatedSubscription.billingCycle,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
      },
      proration: {
        ...proration,
        display: prorationDisplay,
      },
      invoice: prorationInvoice ? {
        id: prorationInvoice.id,
        number: prorationInvoice.number,
        total: Number(prorationInvoice.total),
        status: proration.netAmount < 0 ? 'PAID' : 'DRAFT',
      } : null,
    });

  } catch (error) {
    console.error('Error changing plan:', error);
    return NextResponse.json(
      { error: 'Error al cambiar plan' },
      { status: 500 }
    );
  }
}
