import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WidgetComponentProps } from '../../registry';

export function CostsCategoryBarsWidget({ data, isLoading }: WidgetComponentProps) {
  const insight = (data?.insights?.costs as any) || null;
  const rows: Array<{ label: string; value: number }> = insight?.byCategory || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Impacto por categoría</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos para mostrar.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.value}%</p>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, r.value))}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


