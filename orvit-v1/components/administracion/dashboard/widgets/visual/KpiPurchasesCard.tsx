import { TrendingUp } from 'lucide-react';
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

export function KpiPurchasesCard({ data }: { data: DashboardSummary; range: RangeKey }) {
  const k = data.purchases?.kpis;
  if (!k) return null;

  // Placeholder visual para mantener consistencia hasta tener serie temporal real en el backend
  const fauxTrend = [
    { x: '1', y: Math.max(0, k.openOrders - 3) },
    { x: '2', y: Math.max(0, k.openOrders - 1) },
    { x: '3', y: k.openOrders },
  ];

  return (
    <KpiCardFrame
      title="Compras"
      pill={
        <KpiPill>
          <TrendingUp className="h-3 w-3 mr-1" />
          Mes
        </KpiPill>
      }
    >
      <div className="text-3xl font-normal leading-none tabular-nums mb-0.5">{k.openOrders}</div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5 leading-tight">
        <TrendingUp className="h-3 w-3" />
        <span className="font-medium">{k.pendingApprovals} aprobaciones pendientes</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-tight">
        Gasto mes: {formatCurrencyARS(k.monthSpend)} · Proveedores activos: {k.activeSuppliers}
      </p>
      <div className="mt-1.5">
        <Sparkline data={fauxTrend} />
      </div>
    </KpiCardFrame>
  );
}


