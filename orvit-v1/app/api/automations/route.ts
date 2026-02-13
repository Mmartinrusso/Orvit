/**
 * API: /api/automations
 *
 * GET - Listar reglas de automatización
 * POST - Crear nueva regla
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/automations
 * Listar reglas de automatización
 *
 * Query params:
 * - isActive: boolean
 * - triggerType: string
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const { searchParams } = request.nextUrl;

    // Build where clause
    const where: any = { companyId };

    const isActive = searchParams.get('isActive');
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const triggerType = searchParams.get('triggerType');
    if (triggerType) {
      where.triggerType = triggerType;
    }

    const rules = await prisma.automationRule.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            executions: true
          }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { priority: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    // Get recent executions count per rule
    const rulesWithStats = await Promise.all(
      rules.map(async (rule) => {
        const recentExecutions = await prisma.automationExecution.count({
          where: {
            ruleId: rule.id,
            startedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        });

        const successfulExecutions = await prisma.automationExecution.count({
          where: {
            ruleId: rule.id,
            status: 'COMPLETED',
            startedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        });

        return {
          ...rule,
          stats: {
            totalExecutions: rule._count.executions,
            recentExecutions,
            successfulExecutions,
            successRate: recentExecutions > 0
              ? Math.round((successfulExecutions / recentExecutions) * 100)
              : 0
          }
        };
      })
    );

    return NextResponse.json(rulesWithStats);
  } catch (error) {
    console.error('Error en GET /api/automations:', error);
    return NextResponse.json(
      { error: 'Error al obtener reglas de automatización' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automations
 * Crear nueva regla de automatización
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;

    const body = await request.json();
    const {
      name,
      description,
      triggerType,
      triggerConfig,
      conditions,
      actions,
      priority,
      isActive,
      isTestMode
    } = body;

    // Validations
    if (!name || !triggerType) {
      return NextResponse.json(
        { error: 'Nombre y tipo de trigger son requeridos' },
        { status: 400 }
      );
    }

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json(
        { error: 'Debe definir al menos una acción' },
        { status: 400 }
      );
    }

    // Validate trigger type
    const validTriggerTypes = [
      'WORK_ORDER_CREATED',
      'WORK_ORDER_STATUS_CHANGED',
      'WORK_ORDER_ASSIGNED',
      'FAILURE_REPORTED',
      'FAILURE_RECURRENCE',
      'STOCK_LOW',
      'PREVENTIVE_DUE',
      'MACHINE_STATUS_CHANGED',
      'SCHEDULED'
    ];

    if (!validTriggerTypes.includes(triggerType)) {
      return NextResponse.json(
        { error: `Tipo de trigger inválido. Válidos: ${validTriggerTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Create rule
    const rule = await prisma.automationRule.create({
      data: {
        companyId,
        name,
        description,
        triggerType,
        triggerConfig: triggerConfig || {},
        conditions: conditions || [],
        actions,
        priority: priority || 100,
        isActive: isActive !== false,
        isTestMode: isTestMode === true,
        createdById: userId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/automations:', error);
    return NextResponse.json(
      { error: 'Error al crear regla de automatización' },
      { status: 500 }
    );
  }
}
