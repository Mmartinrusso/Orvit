import { TrendingDown, TrendingUp } from 'lucide-react';
import type { DashboardSummary, RangeKey } from '@/hooks/useAdminDashboardSummary';
import { Sparkline } from '@/components/administracion/dashboard/charts/Sparkline';
import { KpiCardFrame, KpiPill } from './KpiCardFrame';

function pctDelta(series?: Array<{ x: string; y: number }>): number | null {
  if (!series || series.length < 2) return null;
  const first = series[0]?.y ?? 0;
  const last = series[series.length - 1]?.y ?? 0;
  const base = Math.max(1, Math.abs(first));
  return (last - first) / base;
}

export function KpiTasksCard({ data }: { data: DashboardSummary; range: RangeKey }) {
  const k = data.tasks?.kpis;
  const trend = data.tasks?.trendPending;

  if (!k) return null;

  const d = pctDelta(trend);
  const isUp = (d ?? 0) >= 0;
  const DeltaIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <KpiCardFrame
      title="Tareas"
      pill={
        <KpiPill>
          <DeltaIcon className="h-3 w-3 mr-1" />
          {d === null ? '—' : `${d >= 0 ? '+' : ''}${Math.round(d * 100)}%`}
        </KpiPill>
      }
    >
      <div className="text-3xl font-normal leading-none tabular-nums mb-0.5">{k.myPending}</div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5 leading-tight">
        <DeltaIcon className="h-3 w-3" />
        <span className="font-medium">Pendientes en el rango seleccionado</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-tight">
        Hoy {k.dueToday} · Atrasadas {k.overdue} · Completadas (7d) {k.completed7d}
      </p>
      <div className="mt-1.5">
        <Sparkline data={trend} />
      </div>
    </KpiCardFrame>
  );
}


