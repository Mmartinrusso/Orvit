import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight } from 'lucide-react';
import type { WidgetComponentProps } from '../../registry';

export function TasksTodayWidget({ data, isLoading }: WidgetComponentProps) {
  const today = (data?.today?.tasks as any) || null;
  const items: Array<{ id: string; title: string; due: string; priority: string }> = today?.upcoming || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Mi día</CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href="/administracion/agenda?tab=tareas">
              Ver todo <ArrowRight className="h-4 w-4 ml-1 opacity-70" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-[60%]" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay tareas próximas.</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <p className="text-sm truncate">{t.title}</p>
                <p className="text-xs text-muted-foreground shrink-0">{t.due}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}


