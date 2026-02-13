import { TrendingDown, TrendingUp } from 'lucide-react';
import type { DashboardSummary, RangeKey } from '@/hooks/useAdminDashboardSummary';
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
          <DeltaIcon className="h-3 w-3 mr-1" />
          {`${k.deltaPct >= 0 ? '+' : ''}${Math.round(k.deltaPct * 100)}%`}
        </KpiPill>
      }
    >
      <div className="text-3xl font-normal leading-none tabular-nums mb-0.5">{formatCurrencyARS(k.monthCost)}</div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5 leading-tight">
        <DeltaIcon className="h-3 w-3" />
        <span className="font-medium">Mayor impacto: {k.topImpact}</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-tight">Últ. calc: {k.lastCalcHuman}</p>
      <div className="mt-1.5">
        <Sparkline data={trend} />
      </div>
    </KpiCardFrame>
  );
}


