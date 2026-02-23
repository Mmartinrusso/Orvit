'use client';

import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Truck,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnidadMovil } from './UnitCard';
import { differenceInDays, isPast, isToday } from 'date-fns';

interface UnitsDashboardProps {
  unidades: UnidadMovil[];
  onFilterByStatus?: (status: string) => void;
  onFilterByUrgency?: (type: 'overdue' | 'upcoming' | 'withOTs') => void;
  className?: string;
}

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  progress?: { value: number; max: number };
  highlight?: boolean;
}

function KpiCard({ title, value, subtitle, icon, onClick, progress, highlight }: KpiCardProps) {
  return (
    <Card
      className={cn(
        'p-4 border transition-all duration-200 bg-card',
        onClick && 'cursor-pointer hover:shadow-md hover:border-primary/30',
        highlight && 'border-destructive/30'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
          <p className={cn(
            'text-2xl font-bold tabular-nums',
            highlight ? 'text-destructive' : 'text-foreground'
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
          {progress && (
            <div className="mt-2">
              <Progress value={(progress.value / progress.max) * 100} className="h-1.5" />
              <p className="text-xs text-muted-foreground mt-1">
                {progress.value} de {progress.max}
              </p>
            </div>
          )}
        </div>
        <div className={cn(
          'p-2.5 rounded-lg shrink-0',
          highlight ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
        )}>
          {icon}
        </div>
      </div>
      {onClick && (
        <div className="flex items-center justify-end mt-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            Ver detalle <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      )}
    </Card>
  );
}

export function UnitsDashboard({ unidades, onFilterByStatus, onFilterByUrgency, className }: UnitsDashboardProps) {
  const stats = useMemo(() => {
    const total = unidades.length;
    const active = unidades.filter(u => u.estado === 'ACTIVO').length;
    const inMaintenance = unidades.filter(u => u.estado === 'MANTENIMIENTO').length;
    const outOfService = unidades.filter(u => u.estado === 'FUERA_SERVICIO').length;
    const disabled = unidades.filter(u => u.estado === 'DESHABILITADO').length;

    // Units with open work orders
    const withOpenOTs = unidades.filter(u => (u.workOrdersCount || 0) > 0);
    const totalOpenOTs = withOpenOTs.reduce((sum, u) => sum + (u.workOrdersCount || 0), 0);

    // Maintenance analysis
    const now = new Date();
    const overdueMaintenance: UnidadMovil[] = [];
    const upcomingMaintenance: UnidadMovil[] = [];

    unidades.forEach(u => {
      if (!u.proximoMantenimiento) return;

      const nextDate = new Date(u.proximoMantenimiento);
      if (isPast(nextDate) && !isToday(nextDate)) {
        overdueMaintenance.push(u);
      } else if (differenceInDays(nextDate, now) <= 7) {
        upcomingMaintenance.push(u);
      }
    });

    // Availability rate
    const operationalTotal = total - disabled;
    const availabilityRate = operationalTotal > 0
      ? Math.round((active / operationalTotal) * 100)
      : 0;

    return {
      total,
      active,
      inMaintenance,
      outOfService,
      disabled,
      withOpenOTs,
      totalOpenOTs,
      overdueMaintenance,
      upcomingMaintenance,
      availabilityRate,
    };
  }, [unidades]);

  const hasOverdue = stats.overdueMaintenance.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          title="Total Unidades"
          value={stats.total}
          subtitle={`${stats.availabilityRate}% disponibilidad`}
          icon={<Truck className="h-5 w-5" />}
          progress={{ value: stats.active, max: stats.total - stats.disabled }}
        />

        <KpiCard
          title="Operativas"
          value={stats.active}
          subtitle="En funcionamiento"
          icon={<CheckCircle2 className="h-5 w-5" />}
          onClick={() => onFilterByStatus?.('ACTIVO')}
        />

        <KpiCard
          title="En Mantenimiento"
          value={stats.inMaintenance}
          subtitle="En reparación"
          icon={<Wrench className="h-5 w-5" />}
          onClick={() => onFilterByStatus?.('MANTENIMIENTO')}
        />

        <KpiCard
          title="Requieren Atención"
          value={stats.overdueMaintenance.length + stats.upcomingMaintenance.length}
          subtitle={`${stats.overdueMaintenance.length} vencidos, ${stats.upcomingMaintenance.length} próximos`}
          icon={<AlertTriangle className="h-5 w-5" />}
          highlight={hasOverdue}
          onClick={() => onFilterByUrgency?.('overdue')}
        />
      </div>

      {/* Alert Banner - solo si hay vencidos */}
      {hasOverdue && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
          onClick={() => onFilterByUrgency?.('overdue')}
        >
          <Clock className="h-3.5 w-3.5" />
          {stats.overdueMaintenance.length} {stats.overdueMaintenance.length === 1 ? 'unidad con' : 'unidades con'} mantenimiento vencido
          <ChevronRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default UnitsDashboard;
