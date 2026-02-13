/**
 * API: /api/automations/[id]
 *
 * GET - Obtener detalle de regla
 * PUT - Actualizar regla
 * DELETE - Eliminar regla
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/automations/[id]
 * Obtener detalle de una regla
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const ruleId = parseInt(id);

    if (isNaN(ruleId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const rule = await prisma.automationRule.findFirst({
      where: {
        id: ruleId,
        companyId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            triggerType: true,
            status: true,
            conditionsPassed: true,
            errorMessage: true,
            startedAt: true,
            completedAt: true,
            durationMs: true
          }
        }
      }
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Regla no encontrada' },
        { status: 404 }
      );
    }

    // Get stats
    const stats = await prisma.automationExecution.groupBy({
      by: ['status'],
      where: { ruleId },
      _count: true
    });

    const statsMap: Record<string, number> = {};
    stats.forEach(s => {
      statsMap[s.status] = s._count;
    });

    return NextResponse.json({
      ...rule,
      stats: {
        total: rule.executionCount,
        completed: statsMap['COMPLETED'] || 0,
        failed: statsMap['FAILED'] || 0,
        skipped: statsMap['SKIPPED'] || 0,
        simulated: statsMap['SIMULATED'] || 0
      }
    });
  } catch (error) {
    console.error('Error en GET /api/automations/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener regla' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/automations/[id]
 * Actualizar regla
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const ruleId = parseInt(id);

    if (isNaN(ruleId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify rule exists and belongs to company
    const existingRule = await prisma.automationRule.findFirst({
      where: { id: ruleId, companyId }
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Regla no encontrada' },
        { status: 404 }
      );
    }

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

    // Build update data
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (triggerType !== undefined) updateData.triggerType = triggerType;
    if (triggerConfig !== undefined) updateData.triggerConfig = triggerConfig;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (actions !== undefined) updateData.actions = actions;
    if (priority !== undefined) updateData.priority = priority;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isTestMode !== undefined) updateData.isTestMode = isTestMode;

    const updatedRule = await prisma.automationRule.update({
      where: { id: ruleId },
      data: updateData,
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

    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error('Error en PUT /api/automations/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar regla' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automations/[id]
 * Eliminar regla
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const ruleId = parseInt(id);

    if (isNaN(ruleId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify rule exists and belongs to company
    const existingRule = await prisma.automationRule.findFirst({
      where: { id: ruleId, companyId }
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Regla no encontrada' },
        { status: 404 }
      );
    }

    // Delete rule (executions will cascade delete)
    await prisma.automationRule.delete({
      where: { id: ruleId }
    });

    return NextResponse.json({ success: true, message: 'Regla eliminada' });
  } catch (error) {
    console.error('Error en DELETE /api/automations/[id]:', error);
    return NextResponse.json(
      { error: 'Error al eliminar regla' },
      { status: 500 }
    );
  }
}
