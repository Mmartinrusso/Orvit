import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AreaTrend } from '@/components/administracion/dashboard/charts/AreaTrend';
import { BarBreakdown } from '@/components/administracion/dashboard/charts/BarBreakdown';
import { PieBreakdown } from '@/components/administracion/dashboard/charts/PieBreakdown';
import type { DashboardSummary, RangeKey } from '@/hooks/use-admin-dashboard-summary';

function formatCurrencyARS(value: number) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `$${value}`;
  }
}

export function PrimaryCharts({ data }: { data: DashboardSummary; range: RangeKey }) {
  // Prioridad: costos > ventas (future) > compras > tareas > sistema
  if (data.costs) {
    const trend = data.costs.trend;
    const byCat = (data.costs.impactByCategory || []).map((x) => ({ name: x.name, pct: x.pct }));
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tendencia de costos</CardTitle>
          <CardDescription className="text-xs">Serie principal + impacto por categoría.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AreaTrend data={trend} height={260} valueFormatter={formatCurrencyARS} />
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Top impacto por categoría</p>
              <BarBreakdown data={byCat} height={220} xKey="name" yKey="pct" valueFormatter={(v) => `${v}%`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Breakdown</p>
              <PieBreakdown
                data={byCat.map((x) => ({ name: x.name, value: x.pct }))}
                height={220}
                valueFormatter={(v) => `${v}%`}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.purchases) {
    const byStatus = data.purchases.byStatus.map((x) => ({ status: x.status, count: x.count }));
    const top = data.purchases.topSuppliers.map((x) => ({ name: x.name, value: x.value }));
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Compras</CardTitle>
          <CardDescription className="text-xs">Estados y top proveedores por gasto.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Órdenes por estado</p>
            <BarBreakdown data={byStatus} height={260} xKey="status" yKey="count" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Top proveedores</p>
            <PieBreakdown data={top} height={260} valueFormatter={formatCurrencyARS} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.tasks) {
    const byStatus = data.tasks.byStatus.map((x) => ({ status: x.status, count: x.count }));
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tareas</CardTitle>
          <CardDescription className="text-xs">Distribución por estado.</CardDescription>
        </CardHeader>
        <CardContent>
          <BarBreakdown data={byStatus} height={260} xKey="status" yKey="count" />
        </CardContent>
      </Card>
    );
  }

  if (data.system) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Sistema</CardTitle>
          <CardDescription className="text-xs">Actividad (si disponible).</CardDescription>
        </CardHeader>
        <CardContent>
          <AreaTrend data={data.system.activityTrend} height={260} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Dashboard</CardTitle>
        <CardDescription className="text-xs">Sin módulos habilitados.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">No hay datos para mostrar.</CardContent>
    </Card>
  );
}


