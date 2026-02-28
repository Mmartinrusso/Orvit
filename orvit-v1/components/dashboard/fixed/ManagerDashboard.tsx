'use client';

import React from 'react';
import { TrendingUp, ClipboardList, HeartPulse, DollarSign, Building2, Target, Activity, AlertTriangle } from 'lucide-react';
import { ManagerHero } from '../hero/ManagerHero';
import { DashboardSection } from './DashboardSection';
import { DashboardCard } from './DashboardCard';
import { DonutChart } from '../charts/DonutChart';
import { BarChart } from '../charts/BarChart';
import { PieChart } from '../charts/PieChart';
import { AreaChart } from '../charts/AreaChart';
import { GaugeChart } from '../charts/GaugeChart';
import { ProgressBar } from '../charts/ProgressBar';
import { useManagerDashboardData } from '@/hooks/mantenimiento/useManagerDashboardData';
import { cn } from '@/lib/utils';

interface ManagerDashboardProps {
  companyId: number;
  sectorId?: number | null;
  userId: number;
}

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja', EMERGENCY: 'Emergencia',
};
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'hsl(var(--destructive))', HIGH: 'hsl(var(--warning))', MEDIUM: 'hsl(var(--chart-2))', LOW: 'hsl(var(--success))', EMERGENCY: 'hsl(var(--chart-5))',
};

function formatMonth(monthStr: string) {
  const [, m] = monthStr.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months[parseInt(m) - 1] || monthStr;
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${Math.round(val)}`;
}

function getHealthColor(score: number): string {
  if (score >= 80) return 'hsl(var(--success))';
  if (score >= 50) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

export function ManagerDashboard({ companyId, sectorId, userId }: ManagerDashboardProps) {
  const { kpis, workOrders, costs, crossSector, healthScore, solutionEffectiveness } = useManagerDashboardData(companyId, sectorId);

  // === TRENDS ===
  const monthlyCompletionData = React.useMemo(() => {
    const trend = kpis.data?.trends?.monthlyCompletion;
    if (!trend || !Array.isArray(trend)) return [];
    return trend.map((t: any) => ({ label: formatMonth(t.month), value: t.completed }));
  }, [kpis.data]);

  const costTrendData = React.useMemo(() => {
    // Use kpis.trends.costTrend or costs.monthlyTrend
    const trend = kpis.data?.trends?.costTrend || costs.data?.data?.monthlyTrend;
    if (!trend || !Array.isArray(trend)) return [];
    return trend.map((t: any) => ({
      label: formatMonth(t.month),
      value: t.cost ?? t.total ?? t.totalCost ?? 0,
    }));
  }, [kpis.data, costs.data]);

  // === ORDERS ===
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

  const pvcData = React.useMemo(() => {
    const pvc = kpis.data?.preventiveVsCorrective;
    if (!pvc) return [];
    return [
      { label: 'Preventivo', value: pvc.preventive || 0, color: 'hsl(var(--success))' },
      { label: 'Correctivo', value: pvc.corrective || 0, color: 'hsl(var(--warning))' },
    ].filter(d => d.value > 0);
  }, [kpis.data]);

  const priorityData = React.useMemo(() => {
    if (!workOrders.data?.stats?.byPriority) return [];
    const bp = workOrders.data.stats.byPriority as Record<string, number>;
    return Object.entries(bp)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ label: PRIORITY_LABELS[key] || key, value, color: PRIORITY_COLORS[key] }))
      .sort((a, b) => b.value - a.value);
  }, [workOrders.data]);

  // === RELIABILITY ===
  const failureFreqData = React.useMemo(() => {
    const freq = kpis.data?.trends?.failureFrequency;
    if (!freq || !Array.isArray(freq)) return [];
    return freq.slice(0, 8).map((f: any) => ({
      label: f.machineName?.length > 16 ? f.machineName.substring(0, 16) + '...' : f.machineName,
      value: f.failureCount,
      color: 'hsl(var(--destructive))',
    }));
  }, [kpis.data]);

  const healthBarData = React.useMemo(() => {
    const machines = healthScore.data?.machines || healthScore.data?.scores;
    if (!machines || !Array.isArray(machines)) return [];
    return machines
      .sort((a: any, b: any) => (a.score ?? a.healthScore ?? 0) - (b.score ?? b.healthScore ?? 0))
      .slice(0, 8)
      .map((m: any) => ({
        label: (m.name || m.machineName || '?').substring(0, 16),
        value: m.score ?? m.healthScore ?? 0,
        color: getHealthColor(m.score ?? m.healthScore ?? 0),
      }));
  }, [healthScore.data]);

  // === COSTS ===
  const costDistributionData = React.useMemo(() => {
    const dist = costs.data?.data?.distribution;
    if (!dist) return [];
    return [
      { label: 'Mano de Obra', value: dist.labor || 0, color: 'hsl(var(--chart-1))' },
      { label: 'Repuestos', value: dist.parts || 0, color: 'hsl(var(--chart-2))' },
      { label: 'Terceros', value: dist.thirdParty || 0, color: 'hsl(var(--chart-3))' },
      { label: 'Extras', value: dist.extras || 0, color: 'hsl(var(--chart-4))' },
    ].filter(d => d.value > 0);
  }, [costs.data]);

  const topMachinesCostData = React.useMemo(() => {
    const top = costs.data?.data?.topMachines;
    if (!top || !Array.isArray(top)) return [];
    return top.slice(0, 5).map((m: any) => ({
      label: (m.machineName || m.name || '?').substring(0, 14),
      value: m.totalCost || 0,
    }));
  }, [costs.data]);

  const budgetUsedPercent = costs.data?.data?.kpis?.budgetUsedPercent ?? 0;

  // === CROSS SECTOR ===
  const sectorActiveOTsData = React.useMemo(() => {
    const sectors = crossSector.data?.sectors;
    if (!sectors || !Array.isArray(sectors)) return [];
    return sectors.map((s: any) => ({
      label: (s.sectorName || s.name || '?').substring(0, 12),
      value: s.activeOTs ?? s.active ?? 0,
    }));
  }, [crossSector.data]);

  const sectorCompletionData = React.useMemo(() => {
    const sectors = crossSector.data?.sectors;
    if (!sectors || !Array.isArray(sectors)) return [];
    return sectors.map((s: any) => ({
      label: (s.sectorName || s.name || '?').substring(0, 12),
      value: s.completionRate ?? 0,
      color: (s.completionRate ?? 0) >= 80 ? 'hsl(var(--success))' : (s.completionRate ?? 0) >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
    }));
  }, [crossSector.data]);

  // === SOLUTION EFFECTIVENESS ===
  const solutionOutcomeData = React.useMemo(() => {
    const data = solutionEffectiveness.data;
    if (!data) return [];
    const byOutcome = data.byOutcome || {};
    return [
      { label: 'Funcionó', value: byOutcome['FUNCIONÓ'] || byOutcome['RESOLVED'] || 0, color: 'hsl(var(--success))' },
      { label: 'Parcial', value: byOutcome['PARCIAL'] || byOutcome['PARTIAL'] || 0, color: 'hsl(var(--warning))' },
      { label: 'No Funcionó', value: byOutcome['NO_FUNCIONÓ'] || byOutcome['FAILED'] || 0, color: 'hsl(var(--destructive))' },
    ].filter(d => d.value > 0);
  }, [solutionEffectiveness.data]);

  const complianceRate = kpis.data?.preventiveCompliance?.complianceRate ?? 0;
  const compliance = kpis.data?.preventiveCompliance;

  return (
    <div className="space-y-6 pb-8">
      {/* Hero - 6 Gauge cards */}
      <ManagerHero companyId={companyId} sectorId={sectorId} userId={userId} />

      {/* Tendencias (6 Meses) */}
      <DashboardSection title="Tendencias (6 Meses)" icon={TrendingUp}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardCard title="Completitud Mensual" subtitle="OTs completadas por mes" info="Volumen de órdenes de trabajo cerradas por mes en los últimos 6 meses. Permite detectar estacionalidades, picos de trabajo y la capacidad real del equipo a lo largo del tiempo." isLoading={kpis.isLoading}>
            {monthlyCompletionData.length > 0 ? (
              <AreaChart data={monthlyCompletionData} height={200} color="hsl(var(--success))" showLabels showGrid />
            ) : (
              <EmptyState text="Sin datos de tendencia" />
            )}
          </DashboardCard>
          <DashboardCard title="Costos Mensuales" subtitle="Evolución de gastos" info="Gasto total en mantenimiento por mes durante los últimos 6 meses. Permite detectar meses con costos inusuales, planificar presupuesto y correlacionar picos de gasto con eventos operativos." isLoading={kpis.isLoading || costs.isLoading}>
            {costTrendData.length > 0 ? (
              <AreaChart data={costTrendData} height={200} color="hsl(var(--chart-1))" showLabels showGrid />
            ) : (
              <EmptyState text="Sin datos de costos" />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Análisis de Órdenes */}
      <DashboardSection title="Análisis de Órdenes" icon={ClipboardList} subtitle={`${workOrders.data?.stats?.total || 0} este mes`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardCard title="Por Estado" info="Distribución de todas las órdenes de trabajo de la empresa según su estado actual. Permite evaluar la carga operativa: muchas pendientes o vencidas señalan cuellos de botella en la ejecución." isLoading={workOrders.isLoading}>
            {statusDonutData.length > 0 ? (
              <DonutChart data={statusDonutData} size={110} showTotal showLegend totalLabel="OTs" />
            ) : (
              <EmptyState text="Sin órdenes" />
            )}
          </DashboardCard>
          <DashboardCard title="Preventivo vs Correctivo" info="Relación entre mantenimientos planificados (preventivo) y los realizados por fallas o averías (correctivo). Un alto porcentaje correctivo indica reactividad; más preventivo implica mejor planificación y menor riesgo operativo." isLoading={kpis.isLoading}>
            {pvcData.length > 0 ? (
              <PieChart data={pvcData} size={130} showPercentages showLegend />
            ) : (
              <EmptyState text="Sin datos" />
            )}
          </DashboardCard>
          <DashboardCard title="Por Prioridad" info="Cantidad de órdenes de trabajo agrupadas por nivel de urgencia. Un alto volumen de prioridades Crítica y Emergencia puede indicar problemas sistémicos en equipos clave o falta de mantenimiento preventivo." isLoading={workOrders.isLoading}>
            {priorityData.length > 0 ? (
              <BarChart data={priorityData} horizontal height={160} showValues />
            ) : (
              <EmptyState text="Sin datos" />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Confiabilidad de Equipos */}
      <DashboardSection title="Confiabilidad de Equipos" icon={HeartPulse}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardCard title="Top Máquinas con Fallas" subtitle="Últimos 3 meses" info="Las máquinas con mayor cantidad de órdenes correctivas en los últimos 3 meses. Son candidatas prioritarias para un plan de mantenimiento preventivo intensivo o para evaluar su reemplazo." isLoading={kpis.isLoading}>
            {failureFreqData.length > 0 ? (
              <BarChart data={failureFreqData} horizontal height={220} showValues />
            ) : (
              <EmptyState text="Sin fallas registradas" />
            )}
          </DashboardCard>
          <DashboardCard title="Health Scores" subtitle="Peores primero" info="Índice de salud de cada máquina calculado en base a frecuencia de fallas, tiempo de parada y cumplimiento de preventivos. Verde (+80): óptimo. Amarillo (50-80): atención requerida. Rojo (-50): estado crítico." isLoading={healthScore.isLoading}>
            {healthBarData.length > 0 ? (
              <BarChart data={healthBarData} horizontal height={220} showValues />
            ) : (
              <EmptyState text="Sin datos de salud" />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Costos de Mantenimiento */}
      <DashboardSection title="Costos de Mantenimiento" icon={DollarSign}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardCard title="Distribución de Costos" info="Desglose del gasto total de mantenimiento por categoría: mano de obra propia, repuestos y materiales, servicios de terceros y costos adicionales. Útil para identificar dónde optimizar el presupuesto." isLoading={costs.isLoading}>
            {costDistributionData.length > 0 ? (
              <DonutChart data={costDistributionData} size={110} showTotal showLegend totalLabel="Total" />
            ) : (
              <EmptyState text="Sin datos de costos" />
            )}
          </DashboardCard>
          <DashboardCard title="Top Máquinas Más Costosas" info="Las 5 máquinas con mayor gasto acumulado en mantenimiento durante el período. Ayuda a priorizar inversiones, negociar contratos de servicio o evaluar la conveniencia de reemplazar equipos de alto costo operativo." isLoading={costs.isLoading}>
            {topMachinesCostData.length > 0 ? (
              <BarChart data={topMachinesCostData} height={180} showValues colors={['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']} />
            ) : (
              <EmptyState text="Sin datos" />
            )}
          </DashboardCard>
          <DashboardCard title="Presupuesto Utilizado" info="Porcentaje del presupuesto de mantenimiento consumido en el período. Verde: dentro del presupuesto. Amarillo: cerca del límite (90%). Rojo: superado. Incluye costo total, número de OTs y costo promedio por orden." isLoading={costs.isLoading}>
            <div className="flex flex-col items-center justify-center py-2">
              <GaugeChart
                value={Math.min(budgetUsedPercent, 100)}
                size={110}
                thickness={10}
                label="Presupuesto"
                unit="%"
                thresholds={[
                  { value: 70, color: 'hsl(var(--success))' },
                  { value: 90, color: 'hsl(var(--warning))' },
                  { value: 100, color: 'hsl(var(--destructive))' },
                ]}
              />
              {costs.data?.data?.kpis && (
                <div className="mt-3 text-center space-y-1">
                  <div className="text-lg font-bold tabular-nums">{formatCurrency(costs.data.data.kpis.totalCostPeriod || 0)}</div>
                  <div className="text-xs text-muted-foreground">
                    {costs.data.data.kpis.totalWorkOrders || 0} OTs · Promedio {formatCurrency(costs.data.data.kpis.avgCostPerOT || 0)}/OT
                  </div>
                </div>
              )}
            </div>
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Comparativa entre Sectores */}
      <DashboardSection title="Comparativa entre Sectores" icon={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardCard title="OTs Activas por Sector" info="Cantidad de órdenes de trabajo activas (pendientes + en progreso) en cada sector de la empresa. Permite detectar sectores sobrecargados o con mayor demanda de mantenimiento para redistribuir recursos." isLoading={crossSector.isLoading}>
            {sectorActiveOTsData.length > 0 ? (
              <BarChart data={sectorActiveOTsData} height={200} showValues showLabels colors={['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']} />
            ) : (
              <EmptyState text="Sin datos de sectores" />
            )}
          </DashboardCard>
          <DashboardCard title="Tasa de Completitud por Sector" info="Porcentaje de órdenes de trabajo cerradas sobre el total generado por cada sector. Verde (+80%): excelente gestión. Amarillo (50-80%): requiere atención. Rojo (-50%): sector con problemas operativos." isLoading={crossSector.isLoading}>
            {sectorCompletionData.length > 0 ? (
              <BarChart data={sectorCompletionData} horizontal height={200} showValues />
            ) : (
              <EmptyState text="Sin datos" />
            )}
          </DashboardCard>
        </div>
      </DashboardSection>

      {/* Efectividad de Soluciones + Cumplimiento */}
      <DashboardSection title="Efectividad y Cumplimiento" icon={Target}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardCard title="Efectividad de Soluciones" info="Resultado de las soluciones aplicadas a fallas: cuántas funcionaron completamente, cuántas fueron parciales y cuántas no resolvieron el problema. También muestra el tiempo promedio de resolución del equipo técnico." isLoading={solutionEffectiveness.isLoading}>
            {solutionOutcomeData.length > 0 ? (
              <div className="flex flex-col items-center">
                <DonutChart data={solutionOutcomeData} size={110} showTotal showLegend totalLabel="Total" />
                {solutionEffectiveness.data?.avgResolutionMinutes != null && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Tiempo promedio de resolución: <span className="font-semibold text-foreground">{Math.round(solutionEffectiveness.data.avgResolutionMinutes / 60)}h</span>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState text="Sin datos de soluciones" />
            )}
          </DashboardCard>
          <DashboardCard title="Cumplimiento Preventivo" info="Porcentaje de mantenimientos preventivos completados sobre el total programado. Las barras muestran cuántos se hicieron a tiempo, cuántos con demora y cuántos siguen vencidos. 80%+ es el objetivo operativo recomendado." isLoading={kpis.isLoading}>
            <div className="flex flex-col items-center justify-center py-2">
              <GaugeChart value={complianceRate} size={110} thickness={10} label="Cumplimiento" unit="%" />
              {compliance && (
                <div className="mt-3 w-full space-y-2">
                  <ProgressBar
                    value={compliance.completedOnTime || 0}
                    max={compliance.totalScheduled || 1}
                    label="A tiempo"
                    size="sm"
                    color="bg-success"
                  />
                  <ProgressBar
                    value={compliance.completedLate || 0}
                    max={compliance.totalScheduled || 1}
                    label="Tardío"
                    size="sm"
                    color="bg-warning"
                  />
                  <ProgressBar
                    value={compliance.overdue || 0}
                    max={compliance.totalScheduled || 1}
                    label="Vencido"
                    size="sm"
                    color="bg-destructive"
                  />
                </div>
              )}
            </div>
          </DashboardCard>
        </div>
      </DashboardSection>
    </div>
  );
}

// --- Helpers ---

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-6 text-center">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mb-1">
        <Activity className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{text}</p>
    </div>
  );
}
