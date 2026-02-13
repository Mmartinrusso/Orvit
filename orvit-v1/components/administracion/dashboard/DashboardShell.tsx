'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { WIDGETS_REGISTRY, canSeeWidget } from './registry';
import { useAdminDashboardSummary, type RangeKey } from '@/hooks/useAdminDashboardSummary';
import { RefreshCcw } from 'lucide-react';

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '90d', label: 'Últimos 3 meses' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: 'ytd', label: 'YTD' },
];

function pickTitleFromData(data: { tasks?: unknown; costs?: unknown; purchases?: unknown; system?: unknown }) {
  if (data.system) return { title: 'Panel de Administración', subtitle: 'Métricas, tendencias y actividad según tus permisos.' };
  if (data.purchases) return { title: 'Panel de Compras', subtitle: 'Estados, gasto y acciones rápidas.' };
  if (data.costs) return { title: 'Panel de Costos', subtitle: 'Tendencias e impacto por categoría.' };
  if (data.tasks) return { title: 'Panel de Tareas', subtitle: 'Pendientes, estado y tu día.' };
  return { title: 'Panel', subtitle: 'Sin módulos habilitados.' };
}

export function DashboardShell() {
  const [range, setRange] = useState<RangeKey>('30d');
  const query = useAdminDashboardSummary(range);
  const data = query.data;

  const perms = useMemo(() => new Set(data?.meta?.permissions || []), [data?.meta?.permissions]);
  const { title, subtitle } = useMemo(() => pickTitleFromData(data || {}), [data]);

  const visibleWidgets = useMemo(() => {
    if (!data) return [];
    return WIDGETS_REGISTRY.filter((w) => canSeeWidget(w, perms, data)).sort((a, b) => a.order - b.order);
  }, [data, perms]);

  const kpiDefs = useMemo(() => visibleWidgets.filter((w) => w.id.startsWith('kpi.')), [visibleWidgets]);

  const kpiSpan = useMemo(() => {
    const count = kpiDefs.length;
    if (count <= 1) return 'col-span-12';
    if (count === 2) return 'col-span-12 md:col-span-6 lg:col-span-6';
    if (count === 3) return 'col-span-12 md:col-span-6 lg:col-span-4';
    return 'col-span-12 md:col-span-6 lg:col-span-3';
  }, [kpiDefs.length]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-start gap-4 justify-between">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h1>
            <div className="mt-1 flex flex-col gap-0.5">
              <p className="text-sm text-muted-foreground">{subtitle}</p>
              {data?.meta?.generatedAt && (
                <p className="text-xs text-muted-foreground">
                  Actualizado: {new Date(data.meta.generatedAt).toLocaleString('es-AR')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Segmented control */}
            <div
              role="group"
              className="flex items-center justify-center border border-border rounded-md p-0.5 bg-muted/40 gap-0 h-6"
            >
              {RANGE_OPTIONS.map((opt, idx) => {
                const active = range === opt.value;
                const isFirst = idx === 0;
                const isLast = idx === RANGE_OPTIONS.length - 1;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-state={active ? 'on' : 'off'}
                    onClick={() => setRange(opt.value)}
                    className={cn(
                      'inline-flex items-center justify-center ring-offset-background transition-colors',
                      'hover:bg-muted hover:text-muted-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      'disabled:pointer-events-none disabled:opacity-50',
                      'data-[state=on]:text-accent-foreground data-[state=on]:bg-background data-[state=on]:shadow-sm',
                      'gap-2 min-w-10 border-0 bg-transparent px-2 py-0.5 text-[11px] h-full font-normal',
                      isFirst ? 'rounded-l-md rounded-r-none' : isLast ? 'rounded-r-md rounded-l-none' : 'rounded-none'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className={cn(
                'inline-flex items-center justify-center border border-border rounded-md p-0.5 bg-muted/40 h-6',
                'px-2 text-[11px] font-normal gap-1.5',
                'hover:bg-muted hover:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-50',
                query.isFetching && 'bg-background shadow-sm text-accent-foreground'
              )}
              aria-label="Actualizar"
            >
              <RefreshCcw className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin')} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Loading skeleton inicial */}
      {query.isLoading && !data ? (
        <div className="px-4 md:px-6 pb-6 grid grid-cols-12 gap-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="col-span-12 md:col-span-6 lg:col-span-3">
              <Card>
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-40" />
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="px-4 md:px-6 pb-6 grid grid-cols-12 gap-4 md:gap-6 items-start">
          {/* KPI row */}
          {kpiDefs.map((w) => (
            <div key={w.id} className={kpiSpan}>
              {w.component({ data, range })}
            </div>
          ))}

          {/* Rest widgets */}
          {visibleWidgets
            .filter((w) => !w.id.startsWith('kpi.'))
            .map((w) => (
              <div key={w.id} className={cn(w.layout.sm || 'col-span-12', w.layout.md, w.layout.lg)}>
                {w.component({ data, range })}
              </div>
            ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay datos para mostrar.
          </CardContent>
        </Card>
      )}
    </div>
  );
}


