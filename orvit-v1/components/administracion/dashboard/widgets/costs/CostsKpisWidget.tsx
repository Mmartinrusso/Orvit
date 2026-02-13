import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WidgetComponentProps } from '../../registry';

function formatCurrencyARS(value: number) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `$${value}`;
  }
}

export function CostsKpisWidget({ data, isLoading }: WidgetComponentProps) {
  const costs = (data?.kpis?.costs as any) || null;
  const delta = typeof costs?.deltaVsPrev === 'number' ? costs.deltaVsPrev : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Costos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : !costs ? (
          <p className="text-sm text-muted-foreground">Sin datos de costos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Costo mes</p>
              <p className="text-2xl font-semibold">{formatCurrencyARS(costs.monthCost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Δ vs mes anterior</p>
              <p className="text-2xl font-semibold">
                {delta === null ? '—' : `${Math.round(delta * 100)}%`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Último cálculo</p>
              <p className="text-2xl font-semibold">{costs.lastCalc}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mayor impacto</p>
              <p className="text-2xl font-semibold truncate">{costs.biggestDriver}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


