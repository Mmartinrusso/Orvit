/**
 * Cash Flow Projection API
 *
 * POST: Generate cash flow projection with configurable assumptions via body.
 *       Wraps the existing ML forecaster with POST semantics for richer payloads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import {
  generateCashFlowForecast,
  type ForecastAssumptions,
  DEFAULT_ASSUMPTIONS,
} from '@/lib/tesoreria/cash-flow-forecaster';
import { prisma } from '@/lib/prisma';
import { addDays, subDays, format, startOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

interface ProjectionRequest {
  days?: number;
  cobranzaPct?: number;
  diasRetraso?: number;
  margenSeguridad?: number;
  includeHistorical?: boolean;
  historicalDays?: number;
}

interface HistoricalDay {
  date: string;
  ingresos: number;
  egresos: number;
  saldo: number;
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.POSICION_VIEW);
    if (error) return error;

    const body: ProjectionRequest = await request.json().catch(() => ({}));

    const days = clamp(body.days ?? 30, 7, 90);
    const historicalDays = clamp(body.historicalDays ?? 15, 7, 60);
    const includeHistorical = body.includeHistorical ?? true;

    const assumptions: ForecastAssumptions = {
      cobranzaPct: clamp(body.cobranzaPct ?? DEFAULT_ASSUMPTIONS.cobranzaPct, 0, 100),
      diasRetraso: clamp(body.diasRetraso ?? DEFAULT_ASSUMPTIONS.diasRetraso, 0, 60),
      margenSeguridad: clamp(body.margenSeguridad ?? DEFAULT_ASSUMPTIONS.margenSeguridad, 0, 50),
    };

    // Generate the ML forecast
    const forecast = await generateCashFlowForecast(user!.companyId, days, assumptions);

    // Optionally include historical data for the chart
    let historical: HistoricalDay[] = [];
    if (includeHistorical) {
      historical = await getHistoricalCashFlow(user!.companyId, historicalDays);
    }

    // Detect alerts: days with projected negative balance
    const negativeDays = forecast.predictions
      .filter(p => p.accumulatedBalance < 0)
      .map(p => ({
        date: p.date,
        balance: p.accumulatedBalance,
        deficit: Math.abs(p.accumulatedBalance),
      }));

    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');

    return NextResponse.json({
      currentPosition: forecast.currentPosition,
      assumptions,
      historical,
      projections: forecast.predictions.map(p => ({
        date: p.date,
        ingresos: p.predictedInflow,
        egresos: p.predictedOutflow,
        neto: p.predictedNet,
        saldoProyectado: p.accumulatedBalance,
        confianza: p.confidence,
        riesgo: p.riskLevel,
        desglose: p.breakdown,
      })),
      alerts: forecast.alerts,
      negativeDays,
      summary: {
        ...forecast.summary,
        daysWithDeficit: negativeDays.length,
        maxDeficit: negativeDays.length > 0
          ? Math.max(...negativeDays.map(d => d.deficit))
          : 0,
      },
    }, { headers });
  } catch (err) {
    console.error('Error generating cash flow projection:', err);
    return NextResponse.json(
      { error: 'Error al generar proyección de flujo de caja' },
      { status: 500 }
    );
  }
}

/**
 * Retrieve historical daily cash flow from bank + cash movements
 */
async function getHistoricalCashFlow(
  companyId: number,
  days: number
): Promise<HistoricalDay[]> {
  const startDate = startOfDay(subDays(new Date(), days));

  const [bankMovements, cashMovements, startingPosition] = await Promise.all([
    prisma.bankMovement.findMany({
      where: {
        bankAccount: { companyId, isActive: true },
        fecha: { gte: startDate },
      },
      select: { fecha: true, ingreso: true, egreso: true },
      orderBy: { fecha: 'asc' },
    }),
    prisma.cashMovement.findMany({
      where: {
        cashAccount: { companyId, isActive: true },
        fecha: { gte: startDate },
        docType: 'T1',
      },
      select: { fecha: true, ingreso: true, egreso: true },
      orderBy: { fecha: 'asc' },
    }),
    // Calculate position as of startDate by getting totals before startDate
    getPositionAsOfDate(companyId, startDate),
  ]);

  // Aggregate by day
  const dailyMap = new Map<string, { ingresos: number; egresos: number }>();

  for (let i = 0; i < days; i++) {
    const d = format(addDays(startDate, i), 'yyyy-MM-dd');
    dailyMap.set(d, { ingresos: 0, egresos: 0 });
  }

  for (const m of [...bankMovements, ...cashMovements]) {
    const dateKey = format(m.fecha, 'yyyy-MM-dd');
    const entry = dailyMap.get(dateKey);
    if (entry) {
      entry.ingresos += Number(m.ingreso || 0);
      entry.egresos += Number(m.egreso || 0);
    }
  }

  const result: HistoricalDay[] = [];
  let runningBalance = startingPosition;

  const sortedDates = Array.from(dailyMap.keys()).sort();
  for (const date of sortedDates) {
    const dayData = dailyMap.get(date)!;
    runningBalance += dayData.ingresos - dayData.egresos;
    result.push({
      date,
      ingresos: Math.round(dayData.ingresos * 100) / 100,
      egresos: Math.round(dayData.egresos * 100) / 100,
      saldo: Math.round(runningBalance * 100) / 100,
    });
  }

  return result;
}

/**
 * Calculate consolidated treasury position as of a specific date
 */
async function getPositionAsOfDate(companyId: number, asOfDate: Date): Promise<number> {
  const [bankTotal, cashTotal] = await Promise.all([
    prisma.bankMovement.aggregate({
      where: {
        bankAccount: { companyId, isActive: true },
        fecha: { lt: asOfDate },
      },
      _sum: { ingreso: true, egreso: true },
    }),
    prisma.cashMovement.aggregate({
      where: {
        cashAccount: { companyId, isActive: true },
        fecha: { lt: asOfDate },
        docType: 'T1',
      },
      _sum: { ingreso: true, egreso: true },
    }),
  ]);

  const bankBalance = Number(bankTotal._sum.ingreso || 0) - Number(bankTotal._sum.egreso || 0);
  const cashBalance = Number(cashTotal._sum.ingreso || 0) - Number(cashTotal._sum.egreso || 0);

  return bankBalance + cashBalance;
}

function clamp(value: number, min: number, max: number): number {
  if (isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
