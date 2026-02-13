import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WidgetComponentProps } from '../../registry';

export function AdminActivityWidget({ data, isLoading }: WidgetComponentProps) {
  const admin = (data?.admin?.activity as any) || null;
  const items: Array<{ id: string; title: string; when: string }> = Array.isArray(admin) ? admin : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-[60%]" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad para mostrar.</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 5).map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3">
                <p className="text-sm truncate">{x.title}</p>
                <p className="text-xs text-muted-foreground shrink-0">{x.when}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}


