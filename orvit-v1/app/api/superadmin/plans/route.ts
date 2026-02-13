import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { logBillingAction } from '@/lib/billing/audit';

export const dynamic = 'force-dynamic';

// Generar ID para planes
function generatePlanId(name: string): string {
  return `plan_${name.toLowerCase().replace(/\s+/g, '_')}`;
}

// GET - Listar todos los planes
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    // Agregar conteo de suscripciones activas
    const plansWithStats = plans.map(plan => ({
      ...plan,
      monthlyPrice: Number(plan.monthlyPrice),
      annualPrice: plan.annualPrice ? Number(plan.annualPrice) : null,
      activeSubscriptions: plan._count.subscriptions,
    }));

    return NextResponse.json({ plans: plansWithStats });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json({ error: 'Error al obtener planes' }, { status: 500 });
  }
}

// POST - Crear nuevo plan
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      displayName,
      description,
      currency = 'ARS',
      monthlyPrice,
      annualPrice,
      maxCompanies,
      maxUsersPerCompany,
      maxStorageGB,
      includedTokensMonthly = 0,
      moduleKeys = [],
      features = [],
      isActive = true,
      sortOrder = 0,
      color = '#8B5CF6',
      icon,
    } = body;

    // Validaciones
    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Nombre y nombre de display son requeridos' },
        { status: 400 }
      );
    }

    if (monthlyPrice === undefined || monthlyPrice < 0) {
      return NextResponse.json(
        { error: 'El precio mensual debe ser un número positivo' },
        { status: 400 }
      );
    }

    // Verificar nombre único
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { name: name.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un plan con ese nombre' },
        { status: 400 }
      );
    }

    const planId = generatePlanId(name);

    const plan = await prisma.subscriptionPlan.create({
      data: {
        id: planId,
        name: name.toUpperCase(),
        displayName,
        description: description || null,
        currency,
        monthlyPrice: new Prisma.Decimal(monthlyPrice),
        annualPrice: annualPrice ? new Prisma.Decimal(annualPrice) : null,
        maxCompanies: maxCompanies ?? null,
        maxUsersPerCompany: maxUsersPerCompany ?? null,
        maxStorageGB: maxStorageGB ?? null,
        includedTokensMonthly,
        moduleKeys,
        features,
        isActive,
        sortOrder,
        color,
        icon: icon || null,
      },
    });

    // Audit log
    await logBillingAction(
      auth.userId,
      'PLAN_CREATED',
      'plan',
      planId,
      null,
      {
        name: plan.name,
        displayName: plan.displayName,
        monthlyPrice: Number(plan.monthlyPrice),
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
    console.error('Error creating plan:', error);
    return NextResponse.json({ error: 'Error al crear plan' }, { status: 500 });
  }
}
