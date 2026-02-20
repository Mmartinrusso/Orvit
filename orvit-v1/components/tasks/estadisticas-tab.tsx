"use client";

import { useMemo } from "react";
import {
  LayoutGrid,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CircularProgress, MetricCard, SimpleLineChart, HeatmapCalendar, UserRanking } from "./task-charts";
import { useUserColors } from "@/hooks/use-user-colors";
import { REVERSE_STATUS_MAP, REVERSE_PRIORITY_MAP } from "@/lib/tasks/constants";
import { useCompany } from "@/contexts/CompanyContext";

// Valores frontend que devuelve /api/tasks (ya normalizados por mapStatusToFrontend / mapPriorityToFrontend)
const S_DONE = REVERSE_STATUS_MAP['DONE'];           // 'realizada'
const S_IN_PROGRESS = REVERSE_STATUS_MAP['IN_PROGRESS']; // 'en-curso'
const S_TODO = REVERSE_STATUS_MAP['TODO'];           // 'pendiente'
const P_HIGH = REVERSE_PRIORITY_MAP['HIGH'];         // 'alta'
const P_MEDIUM = REVERSE_PRIORITY_MAP['MEDIUM'];     // 'media'
const P_LOW = REVERSE_PRIORITY_MAP['LOW'];           // 'baja'

async function fetchTasks(companyId: string) {
  const res = await fetch(`/api/tasks?companyId=${companyId}`, {
    credentials: 'include',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error('Error al cargar tareas');
  const data = await res.json();
  // /api/tasks devuelve { data: [...], pagination: ... }
  return Array.isArray(data) ? data : (data?.data || data?.tasks || []);
}

async function fetchUsers() {
  const res = await fetch('/api/admin/users-with-roles', {
    credentials: 'include',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error('Error al cargar usuarios');
  const data = await res.json();
  const arr = Array.isArray(data) ? data : (data?.users || []);
  return arr.filter((user: any) =>
    user.permissions?.some((p: any) => p.name === 'ingresar_tareas') ||
    user.roles?.some((r: any) => r.permissions?.some((p: any) => p.name === 'ingresar_tareas'))
  );
}

export function EstadisticasTab() {
  const userColors = useUserColors();
  const { currentCompany } = useCompany();
  const [timeRange, setTimeRange] = useState('30');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  const { data: allTasks = [], isLoading: loadingTasks, isError: isErrorTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks-stats', currentCompany?.id],
    queryFn: () => fetchTasks(currentCompany!.id.toString()),
    enabled: !!currentCompany?.id,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  const { data: allUsers = [], isLoading: loadingUsers, isError: isErrorUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const loading = loadingTasks || loadingUsers;
  const isError = isErrorTasks || isErrorUsers;

  const usersWithTasks = useMemo(() => {
    const userIds = new Set<string>();
    allTasks.forEach((task: any) => {
      if (task.assignedTo?.id) userIds.add(task.assignedTo.id);
      if (task.createdBy?.id) userIds.add(task.createdBy.id);
    });
    return allUsers.filter((user: any) => userIds.has(user.id));
  }, [allTasks, allUsers]);

  const analytics = useMemo(() => {
    const now = new Date();
    const daysAgo = new Date(now.getTime() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
    let recentTasks = allTasks.filter((task: any) => new Date(task.createdAt) >= daysAgo);
    if (selectedUserId !== 'all') {
      recentTasks = recentTasks.filter((task: any) =>
        task.assignedTo?.id === selectedUserId || task.createdBy?.id === selectedUserId
      );
    }
    const total = recentTasks.length;
    const completed = recentTasks.filter((t: any) => t.status === S_DONE).length;
    const inProgress = recentTasks.filter((t: any) => t.status === S_IN_PROGRESS).length;
    const pending = recentTasks.filter((t: any) => t.status === S_TODO).length;
    const overdue = recentTasks.filter((t: any) => {
      if (!t.dueDate || t.status === S_DONE) return false;
      return new Date(t.dueDate) < now;
    }).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const productivity = Math.round(completed / (parseInt(timeRange) / 7));
    const completedWithDates = recentTasks.filter((t: any) => t.status === S_DONE && t.createdAt && t.updatedAt);
    const avgResolutionTime = completedWithDates.length > 0
      ? Math.round(completedWithDates.reduce((acc: number, task: any) => {
          return acc + (new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / completedWithDates.length)
      : 0;
    const trendData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(); date.setDate(date.getDate() - (6 - i));
      const dayTasks = recentTasks.filter((t: any) => new Date(t.createdAt).toDateString() === date.toDateString());
      return {
        label: date.toLocaleDateString('es-ES', { weekday: 'short' }),
        value: dayTasks.length,
        completed: dayTasks.filter((t: any) => t.status === S_DONE).length,
      };
    });
    const userStats = allUsers.map((user: any) => {
      const userTasks = allTasks.filter((t: any) => t.createdBy?.id === user.id);
      const userCompleted = userTasks.filter((t: any) => t.status === S_DONE).length;
      const userAssigned = allTasks.filter((t: any) => t.assignedTo?.id === user.id);
      return {
        name: user.name,
        value: userTasks.length,
        completed: userCompleted,
        assigned: userAssigned.length,
        percentage: userTasks.length > 0 ? Math.round((userCompleted / userTasks.length) * 100) : 0,
      };
    }).filter((u: any) => u.value > 0 || u.assigned > 0).sort((a: any, b: any) => b.value - a.value);
    const priorityStats = {
      high: recentTasks.filter((t: any) => t.priority === P_HIGH).length,
      medium: recentTasks.filter((t: any) => t.priority === P_MEDIUM).length,
      low: recentTasks.filter((t: any) => t.priority === P_LOW).length,
      highCompleted: recentTasks.filter((t: any) => t.priority === P_HIGH && t.status === S_DONE).length,
      mediumCompleted: recentTasks.filter((t: any) => t.priority === P_MEDIUM && t.status === S_DONE).length,
      lowCompleted: recentTasks.filter((t: any) => t.priority === P_LOW && t.status === S_DONE).length,
    };
    const prevPeriodStart = new Date(daysAgo.getTime() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
    let prevPeriodTasks = allTasks.filter((task: any) => {
      const d = new Date(task.createdAt); return d >= prevPeriodStart && d < daysAgo;
    });
    if (selectedUserId !== 'all') {
      prevPeriodTasks = prevPeriodTasks.filter((t: any) =>
        t.assignedTo?.id === selectedUserId || t.createdBy?.id === selectedUserId
      );
    }
    const prevTotal = prevPeriodTasks.length;
    const prevCompleted = prevPeriodTasks.filter((t: any) => t.status === S_DONE).length;
    const prevCompletionRate = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;
    const comparison = {
      totalDiff: total - prevTotal,
      totalPercent: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : (total > 0 ? 100 : 0),
      completedDiff: completed - prevCompleted,
      completedPercent: prevCompleted > 0 ? Math.round(((completed - prevCompleted) / prevCompleted) * 100) : (completed > 0 ? 100 : 0),
      rateDiff: completionRate - prevCompletionRate,
    };
    return { total, completed, inProgress, pending, overdue, completionRate, productivity, avgResolutionTime, trendData, userStats, priorityStats, comparison };
  }, [allTasks, allUsers, timeRange, selectedUserId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Cargando métricas...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-4" />
        <p className="text-destructive font-medium">Error al cargar las métricas</p>
        <p className="text-sm text-muted-foreground mt-1">Verificá la conexión e intentá de nuevo</p>
        <Button variant="outline" onClick={() => { refetchTasks(); refetchUsers(); }} className="mt-4">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Métricas y Reportes</h2>
          <p className="text-sm text-muted-foreground mt-1">Análisis de rendimiento y métricas de productividad</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
              <SelectItem value="90">90 días</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Usuario" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los usuarios</SelectItem>
              {usersWithTasks.map((user: any) => (
                <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Total Tareas" value={analytics.total} trendValue={`Período: ${timeRange} días`} icon={LayoutGrid} color={userColors.chart1} />
        <MetricCard title="Completadas" value={analytics.completed} trendValue={`${analytics.completionRate}% del total`} icon={CheckCircle2} color={userColors.kpiPositive} />
        <MetricCard title="En Progreso" value={analytics.inProgress} icon={Clock} color={userColors.chart2} />
        <MetricCard title="Pendientes" value={analytics.pending} trendValue={analytics.overdue > 0 ? `${analytics.overdue} vencidas` : undefined} icon={AlertTriangle} color={userColors.chart4} />
        <MetricCard title="Tiempo Promedio" value={`${analytics.avgResolutionTime}d`} trendValue="Para completar" icon={BarChart3} color={userColors.chart6} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Progreso General</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center pb-6">
            <CircularProgress percentage={analytics.completionRate} size={120} strokeWidth={8} color={userColors.chart1} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tendencia Semanal</CardTitle></CardHeader>
          <CardContent><SimpleLineChart data={analytics.trendData} title="" color={userColors.chart1} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Estados Actuales</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-primary rounded-full" /><span className="text-sm">Completadas</span></div>
              <span className="font-semibold">{analytics.completed}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-primary/60 rounded-full" /><span className="text-sm">En Progreso</span></div>
              <span className="font-semibold">{analytics.inProgress}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-muted-foreground rounded-full" /><span className="text-sm">Pendientes</span></div>
              <span className="font-semibold">{analytics.pending}</span>
            </div>
            {analytics.overdue > 0 && (
              <div className="flex items-center justify-between p-2 bg-destructive/10 rounded-md">
                <div className="flex items-center gap-2"><div className="w-2 h-2 bg-destructive rounded-full" /><span className="text-sm">Vencidas</span></div>
                <span className="font-semibold text-destructive">{analytics.overdue}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Distribución por Prioridad</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Alta', color: 'bg-destructive', stats: analytics.priorityStats.high, completed: analytics.priorityStats.highCompleted },
              { label: 'Media', color: 'bg-warning', stats: analytics.priorityStats.medium, completed: analytics.priorityStats.mediumCompleted },
              { label: 'Baja', color: 'bg-muted-foreground', stats: analytics.priorityStats.low, completed: analytics.priorityStats.lowCompleted },
            ].map(({ label, color, stats, completed: completedCount }) => (
              <div key={label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className={cn('w-2 h-2 rounded-full', color)} /><span className="text-sm font-medium">{label}</span></div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{completedCount}/{stats}</span>
                    <span className="text-xs text-muted-foreground">({stats > 0 ? Math.round((completedCount / stats) * 100) : 0}%)</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full transition-all duration-500', color)} style={{ width: `${stats > 0 ? (completedCount / stats) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total</span>
                <span className="text-muted-foreground">{analytics.priorityStats.high + analytics.priorityStats.medium + analytics.priorityStats.low} tareas</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">vs Período Anterior ({timeRange} días)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Total Tareas', value: analytics.total, diff: analytics.comparison.totalDiff, percent: analytics.comparison.totalPercent, suffix: '%' },
              { label: 'Completadas', value: analytics.completed, diff: analytics.comparison.completedDiff, percent: analytics.comparison.completedPercent, suffix: '%' },
              { label: 'Tasa de Completitud', value: `${analytics.completionRate}%`, diff: analytics.comparison.rateDiff, percent: analytics.comparison.rateDiff, suffix: 'pp' },
            ].map(({ label, value, diff, percent, suffix }) => (
              <div key={label} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium",
                  diff > 0 ? "bg-primary/10 text-primary" : diff < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                )}>
                  {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  <span>{diff > 0 ? '+' : ''}{percent}{suffix}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Actividad (últimos 3 meses)</CardTitle></CardHeader>
          <CardContent><HeatmapCalendar tasks={allTasks} color={userColors.chart1} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Usuarios Más Activos</CardTitle></CardHeader>
          <CardContent><UserRanking users={analytics.userStats} color={userColors.chart1} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Resumen</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{analytics.completionRate}%</div>
              <div className="text-sm font-medium mt-1">Tasa de Éxito</div>
              <div className="text-xs text-muted-foreground mt-1">{analytics.completionRate > 70 ? "Excelente rendimiento" : "Margen de mejora"}</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{analytics.productivity}</div>
              <div className="text-sm font-medium mt-1">Tareas/Semana</div>
              <div className="text-xs text-muted-foreground mt-1">Productividad promedio</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{analytics.userStats.length}</div>
              <div className="text-sm font-medium mt-1">Usuarios Activos</div>
              <div className="text-xs text-muted-foreground mt-1">Con tareas asignadas</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
