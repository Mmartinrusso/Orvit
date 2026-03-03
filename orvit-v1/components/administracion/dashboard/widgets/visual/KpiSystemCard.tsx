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
      <p style={{ fontSize: '32px', fontWeight: 700, color: '#111827', lineHeight: 1, margin: '0 0 8px' }}>
        {k.activeUsers}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <TrendingUp style={{ width: 12, height: 12, color: '#9CA3AF', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280' }}>{k.roles} roles · {k.permissions} permisos</span>
      </div>
      <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 10px' }}>Actividad reciente</p>
      <Sparkline data={trend} />
    </KpiCardFrame>
  );
}


