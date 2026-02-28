/**
 * API: /api/maintenance/solution-effectiveness
 *
 * GET - Estadísticas de efectividad de soluciones aplicadas
 *       Usado por el widget SolutionEffectiveness del gerente
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get('sectorId') ? parseInt(searchParams.get('sectorId')!) : undefined;

    const where: any = { companyId };
    if (sectorId) {
      where.failureOccurrence = { machine: { sectorId } };
    }

    const [byOutcome, avgMinutes] = await Promise.all([
      prisma.solutionApplied.groupBy({
        by: ['outcome'],
        where,
        _count: true,
      }),
      prisma.solutionApplied.aggregate({
        where: { ...where, actualMinutes: { not: null } },
        _avg: { actualMinutes: true },
      }),
    ]);

    const outcomeMap: Record<string, number> = {};
    let total = 0;
    for (const g of byOutcome) {
      if (g.outcome) {
        outcomeMap[g.outcome] = g._count;
        total += g._count;
      }
    }

    return NextResponse.json({
      total,
      byOutcome: {
        'FUNCIONÓ': outcomeMap['FUNCIONÓ'] || 0,
        'PARCIAL': outcomeMap['PARCIAL'] || 0,
        'NO_FUNCIONÓ': outcomeMap['NO_FUNCIONÓ'] || 0,
      },
      avgResolutionMinutes: Math.round(avgMinutes._avg.actualMinutes || 0),
    });
  } catch (error: any) {
    console.error('Error en GET /api/maintenance/solution-effectiveness:', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
