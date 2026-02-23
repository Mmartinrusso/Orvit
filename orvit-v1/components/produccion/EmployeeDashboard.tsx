'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_COLORS } from '@/lib/colors';
import {
  Package,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Activity,
  Loader2,
  ArrowRight,
  Sun,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import RoutinePendingCard from '@/components/produccion/RoutinePendingCard';



interface DashboardData {
  routines: {
    templateId: number;
    code: string;
    name: string;
    type: string;
    workCenter: { id: number; name: string } | null;
    status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
    draftId: number | null;
    progress: { completed: number; total: number; percentage: number };
  }[];
  routineSummary: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
  productionSummary: {
    hasSession: boolean;
    sessionId: number | null;
    sessionStatus: string | null;
    totalQuantity: number;
    totalScrap: number;
    productsLoaded: number;
  };
  recentActivity: {
    id: number;
    status: string;
    executedAt: string;
    startedAt: string;
    template: { name: string; type: string };
  }[];
  currentShift: { id: number; name: string; code: string } | null;
}

export default function EmployeeDashboard() {
  const { currentSector } = useCompany();
  const { user } = useAuth();
  const router = useRouter();
  const { data, isLoading: loading } = useQuery({
    queryKey: ['employee-dashboard', currentSector?.id],
    queryFn: async () => {
      const res = await fetch(`/api/production/dashboard/employee?sectorId=${currentSector!.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.success ? (json as DashboardData) : null;
    },
    enabled: !!currentSector,
    staleTime: 60 * 1000,
  });

  const handleStartRoutine = (templateId: number) => {
    router.push(`/produccion/rutinas?action=execute&templateId=${templateId}`);
  };

  const handleContinueRoutine = (draftId: number) => {
    router.push(`/produccion/rutinas?action=resume&draftId=${draftId}`);
  };

  if (!currentSector) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium mb-1">Sin sector seleccionado</h3>
          <p className="text-muted-foreground text-sm">Seleccioná un sector para ver tu dashboard</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Activity className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando tu dashboard...</p>
        </div>
      </div>
    );
  }

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buen día';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  })();

  const todayStr = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold">
          {greeting}, {user?.name?.split(' ')[0] || 'Empleado'}
        </h1>
        <p className="text-sm text-muted-foreground capitalize">
          {todayStr} · {currentSector.name}
          {data?.currentShift && <> · Turno: {data.currentShift.name}</>}
        </p>
      </div>

      {/* Mi día hoy - Checklist visual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Rutinas */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Rutinas</p>
                <p className="text-2xl font-bold">
                  {data?.routineSummary.completed || 0}/{data?.routineSummary.total || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.routineSummary.pending === 0 && data?.routineSummary.inProgress === 0 ? (
                    <span style={{ color: DEFAULT_COLORS.kpiPositive }} className="font-medium">Todo completado</span>
                  ) : (
                    <>
                      {data?.routineSummary.pending || 0} pendientes
                      {(data?.routineSummary.inProgress || 0) > 0 && `, ${data?.routineSummary.inProgress} en progreso`}
                    </>
                  )}
                </p>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${DEFAULT_COLORS.chart1}15` }}
              >
                <ClipboardCheck className="h-5 w-5" style={{ color: DEFAULT_COLORS.chart1 }} />
              </div>
            </div>
            {(data?.routineSummary.total || 0) > 0 && (
              <div className="mt-3">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      backgroundColor: DEFAULT_COLORS.kpiPositive,
                      width: `${((data?.routineSummary.completed || 0) / (data?.routineSummary.total || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Producción */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Producción hoy</p>
                <p className="text-2xl font-bold" style={{ color: DEFAULT_COLORS.kpiPositive }}>
                  {data?.productionSummary.totalQuantity?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.productionSummary.productsLoaded || 0} productos cargados
                  {(data?.productionSummary.totalScrap || 0) > 0 && (
                    <> · <span style={{ color: DEFAULT_COLORS.kpiNegative }}>{data?.productionSummary.totalScrap} scrap</span></>
                  )}
                </p>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${DEFAULT_COLORS.chart5}15` }}
              >
                <Package className="h-5 w-5" style={{ color: DEFAULT_COLORS.chart5 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status check */}
        <Card style={
          (data?.routineSummary.pending || 0) > 0 || !data?.productionSummary.hasSession
            ? { borderColor: `${DEFAULT_COLORS.chart4}50`, backgroundColor: `${DEFAULT_COLORS.chart4}08` }
            : {}
        }>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Estado del día</p>
                {(data?.routineSummary.pending === 0 && data?.routineSummary.inProgress === 0 && data?.productionSummary.hasSession) ? (
                  <div className="flex items-center gap-2 mt-2" style={{ color: DEFAULT_COLORS.kpiPositive }}>
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Todo en orden</span>
                  </div>
                ) : (
                  <div className="space-y-1 mt-2">
                    {(data?.routineSummary.pending || 0) > 0 && (
                      <p className="text-xs flex items-center gap-1" style={{ color: DEFAULT_COLORS.chart4 }}>
                        <Clock className="h-3 w-3" />
                        {data?.routineSummary.pending} rutinas pendientes
                      </p>
                    )}
                    {!data?.productionSummary.hasSession && (
                      <p className="text-xs flex items-center gap-1" style={{ color: DEFAULT_COLORS.chart4 }}>
                        <Package className="h-3 w-3" />
                        Producción sin cargar
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${DEFAULT_COLORS.chart4}15` }}
              >
                <Sun className="h-5 w-5" style={{ color: DEFAULT_COLORS.chart4 }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mis Rutinas Pendientes */}
      {data && data.routines.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" style={{ color: DEFAULT_COLORS.chart1 }} />
              Mis Rutinas de Hoy
            </h2>
            <Link href="/produccion/rutinas">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Ver todas
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.routines.slice(0, 6).map((routine) => (
              <RoutinePendingCard
                key={routine.templateId}
                routine={routine}
                onStart={handleStartRoutine}
                onContinue={handleContinueRoutine}
              />
            ))}
          </div>
        </div>
      )}

      {/* Producción del Día - Quick access */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" style={{ color: DEFAULT_COLORS.chart5 }} />
            Producción del Día
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data?.productionSummary.hasSession ? (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="font-bold" style={{ color: DEFAULT_COLORS.kpiPositive }}>
                    {data.productionSummary.totalQuantity.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground"> unidades producidas</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.productionSummary.productsLoaded} productos ·
                  Estado: <Badge variant="secondary" className="text-xs ml-1">{data.productionSummary.sessionStatus}</Badge>
                </p>
              </div>
              <Link href="/produccion/registro-diario">
                <Button size="sm" variant="outline" className="gap-1">
                  Ir a cargar
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                No hay producción cargada hoy
              </p>
              <Link href="/produccion/registro-diario">
                <Button size="sm" className="gap-1">
                  Cargar producción
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial reciente */}
      {data && data.recentActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: DEFAULT_COLORS.chart6 }} />
              Mi Historial Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {data.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('h-2 w-2 rounded-full', activity.status === 'COMPLETED' ? 'bg-success' : 'bg-warning')} />
                    <div>
                      <p className="text-sm font-medium">{activity.template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.executedAt), "dd/MM HH:mm")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={activity.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
                    {activity.status === 'COMPLETED' ? 'Completada' : 'En progreso'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
