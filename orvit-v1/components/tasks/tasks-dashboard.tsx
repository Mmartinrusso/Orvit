/* eslint-disable @next/next/no-img-element */
'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Plus, TrendingDown, TrendingUp, Minus, ArrowRight } from 'lucide-react';
import { Sparkline } from '@/components/administracion/dashboard/charts/Sparkline';
import { useTasksDashboard, type TasksRangeKey } from '@/hooks/tasks/useTasksDashboard';

function formatPct(p: number | null) {
  if (p === null) return '—';
  const v = Math.round(p * 100);
  return `${v >= 0 ? '+' : ''}${v}%`;
}

function formatAbsoluteChange(deltaPct: number | null, currentValue: number) {
  if (deltaPct === null || deltaPct === 0) return null;
  const previousValue = currentValue / (1 + deltaPct);
  const absoluteChange = Math.round(currentValue - previousValue);
  return absoluteChange;
}

type KpiType = 'pending' | 'completed' | 'overdue' | 'dueSoon';

function KpiCard({
  title,
  value,
  deltaPct,
  series,
  subtitle,
  type,
  onClick,
}: {
  title: string;
  value: number;
  deltaPct: number | null;
  series: Array<{ x: string; y: number }>;
  subtitle: string;
  type: KpiType;
  onClick?: () => void;
}) {
  const up = (deltaPct ?? 0) > 0;
  const down = (deltaPct ?? 0) < 0;
  const neutral = deltaPct === null || deltaPct === 0;

  const Icon = neutral ? Minus : up ? TrendingUp : TrendingDown;

  // Determinar si el cambio es positivo o negativo basado en el tipo de KPI
  // Para 'completed': subir es bueno (verde), bajar es malo (rojo)
  // Para 'pending', 'overdue', 'dueSoon': subir es malo (rojo), bajar es bueno (verde)
  const isPositiveMetric = type === 'completed';
  const isGood = isPositiveMetric ? up : down;
  const isBad = isPositiveMetric ? down : up;

  const absoluteChange = formatAbsoluteChange(deltaPct, value);

  const badgeColorClass = cn(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold text-xs transition-colors',
    {
      'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400': isGood,
      'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400': isBad,
      'bg-muted border-border text-muted-foreground': neutral,
    }
  );

  const lastDataPoint = series.length > 0 ? series[series.length - 1] : null;

  return (
    <TooltipProvider>
      <Card
        className={cn(
          "h-full rounded-lg border border-gray-300/90 shadow-sm bg-gradient-to-t from-black/5 via-gray-100/50 to-white dark:border-gray-600/90 dark:from-black/10 dark:via-gray-800/50 dark:to-gray-900",
          onClick && "cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
        )}
        onClick={onClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-1.5 px-4">
          <div className="text-muted-foreground text-xs font-normal flex items-center gap-1">
            {title}
            {onClick && <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={badgeColorClass}>
                <Icon className="h-3 w-3 mr-1" />
                {formatPct(deltaPct)}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <div className="text-xs">
                <p className="font-medium mb-1">Cambio vs periodo anterior</p>
                {absoluteChange !== null && (
                  <p>{absoluteChange > 0 ? '+' : ''}{absoluteChange} tareas</p>
                )}
                {neutral && <p>Sin cambios</p>}
              </div>
            </TooltipContent>
          </Tooltip>
        </CardHeader>
        <CardContent className="px-4 pb-1.5 pt-0">
          <div className="text-3xl font-normal leading-none tabular-nums mb-0.5">{value}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5 leading-tight">
            <Icon className={cn("h-3 w-3", { 'text-green-600': isGood, 'text-red-600': isBad })} />
            <span className="font-medium">{subtitle}</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-1.5 cursor-help">
                <Sparkline data={series} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[180px]">
              <div className="text-xs">
                <p className="font-medium mb-1">Tendencia del periodo</p>
                {lastDataPoint && (
                  <p>Último valor: {lastDataPoint.y}</p>
                )}
                <p className="text-muted-foreground">{series.length} puntos de datos</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

interface TasksDashboardProps {
  onNewTask: () => void;
  onFilterByStatus?: (status: string) => void;
}

export function TasksDashboard({ onNewTask, onFilterByStatus }: TasksDashboardProps) {
  const [range, setRange] = useState<TasksRangeKey>('30d');
  const q = useTasksDashboard(range);
  const data = q.data;

  const rangeOptions: Array<{ value: TasksRangeKey; label: string }> = useMemo(
    () => [
      { value: '7d', label: 'Últimos 7 días' },
      { value: '30d', label: 'Últimos 30 días' },
      { value: '90d', label: 'Últimos 3 meses' },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Header dashboard */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Resumen y análisis de tareas según el rango.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div role="group" className="flex items-center justify-center border border-border rounded-md p-0.5 bg-muted/40 gap-0 h-9">
            {rangeOptions.map((opt) => {
              const active = range === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-state={active ? 'on' : 'off'}
                  onClick={() => setRange(opt.value)}
                  className={cn(
                    'inline-flex items-center justify-center ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'disabled:pointer-events-none disabled:opacity-50',
                    'data-[state=on]:text-accent-foreground data-[state=on]:bg-background data-[state=on]:shadow-sm',
                    'px-3 py-1 text-[11px] font-normal h-8'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <Button onClick={onNewTask} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {q.isLoading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-full">
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          <KpiCard
            title="Pendientes"
            value={data.kpis.pending.value}
            deltaPct={data.kpis.pending.deltaPct}
            series={data.kpis.pending.series}
            subtitle="Pendientes (aprox.)"
            type="pending"
            onClick={onFilterByStatus ? () => onFilterByStatus('pendiente') : undefined}
          />
          <KpiCard
            title="Completadas"
            value={data.kpis.completed.value}
            deltaPct={data.kpis.completed.deltaPct}
            series={data.kpis.completed.series}
            subtitle="Completadas en el rango"
            type="completed"
            onClick={onFilterByStatus ? () => onFilterByStatus('realizada') : undefined}
          />
          <KpiCard
            title="Atrasadas"
            value={data.kpis.overdue.value}
            deltaPct={data.kpis.overdue.deltaPct}
            series={data.kpis.overdue.series}
            subtitle="Vencimientos dentro del rango"
            type="overdue"
            onClick={onFilterByStatus ? () => onFilterByStatus('atrasadas') : undefined}
          />
          <KpiCard
            title="Vencen pronto"
            value={data.kpis.dueSoon.value}
            deltaPct={data.kpis.dueSoon.deltaPct}
            series={data.kpis.dueSoon.series}
            subtitle="Próximos 3 días"
            type="dueSoon"
            onClick={onFilterByStatus ? () => onFilterByStatus('prox-7d') : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}


