import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight } from 'lucide-react';
import type { WidgetComponentProps } from '../../registry';

function formatCurrencyARS(value: number) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `$${value}`;
  }
}

export function PurchasesTodayWidget({ data, isLoading }: WidgetComponentProps) {
  const purchases = (data?.today?.purchases as any) || null;
  const dueTop: Array<{ id: string; title: string; due: string; amount: number }> = purchases?.dueTop || [];
  const approvalsTop: Array<{ id: string; title: string; status: string }> = purchases?.approvalsTop || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Pendientes de Compras</CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href="/administracion/compras">
              Ver módulo <ArrowRight className="h-4 w-4 ml-1 opacity-70" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Por vencer</p>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-[55%]" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : dueTop.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin vencimientos cercanos.</p>
          ) : (
            <ul className="space-y-2">
              {dueTop.slice(0, 5).map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3">
                  <p className="text-sm truncate">{x.title}</p>
                  <p className="text-xs text-muted-foreground shrink-0">{formatCurrencyARS(x.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Aprobaciones</p>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-[55%]" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : approvalsTop.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin aprobaciones pendientes.</p>
          ) : (
            <ul className="space-y-2">
              {approvalsTop.slice(0, 5).map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3">
                  <p className="text-sm truncate">{x.title}</p>
                  <p className="text-xs text-muted-foreground shrink-0">{x.status}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


