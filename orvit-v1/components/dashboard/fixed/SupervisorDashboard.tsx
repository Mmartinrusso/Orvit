'use client';

import React from 'react';
import { Users, ClipboardList, TrendingUp, Activity, Shield, AlertTriangle, Clock, CheckCircle, HeartPulse } from 'lucide-react';
import { SupervisorHero } from '../hero/SupervisorHero';
import { DashboardSection } from './DashboardSection';
import { DashboardCard } from './DashboardCard';
import { DonutChart } from '../charts/DonutChart';
import { BarChart } from '../charts/BarChart';
import { PieChart } from '../charts/PieChart';
import { AreaChart } from '../charts/AreaChart';
import { GaugeChart } from '../charts/GaugeChart';
import { ProgressBar } from '../charts/ProgressBar';
import { useSupervisorDashboardData } from '@/hooks/mantenimiento/useSupervisorDashboardData';
import { cn } from '@/lib/utils';

interface SupervisorDashboardProps {
  companyId: number;
  sectorId?: number | null;
  userId: number;
}

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

function getHealthColor(score: number): string {
  if (score >= 80) return 'hsl(var(--success))';
  if (score >= 50) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

function getHealthBgColor(score: number): string {
  if (score >= 80) return 'bg-success';
  if (score >= 50) return 'bg-warning';
  return 'bg-destructive';
}

export function SupervisorDashboard({ companyId, sectorId, userId }: SupervisorDashboardProps) {
  const { kpis, workOrders, teamWorkload, healthScore, controls } = useSupervisorDashboardData(companyId, sectorId, userId);

  // Team workload chart data
  const workloadBarData = React.useMemo(() => {
    const workload = teamWorkload.data?.workload;
    if (!workload || !Array.isArray(workload)) return [];
    return workload.map((w: any) => ({
      label: w.userName?.split(' ')[0] || `ID ${w.userId}`,
      value: (w.pending || 0) + (w.inProgress || 0),
    })).sort((a: any, b: any) => b.value - a.value).slice(0, 8);
  }, [teamWorkload.data]);

  const completedThisWeekData = React.useMemo(() => {
    const workload = teamWorkload.data?.workload;
    if (!workload || !Array.isArray(workload)) return [];
    return workload
      .filter((w: any) => (w.completedThisWeek || 0) > 0)
      .map((w: any) => ({
        label: w.userName?.split(' ')[0] || `ID ${w.userId}`,
        value: w.completedThisWeek || 0,
      }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 8);
  }, [teamWorkload.data]);

  // Orders status donut
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

  // Priority bar chart
  const priorityData = React.useMemo(() => {
    if (!workOrders.data?.stats?.byPriority) return [];
    const bp = workOrders.data.stats.byPriority as Record<string, number>;
    return Object.entries(bp)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        label: PRIORITY_LABELS[key] || key,
        value,
        color: PRIORITY_COLORS[key],
      }))
      .sort((a, b) => b.value - a.value);
  }, [workOrders.data]);

  // Preventive vs corrective
  const pvcData = React.useMemo(() => {
    const pvc = kpis.data?.preventiveVsCorrective;
    if (!pvc) return [];
    return [
      { label: 'Preventivo', value: pvc.preventive || 0, color: 'hsl(var(--success))' },
      { label: 'Correctivo', value: pvc.corrective || 0, color: 'hsl(var(--warning))' },
    ].filter(d => d.value > 0);
  }, [kpis.data]);

  // Monthly trend
  const monthlyTrendData = React.useMemo(() => {
    const trend = kpis.data?.trends?.monthlyCompletion;
    if (!trend || !Array.isArray(trend)) return [];
    return trend.map((t: any) => ({ label: formatMonth(t.month), value: t.completed }));
  }, [kpis.data]);

  // Failure frequency
  const failureFreqData = React.useMemo(() => {
    const freq = kpis.data?.trends?.failureFrequency;
    if (!freq || !Array.isArray(freq)) return [];
    return freq.slice(0, 6).map((f: any) => ({
      label: f.machineName?.length > 14 ? f.machineName.substring(0, 14) + '...' : f.machineName,
      value: f.failureCount,
    }));
  }, [kpis.data]);

  // Health scores
  const healthBarData = React.useMemo(() => {
    const machines = healthScore.data?.machines || healthScore.data?.scores;
    if (!machines || !Array.isArray(machines)) return [];
    return machines
      .sort((a: any, b: any) => (a.score ?? a.healthScore ?? 0) - (b.score ?? b.healthScore ?? 0))
      .slice(0, 8)
      .map((m: any) => ({
        label: (m.name || m.machineName || '?').substring(0, 14),
        value: m.score ?? m.healthScore ?? 0,
        color: getHealthColor(m.score ?? m.healthScore ?? 0),
      }));
  }, [healthScore.data]);

  const healthSummary = React.useMemo(() => {
    const machines = healthScore.data?.machines || healthScore.data?.scores || [];
    if (!Array.isArray(machines) || machines.length === 0) return { critical: 0, warning: 0, healthy: 0 };
    let critical = 0, warning = 0, healthy = 0;
    for (const m of machines) {
      const s = m.score ?? m.healthScore ?? 0;
      if (s >= 80) healthy++;
      else if (s >= 50) warning++;
      else critical++;
    }
    return { critical, warning, healthy };
  }, [healthScore.data]);

  const overdueOTs = workOrders.data?.overdue?.slice(0, 5) || [];
  const controlsList = controls.data?.controls?.slice(0, 5) || [];
  const complianceRate = kpis.data?.preventiveCompliance?.complianceRate ?? 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Hero */}
      <SupervisorHero companyId={companyId} sectorId={sectorId} userId={userId} />

      {/* Carga del Equipo */}
      <DashboardSection title="Carga del Equipo" icon={Users} subtitle={`${workloadBarData.length} técnicos`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DashboardCard title="Carga Activa por Técnico" info="Cantidad de órdenes pendientes + en progreso por cada técnico del equipo. Permite detectar desequilibrios: si alguno tiene demasiado trabajo o muy poco." isLoading={teamWorkload.isLoading} className="lg:col-span-2">
            {workloadBarData.length > 0 ? (
              <BarChart data={workloadBarData} horizontal height={200} showValues />
            ) : (
              <EmptyState text="Sin datos de carga" />
            )}
          </DashboardCard>
          <DashboardCard title="Completados esta Semana" info="OTs cerradas por cada técnico en los últimos 7 días. Es un indicador de productividad semanal del equipo." isLoading={teamWorkload.isLoading}>
            {completedThisWeekData.length > 0 ? (
              <BarChart data={completedThisWeekData} height={200} showValues colors={['hsl(var(--success))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))']} />
            ) : (
              <EmptyState text="Sin completados" />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Estado de Órdenes */}
      <DashboardSection title="Estado de Órdenes" icon={ClipboardList} subtitle={`${workOrders.data?.stats?.total || 0} total`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardCard title="Por Estado" info="Vista global de todas las OTs del sector por estado. Una proporción alta de 'vencidas' indica que el equipo no está dando abasto o que hay problemas de planificación." isLoading={workOrders.isLoading}>
            {statusDonutData.length > 0 ? (
              <DonutChart data={statusDonutData} size={110} showTotal showLegend totalLabel="OTs" />
            ) : (
              <EmptyState text="Sin órdenes" />
            )}
          </DashboardCard>
          <DashboardCard title="Por Prioridad" info="Distribución de órdenes por nivel de urgencia. Una acumulación de OTs críticas o de emergencia sin resolver requiere intervención inmediata del supervisor." isLoading={workOrders.isLoading}>
            {priorityData.length > 0 ? (
              <BarChart data={priorityData} horizontal height={160} showValues />
            ) : (
              <EmptyState text="Sin datos" />
            )}
          </DashboardCard>
          <DashboardCard title="Preventivo vs Correctivo" info="Relación entre mantenimientos planificados y correctivos. Un alto porcentaje de correctivo indica que el equipo está 'apagando incendios' en lugar de prevenir fallas." isLoading={kpis.isLoading}>
            {pvcData.length > 0 ? (
              <PieChart data={pvcData} size={130} showPercentages showLegend />
            ) : (
              <EmptyState text="Sin datos" />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Tendencias */}
      <DashboardSection title="Tendencias y Rendimiento" icon={TrendingUp} subtitle="Últimos 6 meses">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardCard title="Completitud Mensual" info="Evolución mensual de OTs completadas en los últimos 6 meses. Una tendencia creciente o estable es positiva; una caída sostenida puede indicar sobrecarga del equipo." isLoading={kpis.isLoading}>
            {monthlyTrendData.length > 0 ? (
              <AreaChart data={monthlyTrendData} height={180} color="hsl(var(--success))" showLabels showGrid />
            ) : (
              <EmptyState text="Sin datos de tendencia" />
            )}
          </DashboardCard>
          <DashboardCard title="Frecuencia de Fallas por Máquina" info="Máquinas con más intervenciones correctivas en los últimos 3 meses. Las que aparecen primero son candidatas a un análisis de causa raíz o un plan de mantenimiento más intensivo." isLoading={kpis.isLoading}>
            {failureFreqData.length > 0 ? (
              <BarChart data={failureFreqData} height={180} showValues colors={['hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-1))']} />
            ) : (
              <EmptyState text="Sin fallas registradas" />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Salud de Máquinas */}
      <DashboardSection title="Salud de Máquinas" icon={HeartPulse}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardCard title="Health Scores (peores primero)" info="Puntuación de salud de cada máquina calculada en base a su historial de fallas, tiempos de inactividad y mantenimientos. 80+ = óptimo, 50-79 = atención, menor a 50 = crítico." isLoading={healthScore.isLoading}>
            {healthBarData.length > 0 ? (
              <BarChart data={healthBarData} horizontal height={200} showValues />
            ) : (
              <EmptyState text="Sin datos de salud" />
            )}
          </DashboardCard>
          <DashboardCard title="Resumen de Estado" info="Conteo de máquinas clasificadas por estado de salud: críticas (score < 50) requieren intervención urgente; en atención (50-79) necesitan seguimiento; óptimas (80+) están en buen estado." isLoading={healthScore.isLoading}>
            <div className="flex items-center justify-around py-4 h-full">
              <div className="text-center">
                <GaugeChart value={healthSummary.critical} max={Math.max(healthSummary.critical + healthSummary.warning + healthSummary.healthy, 1)} size={80} thickness={8} label="Crítico" unit="" thresholds={[{ value: 100, color: 'hsl(var(--destructive))' }]} />
              </div>
              <div className="text-center">
                <GaugeChart value={healthSummary.warning} max={Math.max(healthSummary.critical + healthSummary.warning + healthSummary.healthy, 1)} size={80} thickness={8} label="Atención" unit="" thresholds={[{ value: 100, color: 'hsl(var(--warning))' }]} />
              </div>
              <div className="text-center">
                <GaugeChart value={healthSummary.healthy} max={Math.max(healthSummary.critical + healthSummary.warning + healthSummary.healthy, 1)} size={80} thickness={8} label="Óptimo" unit="" thresholds={[{ value: 100, color: 'hsl(var(--success))' }]} />
              </div>
            </div>
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Cumplimiento y Controles */}
      <DashboardSection title="Cumplimiento y Controles" icon={Shield}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardCard title="Cumplimiento Preventivo" info="% de mantenimientos preventivos ejecutados a tiempo sobre los programados. 80%+ es el objetivo. Por debajo del 60% implica riesgo operacional elevado." isLoading={kpis.isLoading}>
            <div className="flex flex-col items-center justify-center py-2">
              <GaugeChart value={complianceRate} size={110} thickness={10} label="Preventivo" unit="%" />
              <div className="mt-3 w-full space-y-1.5">
                <MiniStat label="A tiempo" value={kpis.data?.preventiveCompliance?.completedOnTime ?? 0} color="text-success" />
                <MiniStat label="Tardío" value={kpis.data?.preventiveCompliance?.completedLate ?? 0} color="text-warning-foreground" />
                <MiniStat label="Vencido" value={kpis.data?.preventiveCompliance?.overdue ?? 0} color="text-destructive" />
              </div>
            </div>
          </DashboardCard>
          <DashboardCard title="Controles Pendientes del Sector" info="Verificaciones periódicas pendientes para confirmar que las soluciones aplicadas a fallas anteriores siguen siendo efectivas. Los vencidos requieren atención inmediata." isLoading={controls.isLoading} contentHeight="min-h-[200px]">
            {controlsList.length > 0 ? (
              <div className="space-y-2">
                {controlsList.map((ctrl: any, i: number) => (
                  <div key={ctrl.id || i} className={cn(
                    'flex items-center justify-between py-1.5 px-2 rounded-md text-xs',
                    ctrl.status === 'OVERDUE' ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted/50'
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className={cn('h-3 w-3 flex-shrink-0', ctrl.status === 'OVERDUE' ? 'text-destructive' : 'text-muted-foreground')} />
                      <span className="truncate">{ctrl.solutionApplied?.description || ctrl.controlDefinition?.name || 'Control'}</span>
                    </div>
                    <span className={cn('text-[10px] font-medium flex-shrink-0', ctrl.status === 'OVERDUE' ? 'text-destructive' : 'text-muted-foreground')}>
                      {ctrl.status === 'OVERDUE' ? 'Vencido' : ctrl.status === 'NOTIFIED' ? 'Notificado' : 'Pendiente'}
                    </span>
                  </div>
                ))}
                {controls.data?.summary && (
                  <div className="pt-2 border-t mt-2">
                    <ProgressBar
                      value={controls.data.summary.completed || 0}
                      max={controls.data.summary.total || 1}
                      label="Completados"
                      size="sm"
                      color="bg-success"
                    />
                  </div>
                )}
              </div>
            ) : (
              <EmptyState text="Sin controles pendientes" icon={<CheckCircle className="h-5 w-5 text-success" />} />
            )}
          </DashboardCard>
          <DashboardCard title="Top Vencidas" info="Las órdenes de trabajo que superaron su fecha límite sin ser completadas. Cada una representa un riesgo operativo o incumplimiento de SLA que debe ser abordado urgentemente." isLoading={workOrders.isLoading} contentHeight="min-h-[200px]">
            {overdueOTs.length > 0 ? (
              <div className="space-y-2">
                {overdueOTs.map((ot: any) => (
                  <div key={ot.id} className="flex items-center justify-between py-1.5 px-2 rounded-md text-xs bg-destructive/5 border border-destructive/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                      <span className="font-medium truncate">{ot.title || `OT-${ot.id}`}</span>
                    </div>
                    <span className="text-[10px] text-destructive font-medium flex-shrink-0">
                      {ot.machine?.name?.substring(0, 12) || 'Vencida'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Sin OTs vencidas" icon={<CheckCircle className="h-5 w-5 text-success" />} />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>
    </div>
  );
}

// --- Helpers ---

function EmptyState({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-6 text-center">
      {icon || <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mb-1"><Activity className="h-4 w-4 text-muted-foreground" /></div>}
      <p className="text-xs text-muted-foreground mt-1">{text}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', color)}>{value}</span>
    </div>
  );
}
