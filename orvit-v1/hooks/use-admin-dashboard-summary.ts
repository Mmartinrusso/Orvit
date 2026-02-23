import { useQuery } from '@tanstack/react-query';

export type RangeKey = '7d' | '30d' | '90d' | 'ytd';

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
    groupBy: 'day' | 'week' | 'month';
    permissions: string[];
  };
};

async function fetchSummary(range: RangeKey): Promise<DashboardSummary> {
  const qs = new URLSearchParams();
  qs.set('range', range);
  const res = await fetch(`/api/administracion/dashboard/summary?${qs.toString()}`);
  if (!res.ok) throw new Error('No se pudo cargar el dashboard');
  return res.json();
}

export function useAdminDashboardSummary(range: RangeKey) {
  return useQuery({
    queryKey: ['admin-dashboard-summary', range],
    queryFn: () => fetchSummary(range),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
}


