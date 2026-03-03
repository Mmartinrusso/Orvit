import { TrendingDown, TrendingUp } from 'lucide-react';
import type { DashboardSummary, RangeKey } from '@/hooks/use-admin-dashboard-summary';
import { Sparkline } from '@/components/administracion/dashboard/charts/Sparkline';
import { KpiCardFrame, KpiPill } from './KpiCardFrame';

function formatCurrencyARS(value: number) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `$${value}`;
  }
}

export function KpiCostsCard({ data }: { data: DashboardSummary; range: RangeKey }) {
  const k = data.costs?.kpis;
  const trend = data.costs?.trend;
  if (!k) return null;

  const isUp = k.deltaPct >= 0;
  const DeltaIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <KpiCardFrame
      title="Costos"
      pill={
        <KpiPill>
          <DeltaIcon className="h-3 w-3" />
          {`${k.deltaPct >= 0 ? '+' : ''}${Math.round(k.deltaPct * 100)}%`}
        </KpiPill>
      }
    >
      <p style={{ fontSize: '28px', fontWeight: 700, color: '#111827', lineHeight: 1, margin: '0 0 8px' }}>
        {formatCurrencyARS(k.monthCost)}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <DeltaIcon style={{ width: 12, height: 12, color: '#9CA3AF', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280' }}>Mayor impacto: {k.topImpact}</span>
      </div>
      <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 10px' }}>Últ. calc: {k.lastCalcHuman}</p>
      <Sparkline data={trend} />
    </KpiCardFrame>
  );
}


