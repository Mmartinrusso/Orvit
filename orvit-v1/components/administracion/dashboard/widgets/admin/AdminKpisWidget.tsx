import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WidgetComponentProps } from '../../registry';

export function AdminKpisWidget({ data, isLoading }: WidgetComponentProps) {
  const admin = (data?.kpis?.admin as any) || null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        ) : !admin ? (
          <p className="text-sm text-muted-foreground">Sin datos del sistema.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Usuarios activos</p>
              <p data-slot="kpi-value" className="text-2xl font-semibold">{admin.activeUsers}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Roles</p>
              <p data-slot="kpi-value" className="text-2xl font-semibold">{admin.roles}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Permisos</p>
              <p data-slot="kpi-value" className="text-2xl font-semibold">{admin.permissions}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


