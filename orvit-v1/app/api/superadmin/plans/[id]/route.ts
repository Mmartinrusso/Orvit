import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { logBillingAction } from '@/lib/billing/audit';

export const dynamic = 'force-dynamic';

// GET - Obtener detalle de un plan
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: params.id },
      include: {
        subscriptions: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: { companies: true },
            },
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      plan: {
        ...plan,
        monthlyPrice: Number(plan.monthlyPrice),
        annualPrice: plan.annualPrice ? Number(plan.annualPrice) : null,
        subscriptions: plan.subscriptions.map(sub => ({
          ...sub,
          companiesCount: sub._count.companies,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json({ error: 'Error al obtener plan' }, { status: 500 });
  }
}

// PUT - Actualizar plan
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: params.id },
    });

    if (!existingPlan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      displayName,
      description,
      currency,
      monthlyPrice,
      annualPrice,
      maxCompanies,
      maxUsersPerCompany,
      maxStorageGB,
      includedTokensMonthly,
      moduleKeys,
      features,
      isActive,
      sortOrder,
      color,
      icon,
    } = body;

    // Si se cambia el nombre, verificar que no exista
    if (name && name.toUpperCase() !== existingPlan.name) {
      const duplicateName = await prisma.subscriptionPlan.findUnique({
        where: { name: name.toUpperCase() },
      });

      if (duplicateName) {
        return NextResponse.json(
          { error: 'Ya existe un plan con ese nombre' },
          { status: 400 }
        );
      }
    }

    // Construir objeto de actualización solo con campos proporcionados
    const updateData: any = {};

    if (name !== undefined) updateData.name = name.toUpperCase();
    if (displayName !== undefined) updateData.displayName = displayName;
    if (description !== undefined) updateData.description = description;
    if (currency !== undefined) updateData.currency = currency;
    if (monthlyPrice !== undefined) updateData.monthlyPrice = new Prisma.Decimal(monthlyPrice);
    if (annualPrice !== undefined) {
      updateData.annualPrice = annualPrice ? new Prisma.Decimal(annualPrice) : null;
    }
    if (maxCompanies !== undefined) updateData.maxCompanies = maxCompanies;
    if (maxUsersPerCompany !== undefined) updateData.maxUsersPerCompany = maxUsersPerCompany;
    if (maxStorageGB !== undefined) updateData.maxStorageGB = maxStorageGB;
    if (includedTokensMonthly !== undefined) updateData.includedTokensMonthly = includedTokensMonthly;
    if (moduleKeys !== undefined) updateData.moduleKeys = moduleKeys;
    if (features !== undefined) updateData.features = features;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;

    const plan = await prisma.subscriptionPlan.update({
      where: { id: params.id },
      data: updateData,
    });

    // Audit log
    await logBillingAction(
      auth.userId,
      'PLAN_UPDATED',
      'plan',
      params.id,
      {
        name: existingPlan.name,
        displayName: existingPlan.displayName,
        monthlyPrice: Number(existingPlan.monthlyPrice),
        isActive: existingPlan.isActive,
      },
      {
        name: plan.name,
        displayName: plan.displayName,
        monthlyPrice: Number(plan.monthlyPrice),
        isActive: plan.isActive,
      }
    );

    return NextResponse.json({
      success: true,
      plan: {
        ...plan,
        monthlyPrice: Number(plan.monthlyPrice),
        annualPrice: plan.annualPrice ? Number(plan.annualPrice) : null,
      },
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json({ error: 'Error al actualizar plan' }, { status: 500 });
  }
}

// DELETE - Eliminar plan (solo si no tiene suscripciones activas)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    // No permitir eliminar si tiene suscripciones activas
    if (plan._count.subscriptions > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar el plan porque tiene ${plan._count.subscriptions} suscripción(es) asociada(s). Desactívelo en su lugar.`,
        },
        { status: 400 }
      );
    }

    await prisma.subscriptionPlan.delete({
      where: { id: params.id },
    });

    // Audit log
    await logBillingAction(
      auth.userId,
      'PLAN_DEACTIVATED',
      'plan',
      params.id,
      { name: plan.name, displayName: plan.displayName },
      null
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json({ error: 'Error al eliminar plan' }, { status: 500 });
  }
}
