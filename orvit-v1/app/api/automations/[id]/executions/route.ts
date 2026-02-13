/**
 * API: /api/automations/[id]/executions
 *
 * GET - Listar historial de ejecuciones de una regla
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getIntParam, getStringParam, getPaginationParams } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/automations/[id]/executions
 * Listar historial de ejecuciones
 *
 * Query params:
 * - status: filter by status
 * - limit: number of records (default: 50)
 * - offset: pagination offset
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
    const idParams = new URLSearchParams();
    idParams.set('id', id);
    const ruleId = getIntParam(idParams, 'id');

    if (ruleId === null) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify rule exists and belongs to company
    const rule = await prisma.automationRule.findFirst({
      where: { id: ruleId, companyId },
      select: { id: true, name: true }
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Regla no encontrada' },
        { status: 404 }
      );
    }

    const { searchParams } = request.nextUrl;
    const status = getStringParam(searchParams, 'status');
    const limit = getIntParam(searchParams, 'limit', 50) ?? 50;
    const offset = getIntParam(searchParams, 'offset', 0) ?? 0;

    // Build where clause
    const where: any = { ruleId };
    if (status) {
      where.status = status;
    }

    const [executions, total] = await Promise.all([
      prisma.automationExecution.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.automationExecution.count({ where })
    ]);

    return NextResponse.json({
      rule: { id: rule.id, name: rule.name },
      executions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + executions.length < total
      }
    });
  } catch (error) {
    console.error('Error en GET /api/automations/[id]/executions:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de ejecuciones' },
      { status: 500 }
    );
  }
}
