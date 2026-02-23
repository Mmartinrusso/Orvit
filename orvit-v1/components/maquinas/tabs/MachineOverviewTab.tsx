'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Gauge,
  History,
  Package,
  QrCode,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  Wrench,
  Zap,
  Target,
  Timer,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from '@/lib/date-utils';
import { HealthScoreBadge, CriticalityBadge } from '@/components/maquinas/HealthScoreBadge';
import { QRCodeGenerator } from '@/components/maquinas/QRCodeGenerator';
import { Machine } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MachineOverviewTabProps {
  machine: Machine;
  companyId: number;
  onTabChange?: (tab: string) => void;
}

interface HealthScoreData {
  healthScore: {
    current: number | null;
    calculated: number;
    updatedAt: string | null;
    badge: { label: string; color: string };
  };
  factors: {
    totalScore: number;
    failureScore: number;
    maintenanceScore: number;
    ageScore: number;
    uptimeScore: number;
  };
  criticality: {
    total: number | null;
    production: number | null;
    safety: number | null;
    quality: number | null;
    cost: number | null;
  };
}

interface MachineStatsData {
  stats: {
    totalFailures: number;
    openFailures: number;
    resolvedFailures: number;
    totalWorkOrders: number;
    pendingWorkOrders: number;
    completedWorkOrders: number;
    inProgressWorkOrders: number;
    totalComponents: number;
    totalDocuments: number;
    upcomingMaintenance: Array<{
      id: number;
      title: string;
      scheduledDate: string;
      priority: string;
    }>;
    recentActivity: Array<{
      id: number;
      type: 'workOrder' | 'failure' | 'maintenance';
      title: string;
      date: string;
      status: string;
    }>;
  };
  kpis: {
    mtbf: number | null; // Mean Time Between Failures (hours)
    mttr: number | null; // Mean Time To Repair (hours)
    availability: number | null; // Percentage
    oee: number | null; // Overall Equipment Effectiveness
  };
  costs: {
    totalMaintenance: number;
    lastMonth: number;
    spareParts: number;
    labor: number;
  };
  warranty: {
    hasWarranty: boolean;
    expiresAt: string | null;
    daysRemaining: number | null;
    coverageType: string | null;
  } | null;
  counters: Array<{
    id: number;
    name: string;
    unit: string;
    currentValue: number;
    nextTriggerValue: number | null;
  }>;
}

export function MachineOverviewTab({ machine, companyId, onTabChange }: MachineOverviewTabProps) {
  // Fetch health score data
  const healthQuery = useQuery<HealthScoreData>({
    queryKey: ['machine-health-score', machine.id],
    queryFn: async () => {
      const res = await fetch(`/api/machines/${machine.id}/health-score`);
      if (!res.ok) throw new Error('Error fetching health score');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch machine stats
  const statsQuery = useQuery<MachineStatsData>({
    queryKey: ['machine-overview-stats', machine.id, companyId],
    queryFn: async () => {
      const res = await fetch(`/api/machines/${machine.id}/stats?companyId=${companyId}`);
      if (!res.ok) {
        // If endpoint doesn't exist, return default data
        return {
          stats: {
            totalFailures: 0,
            openFailures: 0,
            resolvedFailures: 0,
            totalWorkOrders: 0,
            pendingWorkOrders: 0,
            completedWorkOrders: 0,
            inProgressWorkOrders: 0,
            totalComponents: 0,
            totalDocuments: 0,
            upcomingMaintenance: [],
            recentActivity: [],
          },
          kpis: { mtbf: null, mttr: null, availability: null, oee: null },
          costs: { totalMaintenance: 0, lastMonth: 0, spareParts: 0, labor: 0 },
          warranty: null,
          counters: [],
        };
      }
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch counters
  const countersQuery = useQuery({
    queryKey: ['machine-counters', machine.id],
    queryFn: async () => {
      const res = await fetch(`/api/machines/${machine.id}/counters`);
      if (!res.ok) return { counters: [] };
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  // Fetch warranties
  const warrantyQuery = useQuery({
    queryKey: ['machine-warranty', machine.id, companyId],
    queryFn: async () => {
      const res = await fetch(`/api/warranties?companyId=${companyId}&entityType=MACHINE&entityId=${machine.id}`);
      if (!res.ok) return { warranties: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const healthData = healthQuery.data;
  const statsData = statsQuery.data;
  const counters = countersQuery.data?.counters || [];
  const warranties = warrantyQuery.data?.warranties || [];
  const activeWarranty = warranties.find((w: any) => w.isActive && new Date(w.endDate) > new Date());

  const isLoading = healthQuery.isLoading || statsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header con Health Score y Criticidad */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground mb-1">Health Score</span>
            <div className="relative">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4",
                healthData?.healthScore?.current
                  ? healthData.healthScore.current >= 80
                    ? "border-success text-success bg-success-muted"
                    : healthData.healthScore.current >= 50
                      ? "border-warning text-warning bg-warning-muted"
                      : "border-destructive text-destructive bg-destructive/10"
                  : "border-border text-muted-foreground bg-muted"
              )}>
                {healthData?.healthScore?.current ?? '—'}
              </div>
            </div>
            <span className="text-xs mt-1 font-medium">
              {healthData?.healthScore?.badge?.label || 'Sin datos'}
            </span>
          </div>

          <Separator orientation="vertical" className="h-20 hidden md:block" />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Criticidad:</span>
              <CriticalityBadge score={healthData?.criticality?.total} size="md" />
            </div>
            {healthData?.criticality && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>Prod: {healthData.criticality.production ?? '—'}</span>
                <span>Seg: {healthData.criticality.safety ?? '—'}</span>
                <span>Cal: {healthData.criticality.quality ?? '—'}</span>
                <span>Costo: {healthData.criticality.cost ?? '—'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <QRCodeGenerator
            machineId={machine.id}
            machineName={machine.name}
            assetCode={(machine as any).assetCode}
          />
        </div>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Fallas Abiertas"
          value={statsData?.stats?.openFailures ?? 0}
          icon={AlertTriangle}
          iconColor="text-destructive"
          trend={statsData?.stats?.openFailures === 0 ? 'positive' : 'negative'}
          onClick={() => onTabChange?.('failures')}
        />
        <StatCard
          title="OTs Pendientes"
          value={statsData?.stats?.pendingWorkOrders ?? 0}
          icon={Wrench}
          iconColor="text-warning"
          trend={statsData?.stats?.pendingWorkOrders === 0 ? 'positive' : 'neutral'}
          onClick={() => onTabChange?.('maintenance')}
        />
        <StatCard
          title="Componentes"
          value={statsData?.stats?.totalComponents ?? (machine as any)._count?.components ?? 0}
          icon={Settings}
          iconColor="text-info"
          onClick={() => onTabChange?.('components')}
        />
        <StatCard
          title="Documentos"
          value={statsData?.stats?.totalDocuments ?? 0}
          icon={FileText}
          iconColor="text-primary"
          onClick={() => onTabChange?.('docs')}
        />
      </div>

      {/* Fila de Métricas MTBF/MTTR y Contadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* KPIs de Confiabilidad */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Métricas de Confiabilidad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">MTBF</p>
                <p className="text-xl font-bold text-success">
                  {statsData?.kpis?.mtbf ? `${statsData.kpis.mtbf}h` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Tiempo medio entre fallas</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">MTTR</p>
                <p className="text-xl font-bold text-warning">
                  {statsData?.kpis?.mttr ? `${statsData.kpis.mttr}h` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Tiempo medio de reparación</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Disponibilidad</p>
                <p className="text-xl font-bold text-info">
                  {statsData?.kpis?.availability ? `${statsData.kpis.availability}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Uptime del activo</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">OEE</p>
                <p className="text-xl font-bold text-primary">
                  {statsData?.kpis?.oee ? `${statsData.kpis.oee}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Eficiencia global</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contadores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Contadores de Uso
            </CardTitle>
          </CardHeader>
          <CardContent>
            {counters.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Gauge className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin contadores configurados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {counters.slice(0, 3).map((counter: any) => {
                  const trigger = counter.triggers?.[0];
                  const progress = trigger
                    ? Math.min(100, ((counter.currentValue - (trigger.nextTriggerValue - trigger.triggerEvery)) / trigger.triggerEvery) * 100)
                    : 0;
                  const isNearTrigger = progress >= 80;

                  return (
                    <div key={counter.id} className={cn("p-2 rounded-lg border", isNearTrigger && "border-warning/30 bg-warning-muted")}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{counter.name}</span>
                        <span className="text-sm font-bold">
                          {Number(counter.currentValue).toLocaleString()} {counter.unit}
                        </span>
                      </div>
                      {trigger && (
                        <Progress value={progress} className={cn("h-1.5", isNearTrigger && "bg-warning/20")} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Garantía y Costos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Estado de Garantía */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Estado de Garantía
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeWarranty ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Proveedor</span>
                  <span className="text-sm font-medium">{activeWarranty.supplierName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Vencimiento</span>
                  <span className="text-sm font-medium">
                    {formatDate(activeWarranty.endDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Días restantes</span>
                  <Badge
                    variant={differenceInDays(new Date(activeWarranty.endDate), new Date()) <= 30 ? 'destructive' : 'default'}
                    className="text-xs"
                  >
                    {differenceInDays(new Date(activeWarranty.endDate), new Date())} días
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cobertura</span>
                  <Badge variant="outline" className="text-xs">
                    {activeWarranty.coverageType || 'Estándar'}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin garantía activa</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen de Costos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Resumen de Costos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Mantenimiento</span>
                <span className="text-sm font-bold text-success">
                  ${(statsData?.costs?.totalMaintenance ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Último Mes</span>
                <span className="text-sm font-medium">
                  ${(statsData?.costs?.lastMonth ?? 0).toLocaleString()}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Repuestos</span>
                <span>${(statsData?.costs?.spareParts ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Mano de Obra</span>
                <span>${(statsData?.costs?.labor ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Próximos Mantenimientos y Actividad Reciente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Próximos Mantenimientos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Próximos Mantenimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(statsData?.stats?.upcomingMaintenance?.length ?? 0) === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin mantenimientos programados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {statsData?.stats?.upcomingMaintenance?.slice(0, 4).map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{m.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(m.scheduledDate), 'dd MMM yyyy', { locale: es })}
                      </p>
                    </div>
                    <Badge variant={m.priority === 'HIGH' ? 'destructive' : m.priority === 'MEDIUM' ? 'default' : 'secondary'} className="text-xs">
                      {m.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actividad Reciente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(statsData?.stats?.recentActivity?.length ?? 0) === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin actividad reciente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {statsData?.stats?.recentActivity?.slice(0, 4).map((activity, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                    <div className={cn(
                      "p-1.5 rounded-full",
                      activity.type === 'failure' ? 'bg-destructive/10' :
                      activity.type === 'workOrder' ? 'bg-info-muted' : 'bg-success-muted'
                    )}>
                      {activity.type === 'failure' ? (
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      ) : activity.type === 'workOrder' ? (
                        <Wrench className="h-3 w-3 text-info" />
                      ) : (
                        <CheckCircle className="h-3 w-3 text-success" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.date), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Health Score Factors - Detalle */}
      {healthData?.factors && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Factores del Health Score
            </CardTitle>
            <CardDescription className="text-xs">
              Desglose de los componentes que afectan la salud del activo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FactorCard label="Fallas" value={healthData.factors.failureScore} maxValue={25} />
              <FactorCard label="Mantenimiento" value={healthData.factors.maintenanceScore} maxValue={35} />
              <FactorCard label="Edad" value={healthData.factors.ageScore} maxValue={20} />
              <FactorCard label="Uptime" value={healthData.factors.uptimeScore} maxValue={20} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Componente auxiliar para estadísticas
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  iconColor?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  onClick?: () => void;
}

function StatCard({ title, value, icon: Icon, iconColor = 'text-muted-foreground', trend, onClick }: StatCardProps) {
  return (
    <Card
      className={cn("cursor-pointer hover:shadow-md transition-shadow", onClick && "hover:border-primary/50")}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={cn("p-2 rounded-lg bg-muted/50", iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center text-xs">
            {trend === 'positive' ? (
              <>
                <ArrowDownRight className="h-3 w-3 text-success mr-1" />
                <span className="text-success">Óptimo</span>
              </>
            ) : trend === 'negative' ? (
              <>
                <ArrowUpRight className="h-3 w-3 text-destructive mr-1" />
                <span className="text-destructive">Requiere atención</span>
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Componente auxiliar para factores del health score
interface FactorCardProps {
  label: string;
  value: number;
  maxValue: number;
}

function FactorCard({ label, value, maxValue }: FactorCardProps) {
  const percentage = (value / maxValue) * 100;
  const color = percentage >= 80 ? 'bg-success' : percentage >= 50 ? 'bg-warning' : 'bg-destructive';

  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold">{value}/{maxValue}</p>
      <Progress value={percentage} className="h-1.5 mt-1" indicatorClassName={color} />
    </div>
  );
}

export default MachineOverviewTab;
