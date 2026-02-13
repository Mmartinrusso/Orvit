import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/asset-lifecycle/repair-replace
 * Get repair vs replace analyses
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const machineId = searchParams.get('machineId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const analyses = await prisma.$queryRaw`
      SELECT
        rra.*,
        m."name" as "machineName",
        m."healthScore",
        u."name" as "createdByName"
      FROM "RepairReplaceAnalysis" rra
      LEFT JOIN "Machine" m ON rra."machineId" = m."id"
      LEFT JOIN "User" u ON rra."createdById" = u."id"
      WHERE rra."companyId" = ${companyId}
      ${machineId ? prisma.$queryRaw`AND rra."machineId" = ${parseInt(machineId)}` : prisma.$queryRaw``}
      ORDER BY rra."analysisDate" DESC
      LIMIT 50
    `;

    return NextResponse.json({ analyses });
  } catch (error: any) {
    if (error.code === '42P01') {
      return NextResponse.json({ analyses: [], message: 'Table not yet created' });
    }
    console.error('Error fetching analyses:', error);
    return NextResponse.json({ error: 'Error fetching analyses' }, { status: 500 });
  }
}

/**
 * POST /api/asset-lifecycle/repair-replace
 * Create a new repair vs replace analysis
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyId,
      machineId,
      remainingLifeYears,
      annualMaintenanceCost,
      replacementCost,
      newEquipmentEfficiency,
      notes,
      createdById,
    } = body;

    if (!companyId || !machineId || !annualMaintenanceCost || !replacementCost) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate recommendation
    const analysis = calculateRepairReplace({
      remainingLifeYears: remainingLifeYears || 5,
      annualMaintenanceCost,
      replacementCost,
      newEquipmentEfficiency: newEquipmentEfficiency || 100,
    });

    await prisma.$executeRaw`
      INSERT INTO "RepairReplaceAnalysis" (
        "companyId", "machineId", "analysisDate",
        "remainingLifeYears", "annualMaintenanceCost", "replacementCost",
        "newEquipmentEfficiency", "recommendation", "breakEvenYears",
        "confidence", "notes", "createdById"
      ) VALUES (
        ${companyId}, ${machineId}, NOW(),
        ${remainingLifeYears || null}, ${annualMaintenanceCost}, ${replacementCost},
        ${newEquipmentEfficiency || null}, ${analysis.recommendation},
        ${analysis.breakEvenYears}, ${analysis.confidence},
        ${notes || null}, ${createdById}
      )
    `;

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    console.error('Error creating analysis:', error);
    return NextResponse.json({ error: 'Error creating analysis' }, { status: 500 });
  }
}

interface RepairReplaceInput {
  remainingLifeYears: number;
  annualMaintenanceCost: number;
  replacementCost: number;
  newEquipmentEfficiency: number;
}

interface RepairReplaceResult {
  recommendation: 'REPAIR' | 'REPLACE' | 'MONITOR';
  breakEvenYears: number;
  confidence: number;
  reasoning: string;
}

function calculateRepairReplace(input: RepairReplaceInput): RepairReplaceResult {
  const { remainingLifeYears, annualMaintenanceCost, replacementCost, newEquipmentEfficiency } = input;

  // Calculate break-even point
  // breakEven = replacementCost / (annualMaintenanceCost - newAnnualCost)
  // Assuming new equipment has 30% of old maintenance cost
  const newAnnualCost = annualMaintenanceCost * 0.3;
  const annualSavings = annualMaintenanceCost - newAnnualCost;

  const breakEvenYears = annualSavings > 0 ? replacementCost / annualSavings : 999;

  // Determine recommendation
  let recommendation: 'REPAIR' | 'REPLACE' | 'MONITOR';
  let confidence: number;
  let reasoning: string;

  if (breakEvenYears <= 2) {
    recommendation = 'REPLACE';
    confidence = 90;
    reasoning = `El costo anual de mantenimiento (${annualMaintenanceCost.toLocaleString()}) es muy alto. La inversión se recupera en ${breakEvenYears.toFixed(1)} años.`;
  } else if (breakEvenYears <= remainingLifeYears && breakEvenYears <= 5) {
    recommendation = 'REPLACE';
    confidence = 75;
    reasoning = `El equipo tiene ${remainingLifeYears} años de vida útil restante pero el breakeven es en ${breakEvenYears.toFixed(1)} años.`;
  } else if (breakEvenYears > remainingLifeYears * 1.5) {
    recommendation = 'REPAIR';
    confidence = 80;
    reasoning = `El equipo puede mantenerse de forma rentable. El breakeven (${breakEvenYears.toFixed(1)} años) supera la vida útil restante.`;
  } else {
    recommendation = 'MONITOR';
    confidence = 60;
    reasoning = `Situación borderline. Monitorear costos de mantenimiento y reevaluar en 6 meses.`;
  }

  // Adjust confidence based on efficiency gains
  if (newEquipmentEfficiency > 120) {
    confidence = Math.min(confidence + 10, 95);
    if (recommendation === 'REPAIR') {
      recommendation = 'MONITOR';
      reasoning += ` Considerar las ganancias de eficiencia del nuevo equipo (${newEquipmentEfficiency}%).`;
    }
  }

  return {
    recommendation,
    breakEvenYears: Math.round(breakEvenYears * 10) / 10,
    confidence,
    reasoning,
  };
}
