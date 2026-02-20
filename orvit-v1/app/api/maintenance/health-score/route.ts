import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';
import { calculateHealthScore, getHealthBadge } from '@/lib/maintenance/health-score-calculator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/maintenance/health-score
 *
 * Parámetros:
 *   ?machineId=123         → Health score de una máquina específica
 *   ?companyId=456         → Health scores de todas las máquinas activas de la empresa
 *   ?companyId=456&top=10  → Top N máquinas con peor score
 */
export const GET = withGuards(async (request, ctx) => {
  const { searchParams } = new URL(request.url);
  const machineId = searchParams.get('machineId');
  const companyIdParam = searchParams.get('companyId');
  const top = parseInt(searchParams.get('top') || '0', 10);

  // Caso 1: Health score de una máquina específica
  if (machineId) {
    const id = parseInt(machineId);

    // Verificar que la máquina pertenece a la empresa del usuario
    const machine = await prisma.machine.findFirst({
      where: { id, companyId: ctx.user.companyId },
      select: { id: true, name: true, nickname: true, status: true, healthScore: true }
    });

    if (!machine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }

    const factors = await calculateHealthScore(id);

    return NextResponse.json({
      machine: {
        id: machine.id,
        name: machine.name,
        nickname: machine.nickname,
        status: machine.status,
      },
      healthScore: factors.totalScore,
      badge: getHealthBadge(factors.totalScore),
      factors,
    });
  }

  // Caso 2: Health scores de todas las máquinas de la empresa
  const companyId = companyIdParam ? parseInt(companyIdParam) : ctx.user.companyId;

  // Validar que el usuario solo accede a su propia empresa
  if (companyId !== ctx.user.companyId) {
    return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
  }

  const machines = await prisma.machine.findMany({
    where: { companyId, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      nickname: true,
      healthScore: true,
      healthScoreUpdatedAt: true,
    },
    orderBy: { healthScore: 'asc' }, // Peores primero
    ...(top > 0 ? { take: top } : {}),
  });

  const results = machines.map(m => ({
    id: m.id,
    name: m.name,
    nickname: m.nickname,
    healthScore: m.healthScore,
    badge: getHealthBadge(m.healthScore),
    lastUpdated: m.healthScoreUpdatedAt,
  }));

  // Resumen estadístico
  const scores = machines.map(m => m.healthScore).filter((s): s is number => s !== null);
  const summary = scores.length > 0 ? {
    average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    critical: scores.filter(s => s < 50).length,
    warning: scores.filter(s => s >= 50 && s < 80).length,
    healthy: scores.filter(s => s >= 80).length,
    totalMachines: machines.length,
  } : null;

  return NextResponse.json({
    machines: results,
    summary,
  });
});
