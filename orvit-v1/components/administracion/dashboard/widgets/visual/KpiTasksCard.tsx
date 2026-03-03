import { TrendingDown, TrendingUp } from 'lucide-react';
import type { DashboardSummary, RangeKey } from '@/hooks/use-admin-dashboard-summary';
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
          <DeltaIcon className="h-3 w-3" />
          {d === null ? '—' : `${d >= 0 ? '+' : ''}${Math.round(d * 100)}%`}
        </KpiPill>
      }
    >
      <p style={{ fontSize: '32px', fontWeight: 700, color: '#111827', lineHeight: 1, margin: '0 0 8px' }}>
        {k.myPending}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <DeltaIcon style={{ width: 12, height: 12, color: '#9CA3AF', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280' }}>Pendientes en el rango</span>
      </div>
      <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 10px' }}>
        Hoy {k.dueToday} · Atrasadas {k.overdue} · Completadas 7d: {k.completed7d}
      </p>
      <Sparkline data={trend} />
    </KpiCardFrame>
  );
}


