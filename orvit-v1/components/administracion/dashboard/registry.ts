import type { DashboardSummary, RangeKey } from '@/hooks/useAdminDashboardSummary';

export type WidgetDef = {
  id: string;
  requiredAnyPermissions?: string[];
  requiredAllPermissions?: string[];
  // Tailwind col spans para grid de 12 columnas
  layout: { lg: string; md?: string; sm?: string };
  order: number;
  component: React.FC<{ data: DashboardSummary; range: RangeKey }>;
  // Si se define, también se requiere que exista la sección (respuesta del backend)
  requiresSection?: keyof DashboardSummary;
};

export function canSeeWidget(def: WidgetDef, perms: Set<string>, data: DashboardSummary): boolean {
  const all = def.requiredAllPermissions || [];
  const any = def.requiredAnyPermissions || [];

  if (def.requiresSection && data[def.requiresSection] === undefined) return false;
  if (all.length && !all.every((p) => perms.has(p))) return false;
  if (any.length && !any.some((p) => perms.has(p))) return false;
  return true;
}

// Widgets (visual)
import { KpiTasksCard } from './widgets/visual/KpiTasksCard';
import { KpiCostsCard } from './widgets/visual/KpiCostsCard';
import { KpiPurchasesCard } from './widgets/visual/KpiPurchasesCard';
import { KpiSystemCard } from './widgets/visual/KpiSystemCard';
import { PrimaryCharts } from './widgets/visual/PrimaryCharts';

export const WIDGETS_REGISTRY: WidgetDef[] = [
  // Row 1 KPI cards (layout se ajusta dinámicamente, pero dejamos defaults)
  {
    id: 'kpi.tasks',
    order: 10,
    layout: { lg: 'lg:col-span-3', md: 'md:col-span-6', sm: 'col-span-12' },
    requiredAnyPermissions: ['tasks:view'],
    requiresSection: 'tasks',
    component: KpiTasksCard,
  },
  {
    id: 'kpi.costs',
    order: 20,
    layout: { lg: 'lg:col-span-3', md: 'md:col-span-6', sm: 'col-span-12' },
    requiredAnyPermissions: ['costs:view'],
    requiresSection: 'costs',
    component: KpiCostsCard,
  },
  {
    id: 'kpi.purchases',
    order: 30,
    layout: { lg: 'lg:col-span-3', md: 'md:col-span-6', sm: 'col-span-12' },
    requiredAnyPermissions: ['purchases:view'],
    requiresSection: 'purchases',
    component: KpiPurchasesCard,
  },
  {
    id: 'kpi.system',
    order: 40,
    layout: { lg: 'lg:col-span-3', md: 'md:col-span-6', sm: 'col-span-12' },
    requiredAnyPermissions: ['admin:users', 'admin:permissions', 'admin:roles'],
    requiresSection: 'system',
    component: KpiSystemCard,
  },

  // Row 2: charts + actions
  {
    id: 'charts.primary',
    order: 100,
    layout: { lg: 'lg:col-span-8', md: 'md:col-span-12', sm: 'col-span-12' },
    component: PrimaryCharts,
  },

  // Row 3: eliminado (Mi día / Actividad) por pedido
];


