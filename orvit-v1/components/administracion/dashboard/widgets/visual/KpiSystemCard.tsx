import { TrendingUp } from 'lucide-react';
import type { DashboardSummary, RangeKey } from '@/hooks/use-admin-dashboard-summary';
import { Sparkline } from '@/components/administracion/dashboard/charts/Sparkline';
import { KpiCardFrame, KpiPill } from './KpiCardFrame';

export function KpiSystemCard({ data }: { data: DashboardSummary; range: RangeKey }) {
  const k = data.system?.kpis;
  const trend = data.system?.activityTrend;
  if (!k) return null;

  return (
    <KpiCardFrame
      title="Sistema"
      pill={
        <KpiPill>
          <TrendingUp className="h-3 w-3 mr-1" />
          Activo
        </KpiPill>
      }
    >
      <div data-slot="kpi-value" className="text-3xl font-normal leading-none tabular-nums mb-0.5">{k.activeUsers}</div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5 leading-tight">
        <TrendingUp className="h-3 w-3" />
        <span className="font-medium">{k.roles} roles · {k.permissions} permisos</span>
      </div>
      <p className="text-xs text-muted-foreground leading-tight">Actividad reciente</p>
      <div className="mt-1.5">
        <Sparkline data={trend} />
      </div>
    </KpiCardFrame>
  );
}


