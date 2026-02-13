import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WidgetComponentProps } from '../../registry';

export function TasksKpisWidget({ data, isLoading }: WidgetComponentProps) {
  const tasks = (data?.kpis?.tasks as any) || null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Tareas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        ) : !tasks ? (
          <p className="text-sm text-muted-foreground">Sin datos para tareas.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Mis pendientes</p>
              <p className="text-2xl font-semibold">{tasks.myPending}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencen hoy</p>
              <p className="text-2xl font-semibold">{tasks.dueToday}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atrasadas</p>
              <p className="text-2xl font-semibold">{tasks.overdue}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completadas (7d)</p>
              <p className="text-2xl font-semibold">{tasks.completed7d}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


