'use client';

import React from 'react';
import { ClipboardList, TrendingUp, Activity, Shield, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { OperatorHero } from '../hero/OperatorHero';
import { DashboardSection } from './DashboardSection';
import { DashboardCard } from './DashboardCard';
import { DonutChart } from '../charts/DonutChart';
import { BarChart } from '../charts/BarChart';
import { PieChart } from '../charts/PieChart';
import { AreaChart } from '../charts/AreaChart';
import { GaugeChart } from '../charts/GaugeChart';
import { ProgressBar } from '../charts/ProgressBar';
import { useOperatorDashboardData } from '@/hooks/mantenimiento/useOperatorDashboardData';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface OperatorDashboardProps {
  companyId: number;
  sectorId?: number | null;
  userId: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'hsl(var(--warning))',
  SCHEDULED: 'hsl(var(--chart-2))',
  INCOMING: 'hsl(var(--chart-4))',
  IN_PROGRESS: 'hsl(var(--info))',
  WAITING: 'hsl(var(--chart-3))',
  COMPLETED: 'hsl(var(--success))',
  CANCELLED: 'hsl(var(--muted-foreground))',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  SCHEDULED: 'Programada',
  INCOMING: 'Ingresada',
  IN_PROGRESS: 'En Progreso',
  WAITING: 'En Espera',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'hsl(var(--destructive))',
  HIGH: 'hsl(var(--warning))',
  MEDIUM: 'hsl(var(--chart-2))',
  LOW: 'hsl(var(--success))',
  EMERGENCY: 'hsl(var(--chart-5))',
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
  EMERGENCY: 'Emergencia',
};

function formatMonth(monthStr: string) {
  const [, m] = monthStr.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months[parseInt(m) - 1] || monthStr;
}

export function OperatorDashboard({ companyId, sectorId, userId }: OperatorDashboardProps) {
  const { kpis, workOrders, controls } = useOperatorDashboardData(companyId, sectorId, userId);

  // Transform data for charts
  const statusData = React.useMemo(() => {
    if (!workOrders.data?.stats?.byType) return [];
    const byType = workOrders.data.stats.byType as Record<string, number>;
    // byType uses status names as keys
    return Object.entries(byType)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        label: STATUS_LABELS[key] || key,
        value,
        color: STATUS_COLORS[key],
      }));
  }, [workOrders.data]);

  const statusDonutData = React.useMemo(() => {
    const stats = workOrders.data?.stats;
    if (!stats) return [];
    return [
      { label: 'Pendientes', value: stats.pending || 0, color: 'hsl(var(--warning))' },
      { label: 'En Progreso', value: stats.inProgress || 0, color: 'hsl(var(--info))' },
      { label: 'Completadas', value: stats.completed || 0, color: 'hsl(var(--success))' },
      { label: 'Vencidas', value: stats.overdue || 0, color: 'hsl(var(--destructive))' },
    ].filter(d => d.value > 0);
  }, [workOrders.data]);

  const priorityData = React.useMemo(() => {
    if (!workOrders.data?.stats?.byPriority) return [];
    const byPriority = workOrders.data.stats.byPriority as Record<string, number>;
    return Object.entries(byPriority)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        label: PRIORITY_LABELS[key] || key,
        value,
        color: PRIORITY_COLORS[key],
      }))
      .sort((a, b) => b.value - a.value);
  }, [workOrders.data]);

  const preventiveVsCorrectiveData = React.useMemo(() => {
    const pvc = kpis.data?.preventiveVsCorrective;
    if (!pvc) return [];
    return [
      { label: 'Preventivo', value: pvc.preventive || 0, color: 'hsl(var(--success))' },
      { label: 'Correctivo', value: pvc.corrective || 0, color: 'hsl(var(--warning))' },
    ].filter(d => d.value > 0);
  }, [kpis.data]);

  const monthlyTrendData = React.useMemo(() => {
    const trend = kpis.data?.trends?.monthlyCompletion;
    if (!trend || !Array.isArray(trend)) return [];
    return trend.map((t: { month: string; completed: number }) => ({
      label: formatMonth(t.month),
      value: t.completed,
    }));
  }, [kpis.data]);

  const failureFreqData = React.useMemo(() => {
    const freq = kpis.data?.trends?.failureFrequency;
    if (!freq || !Array.isArray(freq)) return [];
    return freq.slice(0, 5).map((f: { machineName: string; failureCount: number }) => ({
      label: f.machineName?.length > 12 ? f.machineName.substring(0, 12) + '...' : f.machineName,
      value: f.failureCount,
    }));
  }, [kpis.data]);

  const pendingOTs = workOrders.data?.pending?.slice(0, 5) || [];
  const overdueOTs = workOrders.data?.overdue?.slice(0, 5) || [];
  const controlsList = controls.data?.controls?.slice(0, 5) || [];

  const complianceRate = kpis.data?.preventiveCompliance?.complianceRate ?? 0;
  const completionRate = kpis.data?.completionRate ?? 0;
  const costEfficiency = kpis.data?.costEfficiency ?? 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Section */}
      <OperatorHero companyId={companyId} sectorId={sectorId} userId={userId} />

      {/* Section: Mis Órdenes */}
      <DashboardSection title="Mis Órdenes de Trabajo" icon={ClipboardList} subtitle={`${workOrders.data?.stats?.total || 0} total este mes`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardCard title="Por Estado" info="Distribución de tus órdenes de trabajo según su estado actual: cuántas están pendientes, en ejecución, completadas o vencidas." isLoading={workOrders.isLoading}>
            {statusDonutData.length > 0 ? (
              <DonutChart data={statusDonutData} size={110} showTotal showLegend totalLabel="OTs" />
            ) : (
              <EmptyState text="Sin órdenes" />
            )}
          </DashboardCard>
          <DashboardCard title="Por Prioridad" info="Cuántas órdenes de trabajo tenés asignadas por nivel de urgencia. Las críticas y de emergencia requieren atención inmediata." isLoading={workOrders.isLoading}>
            {priorityData.length > 0 ? (
              <BarChart data={priorityData} horizontal height={160} showValues />
            ) : (
              <EmptyState text="Sin datos" />
            )}
          </DashboardCard>
          <DashboardCard title="Preventivo vs Correctivo" info="Proporción de mantenimientos planificados (preventivo) versus los que surgieron por fallas o averías (correctivo). Más preventivo = operación más sana." isLoading={kpis.isLoading}>
            {preventiveVsCorrectiveData.length > 0 ? (
              <PieChart data={preventiveVsCorrectiveData} size={130} showPercentages showLegend />
            ) : (
              <EmptyState text="Sin datos" />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Section: Tendencias */}
      <DashboardSection title="Tendencias" icon={TrendingUp} subtitle="Últimos 6 meses">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DashboardCard title="Completitud Mensual" info="Cantidad de órdenes de trabajo completadas por mes en los últimos 6 meses. Una tendencia creciente indica buena productividad." isLoading={kpis.isLoading} className="lg:col-span-2">
            {monthlyTrendData.length > 0 ? (
              <AreaChart data={monthlyTrendData} height={180} color="hsl(var(--success))" showLabels showGrid />
            ) : (
              <EmptyState text="Sin datos de tendencia" />
            )}
          </DashboardCard>
          <DashboardCard title="Top Fallas por Máquina" info="Las máquinas con más órdenes correctivas en los últimos 3 meses. Son las que más atención necesitan o podrían requerir un plan de mantenimiento especial." isLoading={kpis.isLoading}>
            {failureFreqData.length > 0 ? (
              <BarChart data={failureFreqData} height={180} showValues showLabels colors={['hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']} />
            ) : (
              <EmptyState text="Sin fallas registradas" />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Section: Mi Actividad */}
      <DashboardSection title="Mi Actividad" icon={Activity}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardCard title="OTs Pendientes / Vencidas" info="Tus órdenes de trabajo que están esperando ser atendidas o que ya superaron su fecha límite. Las vencidas (en rojo) son las más urgentes." isLoading={workOrders.isLoading} contentHeight="min-h-[180px]">
            {pendingOTs.length > 0 || overdueOTs.length > 0 ? (
              <div className="space-y-2">
                {overdueOTs.map((ot: any) => (
                  <OTListItem key={ot.id} ot={ot} isOverdue />
                ))}
                {pendingOTs.map((ot: any) => (
                  <OTListItem key={ot.id} ot={ot} />
                ))}
              </div>
            ) : (
              <EmptyState text="Sin OTs pendientes" icon={<CheckCircle className="h-5 w-5 text-success" />} />
            )}
          </DashboardCard>
          <DashboardCard title="Controles de Seguimiento" info="Controles periódicos que debés completar para verificar que las soluciones aplicadas a fallas anteriores siguen funcionando correctamente." isLoading={controls.isLoading} contentHeight="min-h-[180px]">
            {controlsList.length > 0 ? (
              <div className="space-y-2">
                {controlsList.map((ctrl: any, i: number) => (
                  <ControlListItem key={ctrl.id || i} control={ctrl} />
                ))}
              </div>
            ) : (
              <EmptyState text="Sin controles pendientes" icon={<CheckCircle className="h-5 w-5 text-success" />} />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Section: Cumplimiento */}
      <DashboardSection title="Cumplimiento" icon={Shield}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DashboardCard title="Cumplimiento Preventivo" info="Porcentaje de mantenimientos preventivos completados a tiempo sobre el total programado. 80%+ es excelente, por debajo del 50% indica problemas de planificación." isLoading={kpis.isLoading}>
            <div className="flex flex-col items-center justify-center py-2">
              <GaugeChart value={complianceRate} size={110} thickness={10} label="Preventivo" unit="%" />
            </div>
          </DashboardCard>
          <DashboardCard title="Tasa de Completitud" info="Porcentaje de órdenes de trabajo completadas sobre el total generado en el período. Refleja la capacidad del equipo de cerrar tareas." isLoading={kpis.isLoading}>
            <div className="flex flex-col items-center justify-center py-2">
              <GaugeChart value={completionRate} size={110} thickness={10} label="Completitud" unit="%" />
            </div>
          </DashboardCard>
          <DashboardCard title="Eficiencia de Costos" info="Relación entre el costo estimado y el costo real de las órdenes. Valores altos indican que las estimaciones son precisas y los trabajos se ejecutan dentro del presupuesto." isLoading={kpis.isLoading}>
            <div className="flex flex-col items-center justify-center py-2">
              <GaugeChart
                value={Math.min(costEfficiency, 100)}
                size={110}
                thickness={10}
                label="Eficiencia"
                unit="%"
                thresholds={[
                  { value: 50, color: 'hsl(var(--destructive))' },
                  { value: 80, color: 'hsl(var(--warning))' },
                  { value: 100, color: 'hsl(var(--success))' },
                ]}
              />
            </div>
          </DashboardCard>
        </div>
      </DashboardSection>
    </div>
  );
}

// --- Helper components ---

function EmptyState({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-6 text-center">
      {icon || <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mb-1"><Activity className="h-4 w-4 text-muted-foreground" /></div>}
      <p className="text-xs text-muted-foreground mt-1">{text}</p>
    </div>
  );
}

function OTListItem({ ot, isOverdue }: { ot: any; isOverdue?: boolean }) {
  return (
    <div className={cn(
      'flex items-center justify-between py-1.5 px-2 rounded-md text-xs',
      isOverdue ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted/50'
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {isOverdue && <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />}
        <span className="font-medium truncate">{ot.title || `OT-${ot.id}`}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {ot.machine?.name && (
          <span className="text-muted-foreground truncate max-w-[80px]">{ot.machine.name}</span>
        )}
        <span className={cn(
          'px-1.5 py-0.5 rounded text-[10px] font-medium',
          isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning-foreground'
        )}>
          {isOverdue ? 'Vencida' : STATUS_LABELS[ot.status] || ot.status}
        </span>
      </div>
    </div>
  );
}

function ControlListItem({ control }: { control: any }) {
  const isOverdue = control.status === 'OVERDUE';
  const statusColor = isOverdue ? 'text-destructive' : control.status === 'NOTIFIED' ? 'text-warning-foreground' : 'text-muted-foreground';
  return (
    <div className={cn(
      'flex items-center justify-between py-1.5 px-2 rounded-md text-xs',
      isOverdue ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted/50'
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <Clock className={cn('h-3 w-3 flex-shrink-0', statusColor)} />
        <span className="truncate">{control.solutionApplied?.description || control.controlDefinition?.name || 'Control'}</span>
      </div>
      <span className={cn('text-[10px] font-medium flex-shrink-0', statusColor)}>
        {isOverdue ? 'Vencido' : control.status === 'NOTIFIED' ? 'Notificado' : 'Pendiente'}
      </span>
    </div>
  );
}
