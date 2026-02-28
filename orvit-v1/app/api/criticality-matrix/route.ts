import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/criticality-matrix
 * Returns criticality matrix data for machines
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const companyId = user!.companyId;
    const areaId = searchParams.get('areaId');
    const sectorId = searchParams.get('sectorId');

    // Get machines with criticality scores
    const whereClause: any = {
      companyId,
      isActive: true,
    };
    if (areaId) whereClause.areaId = parseInt(areaId);
    if (sectorId) whereClause.sectorId = parseInt(sectorId);

    const machines = await prisma.machine.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        type: true,
        location: true,
        status: true,
        healthScore: true,
        criticalityScore: true,
        criticalityProduction: true,
        criticalitySafety: true,
        criticalityQuality: true,
        criticalityCost: true,
        area: {
          select: { id: true, name: true },
        },
        sector: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { criticalityScore: 'desc' },
        { name: 'asc' },
      ],
    });

    // Calculate criticality distribution
    const distribution = {
      critical: machines.filter((m) => (m.criticalityScore || 0) >= 80).length,
      high: machines.filter((m) => {
        const score = m.criticalityScore || 0;
        return score >= 60 && score < 80;
      }).length,
      medium: machines.filter((m) => {
        const score = m.criticalityScore || 0;
        return score >= 40 && score < 60;
      }).length,
      low: machines.filter((m) => (m.criticalityScore || 0) < 40).length,
    };

    // Average scores by category
    const avgScores = {
      production: calculateAverage(machines.map((m) => m.criticalityProduction)),
      safety: calculateAverage(machines.map((m) => m.criticalitySafety)),
      quality: calculateAverage(machines.map((m) => m.criticalityQuality)),
      cost: calculateAverage(machines.map((m) => m.criticalityCost)),
    };

    // Top 10 most critical machines
    const topCritical = machines
      .filter((m) => m.criticalityScore !== null)
      .slice(0, 10);

    // Machines needing assessment (no criticality score)
    const needsAssessment = machines.filter((m) => m.criticalityScore === null);

    return NextResponse.json({
      machines: machines.map((m) => ({
        ...m,
        criticalityLevel: getCriticalityLevel(m.criticalityScore),
        healthLevel: getHealthLevel(m.healthScore),
      })),
      summary: {
        total: machines.length,
        assessed: machines.filter((m) => m.criticalityScore !== null).length,
        needsAssessment: needsAssessment.length,
        distribution,
        averageScores: avgScores,
      },
      topCritical,
      needsAssessment: needsAssessment.slice(0, 20),
    });
  } catch (error) {
    console.error('Error fetching criticality matrix:', error);
    return NextResponse.json(
      { error: 'Error fetching criticality matrix' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/criticality-matrix
 * Bulk update criticality scores
 */
export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Updates array required' }, { status: 400 });
    }

    const results = [];

    for (const update of updates) {
      const { machineId, production, safety, quality, cost } = update;

      if (!machineId) continue;

      // Calculate total score (weighted average)
      const weights = { production: 0.3, safety: 0.35, quality: 0.2, cost: 0.15 };
      const totalScore = Math.round(
        (production || 5) * weights.production * 10 +
        (safety || 5) * weights.safety * 10 +
        (quality || 5) * weights.quality * 10 +
        (cost || 5) * weights.cost * 10
      );

      const updated = await prisma.machine.update({
        where: { id: machineId },
        data: {
          criticalityProduction: production,
          criticalitySafety: safety,
          criticalityQuality: quality,
          criticalityCost: cost,
          criticalityScore: totalScore,
        },
        select: {
          id: true,
          name: true,
          criticalityScore: true,
        },
      });

      results.push(updated);
    }

    return NextResponse.json({
      success: true,
      updated: results.length,
      results,
    });
  } catch (error) {
    console.error('Error updating criticality matrix:', error);
    return NextResponse.json(
      { error: 'Error updating criticality matrix' },
      { status: 500 }
    );
  }
}

function calculateAverage(values: (number | null)[]): number {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return 0;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

function getCriticalityLevel(score: number | null): string {
  if (score === null) return 'NOT_ASSESSED';
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function getHealthLevel(score: number | null): string {
  if (score === null) return 'UNKNOWN';
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'FAIR';
  return 'POOR';
}
