import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '30d' | '90d';

type SparkPoint = { x: string; y: number };

export type TasksDashboardDTO = {
  meta: { generatedAt: string; range: RangeKey };
  kpis: {
    pending: { value: number; deltaPct: number | null; series: SparkPoint[] };
    completed: { value: number; deltaPct: number | null; series: SparkPoint[] };
    overdue: { value: number; deltaPct: number | null; series: SparkPoint[] };
    dueSoon: { value: number; deltaPct: number | null; series: SparkPoint[] };
  };
  charts: {
    createdVsCompleted: { x: string; created: number; completed: number }[];
    byStatus: { name: string; value: number }[];
    byPriority: { name: string; value: number }[];
  };
  lists: {
    dueToday: Array<{ id: string; title: string; dueDate?: string; priority: string; status: string }>;
    overdue: Array<{ id: string; title: string; dueDate?: string; priority: string; status: string }>;
  };
};

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: { companies: { include: { company: true } }, ownedCompanies: true },
    });
  } catch {
    return null;
  }
}

function parseRange(raw: string | null): RangeKey {
  switch ((raw || '').toLowerCase()) {
    case '7d':
      return '7d';
    case '90d':
      return '90d';
    default:
      return '30d';
  }
}

function daysForRange(range: RangeKey) {
  return range === '7d' ? 7 : range === '90d' ? 90 : 30;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmtDayLabel(d: Date) {
  // dd/MM
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function deltaPct(current: number, prev: number): number | null {
  if (!prev) return null;
  return (current - prev) / Math.max(1, prev);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (user.role === 'SUPERADMIN') {
      // SUPERADMIN no tiene tareas específicas
      const empty: TasksDashboardDTO = {
        meta: { generatedAt: new Date().toISOString(), range: '30d' },
        kpis: {
          pending: { value: 0, deltaPct: null, series: [] },
          completed: { value: 0, deltaPct: null, series: [] },
          overdue: { value: 0, deltaPct: null, series: [] },
          dueSoon: { value: 0, deltaPct: null, series: [] },
        },
        charts: { createdVsCompleted: [], byStatus: [], byPriority: [] },
        lists: { dueToday: [], overdue: [] },
      };
      return NextResponse.json(empty);
    }

    let companyId: number | null = null;
    if (user.ownedCompanies?.length) companyId = user.ownedCompanies[0].id;
    else if (user.companies?.length) companyId = user.companies[0].company.id;
    if (!companyId) return NextResponse.json({ error: 'Usuario sin empresa' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const range = parseRange(searchParams.get('range'));
    const days = daysForRange(range);

    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
    const prevEnd = start;

    const todayStart = startOfDay(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const soonEnd = new Date(todayStart);
    soonEnd.setDate(soonEnd.getDate() + 3);

    // Base queries (limitadas por empresa)
    const taskTableExists = await prisma.$queryRaw`SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'Task'` as any[];
    if (!taskTableExists[0] || taskTableExists[0].count == 0) {
      const empty: TasksDashboardDTO = {
        meta: { generatedAt: new Date().toISOString(), range },
        kpis: {
          pending: { value: 0, deltaPct: null, series: [] },
          completed: { value: 0, deltaPct: null, series: [] },
          overdue: { value: 0, deltaPct: null, series: [] },
          dueSoon: { value: 0, deltaPct: null, series: [] },
        },
        charts: { createdVsCompleted: [], byStatus: [], byPriority: [] },
        lists: { dueToday: [], overdue: [] },
      };
      return NextResponse.json(empty);
    }

    // KPI actuales (estado actual)
    const [
      pendingNow,
      completedInRange,
      overdueNow,
      dueSoonNow,
      pendingPrev,
      completedPrev,
      overduePrev,
      dueSoonPrev,
    ] = await Promise.all([
      prisma.task.count({ where: { companyId, status: { in: ['TODO', 'IN_PROGRESS'] } } as any }),
      prisma.task.count({ where: { companyId, status: 'DONE', updatedAt: { gte: start, lte: now } } as any }),
      prisma.task.count({ where: { companyId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: todayStart } } as any }),
      prisma.task.count({ where: { companyId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { gte: todayStart, lt: soonEnd } } as any }),
      prisma.task.count({ where: { companyId, status: { in: ['TODO', 'IN_PROGRESS'] }, createdAt: { gte: prevStart, lt: prevEnd } } as any }),
      prisma.task.count({ where: { companyId, status: 'DONE', updatedAt: { gte: prevStart, lt: prevEnd } } as any }),
      prisma.task.count({ where: { companyId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: startOfDay(prevEnd) } } as any }),
      prisma.task.count({
        where: {
          companyId,
          status: { notIn: ['DONE', 'CANCELLED'] },
          dueDate: { gte: startOfDay(prevEnd), lt: new Date(startOfDay(prevEnd).getTime() + 3 * 24 * 60 * 60 * 1000) },
        } as any,
      }),
    ]);

    // Series created/completed por día (rango actual)
    // Usamos raw para agrupar por día sin traer muchas filas
    const createdRows = await prisma.$queryRaw<
      Array<{ day: Date; count: bigint }>
    >`
      SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as count
      FROM "Task"
      WHERE "companyId" = ${companyId} AND "createdAt" >= ${start} AND "createdAt" <= ${now}
      GROUP BY day
      ORDER BY day ASC
    `;

    const completedRows = await prisma.$queryRaw<
      Array<{ day: Date; count: bigint }>
    >`
      SELECT date_trunc('day', "updatedAt") as day, COUNT(*)::bigint as count
      FROM "Task"
      WHERE "companyId" = ${companyId} AND status = 'DONE' AND "updatedAt" >= ${start} AND "updatedAt" <= ${now}
      GROUP BY day
      ORDER BY day ASC
    `;

    const createdMap = new Map<string, number>();
    const completedMap = new Map<string, number>();
    createdRows.forEach((r) => createdMap.set(fmtDayLabel(new Date(r.day)), Number(r.count)));
    completedRows.forEach((r) => completedMap.set(fmtDayLabel(new Date(r.day)), Number(r.count)));

    const points: Array<{ x: string; created: number; completed: number }> = [];
    const startIter = startOfDay(start);
    const endIter = startOfDay(now);
    for (let d = new Date(startIter); d <= endIter; d.setDate(d.getDate() + 1)) {
      const key = fmtDayLabel(d);
      points.push({ x: key, created: createdMap.get(key) || 0, completed: completedMap.get(key) || 0 });
    }

    // Pending sparkline aproximado (cumulativo)
    const basePending = await prisma.task.count({
      where: { companyId, status: { in: ['TODO', 'IN_PROGRESS'] }, createdAt: { lt: startIter } } as any,
    });
    let cumPending = basePending;
    const pendingSeries: SparkPoint[] = points.map((p) => {
      cumPending = Math.max(0, cumPending + p.created - p.completed);
      return { x: p.x, y: cumPending };
    });
    const completedSeries: SparkPoint[] = points.map((p) => ({ x: p.x, y: p.completed }));

    // Overdue series (por vencimientos dentro del rango, como señal visual)
    const overdueRows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', "dueDate") as day, COUNT(*)::bigint as count
      FROM "Task"
      WHERE "companyId" = ${companyId}
        AND "dueDate" IS NOT NULL
        AND "dueDate" >= ${start} AND "dueDate" <= ${now}
        AND status <> 'DONE'
      GROUP BY day
      ORDER BY day ASC
    `;
    const overdueMap = new Map<string, number>();
    overdueRows.forEach((r) => overdueMap.set(fmtDayLabel(new Date(r.day)), Number(r.count)));
    const overdueSeries: SparkPoint[] = points.map((p) => ({ x: p.x, y: overdueMap.get(p.x) || 0 }));

    // DueSoon series (próximos 3 días, como barra mini: 3 puntos)
    const dueSoonSeries: SparkPoint[] = [
      { x: 'Hoy', y: await prisma.task.count({ where: { companyId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { gte: todayStart, lt: tomorrowStart } } as any }) },
      { x: '+1', y: await prisma.task.count({ where: { companyId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { gte: tomorrowStart, lt: new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000) } } as any }) },
      { x: '+2', y: await prisma.task.count({ where: { companyId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { gte: new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000), lt: new Date(tomorrowStart.getTime() + 2 * 24 * 60 * 60 * 1000) } } as any }) },
    ];

    // Breakdown status/priority dentro del rango (por createdAt)
    const [statusRows, priorityRows] = await Promise.all([
      prisma.$queryRaw<Array<{ key: string; count: bigint }>>`
        SELECT status as key, COUNT(*)::bigint as count
        FROM "Task"
        WHERE "companyId" = ${companyId} AND "createdAt" >= ${start} AND "createdAt" <= ${now}
        GROUP BY status
      `,
      prisma.$queryRaw<Array<{ key: string; count: bigint }>>`
        SELECT priority as key, COUNT(*)::bigint as count
        FROM "Task"
        WHERE "companyId" = ${companyId} AND "createdAt" >= ${start} AND "createdAt" <= ${now}
        GROUP BY priority
      `,
    ]);

    const statusLabel = (s: string) => {
      switch (s) {
        case 'TODO':
          return 'Pendiente';
        case 'IN_PROGRESS':
          return 'En curso';
        case 'DONE':
          return 'Completada';
        case 'CANCELLED':
          return 'Cancelada';
        default:
          return s;
      }
    };
    const priorityLabel = (p: string) => {
      switch (p) {
        case 'LOW':
          return 'Baja';
        case 'MEDIUM':
          return 'Media';
        case 'HIGH':
          return 'Alta';
        case 'URGENT':
          return 'Urgente';
        default:
          return p;
      }
    };

    const byStatus = statusRows.map((r) => ({ name: statusLabel(r.key), value: Number(r.count) }));
    const byPriority = priorityRows.map((r) => ({ name: priorityLabel(r.key), value: Number(r.count) }));

    // Listas accionables (top 5)
    const [dueToday, overdue] = await Promise.all([
      prisma.task.findMany({
        where: { companyId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { gte: todayStart, lt: tomorrowStart } } as any,
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: { id: true, title: true, dueDate: true, priority: true, status: true },
      }),
      prisma.task.findMany({
        where: { companyId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: todayStart } } as any,
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: { id: true, title: true, dueDate: true, priority: true, status: true },
      }),
    ]);

    const dto: TasksDashboardDTO = {
      meta: { generatedAt: new Date().toISOString(), range },
      kpis: {
        pending: { value: pendingNow, deltaPct: deltaPct(pendingNow, pendingPrev), series: pendingSeries },
        completed: { value: completedInRange, deltaPct: deltaPct(completedInRange, completedPrev), series: completedSeries },
        overdue: { value: overdueNow, deltaPct: deltaPct(overdueNow, overduePrev), series: overdueSeries },
        dueSoon: { value: dueSoonNow, deltaPct: deltaPct(dueSoonNow, dueSoonPrev), series: dueSoonSeries },
      },
      charts: { createdVsCompleted: points, byStatus, byPriority },
      lists: {
        dueToday: dueToday.map((t) => ({
          id: String(t.id),
          title: t.title,
          dueDate: t.dueDate?.toISOString(),
          priority: String(t.priority),
          status: String(t.status),
        })),
        overdue: overdue.map((t) => ({
          id: String(t.id),
          title: t.title,
          dueDate: t.dueDate?.toISOString(),
          priority: String(t.priority),
          status: String(t.status),
        })),
      },
    };

    return NextResponse.json(dto, {
      headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}


