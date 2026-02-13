import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '30d' | '90d' | 'ytd';
type GroupBy = 'day' | 'week' | 'month';

export type DashboardSummary = {
  tasks?: {
    kpis: { myPending: number; dueToday: number; overdue: number; completed7d: number };
    trendPending: { x: string; y: number }[];
    byStatus: { status: string; count: number }[];
    myDay: { title: string; dueLabel: string; priority?: string }[];
  };
  costs?: {
    kpis: { monthCost: number; deltaPct: number; lastCalcHuman: string; topImpact: string };
    trend: { x: string; y: number }[];
    impactByCategory: { name: string; pct: number; value?: number }[];
  };
  purchases?: {
    kpis: { openOrders: number; pendingApprovals: number; monthSpend: number; activeSuppliers: number };
    byStatus: { status: string; count: number }[];
    topSuppliers: { name: string; value: number }[];
  };
  sales?: {
    kpis: { quotesOpen: number; revenueMonth: number; conversionPct: number };
    trendRevenue: { x: string; y: number }[];
    funnel: { stage: string; count: number }[];
  };
  system?: {
    kpis: { activeUsers: number; roles: number; permissions: number };
    activityTrend?: { x: string; y: number }[];
  };
  activity?: { label: string; whenHuman: string; type: 'user' | 'role' | 'perm' | 'other' }[];
  meta: {
    generatedAt: string;
    range: RangeKey;
    groupBy: GroupBy;
    // Capabilities derivadas EN SERVIDOR (seguras para usar en UI)
    permissions: string[];
  };
};

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserIdFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload.userId as number;
  } catch {
    return null;
  }
}

async function checkUserPermission(userId: number, userRole: string, companyId: number | null, permission: string): Promise<boolean> {
  try {
    if (userRole === 'SUPERADMIN') return true;
    if (!companyId) return false;

    const userPermission = await prisma.userPermission.findFirst({
      where: {
        userId,
        permission: { name: permission, isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (userPermission) return userPermission.isGranted;

    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role: { name: userRole, companyId },
        permission: { name: permission, isActive: true },
        isGranted: true,
      },
    });
    return !!rolePermission;
  } catch {
    return false;
  }
}

function parseRange(raw: string | null): RangeKey {
  switch ((raw || '').toLowerCase()) {
    case '30d':
      return '30d';
    case '90d':
      return '90d';
    case 'ytd':
      return 'ytd';
    default:
      return '7d';
  }
}

function computeGroupBy(range: RangeKey): GroupBy {
  if (range === '7d') return 'day';
  if (range === '30d') return 'day';
  if (range === '90d') return 'week';
  return 'month';
}

function seededInt(seed: number) {
  // xorshift32
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return Math.abs(x);
}

function makeTrend(seed: number, points: number, base: number, variance: number) {
  const out: { x: string; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const s = seededInt(seed + i * 97);
    const delta = (s % (variance * 2 + 1)) - variance;
    const y = Math.max(0, base + delta + Math.floor(i * 0.3));
    out.push({ x: String(i + 1), y });
  }
  return out;
}

function formatCurrencyARS(value: number) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `$${value}`;
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const range = parseRange(searchParams.get('range'));
    const groupBy = computeGroupBy(range);

    const companyIdParam = searchParams.get('companyId');
    let companyId: number | null = companyIdParam ? Number(companyIdParam) : null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        companies: {
          select: {
            company: { select: { id: true } },
            role: { select: { name: true } },
          },
        },
        ownedCompanies: { select: { id: true }, take: 1 },
      },
    });

    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    let userRole: string = user.role;
    if (!companyId) {
      if (user.ownedCompanies?.length) {
        companyId = user.ownedCompanies[0].id;
      } else if (user.companies?.length) {
        companyId = user.companies[0].company.id;
        if (user.companies[0].role) userRole = user.companies[0].role.name;
      }
    } else {
      const uc = user.companies.find((x) => x.company.id === companyId);
      if (uc?.role) userRole = uc.role.name;
    }

    // Gate principal: debe poder entrar al dashboard de administración
    const canEnterDashboard = await checkUserPermission(userId, userRole, companyId, 'ingresar_dashboard_administracion');
    if (!canEnterDashboard) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    // Permisos por módulo (server decides; frontend NO controla)
    const permAny = async (candidates: string[]) => {
      const results = await Promise.all(candidates.map((p) => checkUserPermission(userId, userRole, companyId, p)));
      return results.some(Boolean);
    };

    const [
      canTasks,
      canCosts,
      canPurchases,
      canAdminUsers,
      canAdminPerms,
      canAdminRoles,
      canAudit,
    ] = await Promise.all([
      permAny(['ingresar_tareas', 'tareas', 'tasks.view']),
      permAny(['costos', 'ingresar_costos', 'ingresar_administracion']),
      permAny(['ingresar_compras', 'compras', 'compras.view', 'ingresar_compras_modulo']),
      permAny(['gestionar_usuarios', 'users.view', 'ingresar_usuarios']),
      permAny(['ingresar_permisos', 'admin.permissions', 'ingresar_permisos_roles']),
      permAny(['admin.roles', 'roles', 'ingresar_roles']),
      permAny(['auditoria', 'auditoria.view', 'ingresar_auditoria']),
    ]);

    const serverCaps: string[] = [];
    if (canTasks) serverCaps.push('tasks:view');
    if (canCosts) serverCaps.push('costs:view');
    if (canPurchases) serverCaps.push('purchases:view');
    if (canAdminUsers) serverCaps.push('admin:users');
    if (canAdminPerms) serverCaps.push('admin:permissions');
    if (canAdminRoles) serverCaps.push('admin:roles');
    if (canAudit) serverCaps.push('audit:view');

    // Mock seguro (solo se incluye si el server habilitó)
    // TODO(db): reemplazar por queries agregadas reales por módulo.
    const seed = userId * 1000 + (companyId || 0);

    const summary: Omit<DashboardSummary, 'meta'> = {};

    if (canTasks) {
      const points = range === '7d' ? 14 : range === '30d' ? 30 : range === '90d' ? 13 : 12;
      summary.tasks = {
        kpis: {
          myPending: 12 + (seededInt(seed) % 6),
          dueToday: 3 + (seededInt(seed + 1) % 4),
          overdue: 1 + (seededInt(seed + 2) % 3),
          completed7d: 18 + (seededInt(seed + 3) % 10),
        },
        trendPending: makeTrend(seed + 10, points, 10, 4),
        byStatus: [
          { status: 'Pendiente', count: 12 },
          { status: 'En curso', count: 6 },
          { status: 'Completada', count: 18 },
        ],
        myDay: [
          { title: 'Aprobar horas', dueLabel: 'Hoy', priority: 'alta' },
          { title: 'Revisar legajo', dueLabel: 'Hoy', priority: 'media' },
          { title: 'Validar ausencias', dueLabel: 'Mañana', priority: 'media' },
          { title: 'Actualizar licencias', dueLabel: 'Esta semana', priority: 'baja' },
          { title: 'Cargar novedades', dueLabel: 'Esta semana', priority: 'baja' },
        ],
      };
    }

    if (canCosts) {
      const points = range === '7d' ? 14 : range === '30d' ? 30 : range === '90d' ? 13 : 12;
      const monthCost = 24_000_000 + (seededInt(seed + 20) % 7_000_000);
      summary.costs = {
        kpis: {
          monthCost,
          deltaPct: ((seededInt(seed + 21) % 21) - 10) / 100,
          lastCalcHuman: 'hace 2 días',
          topImpact: 'Mano de obra',
        },
        trend: makeTrend(seed + 22, points, Math.floor(monthCost / points / 1000), 40).map((p) => ({
          x: p.x,
          y: p.y * 1000,
        })),
        impactByCategory: [
          { name: 'Mano de obra', pct: 54, value: monthCost * 0.54 },
          { name: 'Energía', pct: 18, value: monthCost * 0.18 },
          { name: 'Materiales', pct: 16, value: monthCost * 0.16 },
          { name: 'Indirectos', pct: 12, value: monthCost * 0.12 },
        ],
      };
    }

    if (canPurchases) {
      const monthSpend = 8_000_000 + (seededInt(seed + 30) % 9_000_000);
      summary.purchases = {
        kpis: {
          openOrders: 9 + (seededInt(seed + 31) % 8),
          pendingApprovals: 4 + (seededInt(seed + 32) % 6),
          monthSpend,
          activeSuppliers: 28 + (seededInt(seed + 33) % 20),
        },
        byStatus: [
          { status: 'Abierta', count: 9 },
          { status: 'Aprobación', count: 4 },
          { status: 'Recibida', count: 6 },
          { status: 'Cerrada', count: 12 },
        ],
        topSuppliers: [
          { name: 'Proveedor A', value: Math.round(monthSpend * 0.22) },
          { name: 'Proveedor B', value: Math.round(monthSpend * 0.18) },
          { name: 'Proveedor C', value: Math.round(monthSpend * 0.14) },
          { name: 'Proveedor D', value: Math.round(monthSpend * 0.11) },
          { name: 'Otros', value: Math.round(monthSpend * 0.35) },
        ],
      };
    }

    if (canAdminUsers || canAdminPerms || canAdminRoles) {
      // TODO(db): reemplazar con métricas reales (users, roles, permissions) filtradas por companyId
      summary.system = {
        kpis: {
          activeUsers: 18 + (seededInt(seed + 40) % 14),
          roles: 6 + (seededInt(seed + 41) % 5),
          permissions: 90 + (seededInt(seed + 42) % 40),
        },
        activityTrend: makeTrend(seed + 43, range === '90d' ? 13 : 14, 12, 5),
      };
    }

    if (canAudit || canAdminUsers || canAdminPerms || canAdminRoles) {
      summary.activity = [
        { label: 'Cambio de permisos', whenHuman: 'hace 2h', type: 'perm' },
        { label: 'Usuario creado', whenHuman: 'hace 1d', type: 'user' },
        { label: 'Rol actualizado', whenHuman: 'hace 3d', type: 'role' },
        { label: 'Login detectado', whenHuman: 'hace 5d', type: 'other' },
      ];
    }

    const res: DashboardSummary = {
      ...summary,
      meta: {
        generatedAt: new Date().toISOString(),
        range,
        groupBy,
        permissions: serverCaps,
      },
    };

    // Debug header útil
    return NextResponse.json(res, {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate',
        'X-ORVIT-Range': range,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}


