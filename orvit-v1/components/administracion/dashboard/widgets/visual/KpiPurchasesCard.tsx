import { TrendingUp } from 'lucide-react';
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
      <p style={{ fontSize: '32px', fontWeight: 700, color: '#111827', lineHeight: 1, margin: '0 0 8px' }}>
        {k.openOrders}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <TrendingUp style={{ width: 12, height: 12, color: '#9CA3AF', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280' }}>{k.pendingApprovals} aprobaciones pendientes</span>
      </div>
      <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 10px' }}>
        Gasto mes: {formatCurrencyARS(k.monthSpend)} · Proveedores: {k.activeSuppliers}
      </p>
      <Sparkline data={fauxTrend} />
    </KpiCardFrame>
  );
}


