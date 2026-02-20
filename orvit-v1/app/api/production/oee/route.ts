import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';
import { aggregateOEE, OEEInput } from '@/lib/production/oee-calculator';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const workCenterId = searchParams.get('workCenterId');

    const startDate = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const reports = await prisma.dailyProductionReport.findMany({
      where: {
        companyId: auth.companyId,
        date: { gte: startDate, lte: endDate },
        ...(workCenterId ? { workCenterId: parseInt(workCenterId) } : {}),
      },
      select: {
        date: true,
        workCenterId: true,
        goodQuantity: true,
        scrapQuantity: true,
        reworkQuantity: true,
        productiveMinutes: true,
        downtimeMinutes: true,
        setupMinutes: true,
        shiftDurationMinutes: true,
        workCenter: {
          select: { id: true, name: true, standardCycleSeconds: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const toInput = (r: typeof reports[0]): OEEInput => ({
      shiftDurationMinutes: r.shiftDurationMinutes,
      downtimeMinutes: r.downtimeMinutes,
      setupMinutes: r.setupMinutes,
      productiveMinutes: r.productiveMinutes,
      goodQuantity: Number(r.goodQuantity),
      scrapQuantity: Number(r.scrapQuantity),
      reworkQuantity: Number(r.reworkQuantity),
      standardCycleSeconds: r.workCenter?.standardCycleSeconds ?? null,
    });

    // Resumen global del período
    const summary = aggregateOEE(reports.map(toInput));

    // Tendencia: OEE agrupado por día
    const byDateMap = new Map<string, OEEInput[]>();
    for (const r of reports) {
      const dateKey = format(new Date(r.date), 'yyyy-MM-dd');
      if (!byDateMap.has(dateKey)) byDateMap.set(dateKey, []);
      byDateMap.get(dateKey)!.push(toInput(r));
    }

    const trend = Array.from(byDateMap.entries()).map(([date, dayInputs]) => ({
      date,
      ...aggregateOEE(dayInputs),
    }));

    // Por centro de trabajo
    const byWCMap = new Map<number, { name: string; inputs: OEEInput[]; reportCount: number }>();
    for (const r of reports) {
      if (!r.workCenterId) continue;
      if (!byWCMap.has(r.workCenterId)) {
        byWCMap.set(r.workCenterId, {
          name: r.workCenter?.name || `Centro ${r.workCenterId}`,
          inputs: [],
          reportCount: 0,
        });
      }
      const entry = byWCMap.get(r.workCenterId)!;
      entry.reportCount++;
      entry.inputs.push(toInput(r));
    }

    const byWorkCenter = Array.from(byWCMap.entries())
      .map(([wcId, { name, inputs: wcInputs, reportCount }]) => ({
        workCenterId: wcId,
        workCenterName: name,
        reportCount,
        ...aggregateOEE(wcInputs),
      }))
      .sort((a, b) => (b.oee ?? b.oeePartial) - (a.oee ?? a.oeePartial));

    return NextResponse.json({
      success: true,
      reportCount: reports.length,
      summary,
      trend,
      byWorkCenter,
    });
  } catch (error) {
    console.error('[OEE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al calcular OEE' },
      { status: 500 }
    );
  }
}
