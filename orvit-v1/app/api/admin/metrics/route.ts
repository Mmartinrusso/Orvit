import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/metrics?name=work_orders_created&startDate=...&endDate=...&groupBy=day
 *
 * Retorna métricas agregadas por grupo temporal.
 * Query params:
 *   - name (opcional): filtrar por nombre de métrica
 *   - startDate (requerido): inicio del rango ISO
 *   - endDate (requerido): fin del rango ISO
 *   - groupBy: hour | day | week | month (default: day)
 */
export const GET = withGuards(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'day';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate y endDate son requeridos (formato ISO)' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'startDate y endDate deben ser fechas válidas ISO' },
        { status: 400 }
      );
    }

    if (!['hour', 'day', 'week', 'month'].includes(groupBy)) {
      return NextResponse.json(
        { error: 'groupBy debe ser: hour, day, week, month' },
        { status: 400 }
      );
    }

    // DATE_TRUNC para PostgreSQL
    const truncExpr = `DATE_TRUNC('${groupBy}', "timestamp")`;

    const whereClause = name
      ? `WHERE "company_id" = $1 AND "timestamp" >= $2 AND "timestamp" <= $3 AND "name" = $4`
      : `WHERE "company_id" = $1 AND "timestamp" >= $2 AND "timestamp" <= $3`;

    const params: unknown[] = name
      ? [user.companyId, start, end, name]
      : [user.companyId, start, end];

    const result = await prisma.$queryRawUnsafe<Array<{
      period: Date;
      metric_name: string;
      sum: number;
      avg: number;
      min: number;
      max: number;
      count: bigint;
    }>>(
      `SELECT
        ${truncExpr} AS period,
        "name" AS metric_name,
        SUM("value") AS sum,
        AVG("value") AS avg,
        MIN("value") AS min,
        MAX("value") AS max,
        COUNT(*) AS count
      FROM "business_metrics"
      ${whereClause}
      GROUP BY period, "name"
      ORDER BY period ASC, "name" ASC`,
      ...params
    );

    const data = result.map(row => ({
      period: row.period,
      name: row.metric_name,
      sum: Number(row.sum),
      avg: Number(row.avg),
      min: Number(row.min),
      max: Number(row.max),
      count: Number(row.count),
    }));

    return NextResponse.json({ data, groupBy, startDate, endDate });
  } catch (error) {
    console.error('Error en GET /api/admin/metrics:', error);
    return NextResponse.json(
      { error: 'Error al obtener métricas' },
      { status: 500 }
    );
  }
});
