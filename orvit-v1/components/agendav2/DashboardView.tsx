'use client';

import { useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ListTodo,
  Calendar,
  TrendingUp,
  PlayCircle,
  Send,
  FileText,
  FilePen,
  ClipboardPlus,
  Users,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format, isToday, parseISO, getHours } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AgendaTask, AgendaStats } from '@/lib/agenda/types';
import { isTaskOverdue, isTaskDueToday } from '@/lib/agenda/types';

interface DashboardViewProps {
  tasks: AgendaTask[];
  stats?: AgendaStats;
  isLoading?: boolean;
}

// Quick action cards
const QUICK_ACTIONS = [
  { label: 'Enviar reporte', icon: Send, color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400', border: 'border-violet-100 dark:border-violet-900/50' },
  { label: 'Borrador propuesta', icon: FilePen, color: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400', border: 'border-teal-100 dark:border-teal-900/50' },
  { label: 'Crear contrato', icon: FileText, color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-900/50' },
  { label: 'Agregar formulario', icon: ClipboardPlus, color: 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400', border: 'border-pink-100 dark:border-pink-900/50' },
];

// Mock team data
const MOCK_TEAM = [
  { name: 'Ana García', role: 'Diseño UI', tasks: 8, color: 'bg-violet-100 text-violet-700' },
  { name: 'Carlos López', role: 'Desarrollo', tasks: 12, color: 'bg-teal-100 text-teal-700' },
  { name: 'María Ruiz', role: 'QA & Testing', tasks: 5, color: 'bg-amber-100 text-amber-700' },
  { name: 'Pedro Torres', role: 'Producto', tasks: 7, color: 'bg-pink-100 text-pink-700' },
];

// Mock upcoming meetings
const MOCK_MEETINGS = [
  { title: 'Revisión semanal de sprint', time: '10:00', attendees: 4 },
  { title: 'Demo con cliente — Diseño', time: '14:30', attendees: 6 },
];

function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-28 bg-muted/30 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

export function DashboardView({ tasks, stats, isLoading }: DashboardViewProps) {
  // Compute local stats from tasks if API stats not available
  const localStats = useMemo<AgendaStats>(() => {
    if (stats) return stats;
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'PENDING').length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const waiting = tasks.filter(t => t.status === 'WAITING').length;
    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const cancelled = tasks.filter(t => t.status === 'CANCELLED').length;
    const overdue = tasks.filter(isTaskOverdue).length;
    const dueToday = tasks.filter(isTaskDueToday).length;
    const completedToday = tasks.filter(t =>
      t.status === 'COMPLETED' && t.completedAt && isToday(parseISO(t.completedAt))
    ).length;
    const urgentPending = tasks.filter(t => t.priority === 'URGENT' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;
    return { total, pending, inProgress, waiting, completed, cancelled, overdue, dueToday, completedToday, urgentPending, topAssignees: [] };
  }, [tasks, stats]);

  // KPI config
  const KPI_ITEMS = [
    {
      label: 'Total Tareas',
      value: localStats.total,
      detail: `${localStats.pending} pendientes`,
      icon: ListTodo,
      iconBg: 'bg-violet-50 dark:bg-violet-950/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      trend: '+12%',
    },
    {
      label: 'En Progreso',
      value: localStats.inProgress,
      detail: `${localStats.waiting} en revisión`,
      icon: PlayCircle,
      iconBg: 'bg-teal-50 dark:bg-teal-950/30',
      iconColor: 'text-teal-600 dark:text-teal-400',
      trend: '+5%',
    },
    {
      label: 'Completadas',
      value: localStats.completed,
      detail: `${localStats.completedToday} hoy`,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      trend: '+18%',
    },
    {
      label: 'Vencidas',
      value: localStats.overdue,
      detail: `${localStats.urgentPending} urgentes`,
      icon: AlertCircle,
      iconBg: 'bg-red-50 dark:bg-red-950/30',
      iconColor: 'text-red-500 dark:text-red-400',
      trend: '-3%',
      isNegative: true,
    },
  ];

  // Milestone Tracker data (tasks by status) — exact spec colors
  const milestoneData = [
    { name: 'Por hacer', target: localStats.pending + 4, actual: localStats.pending, color: '#E4E4E4' },
    { name: 'En progreso', target: localStats.inProgress + 2, actual: localStats.inProgress, color: '#ED7A20' },
    { name: 'Revisión', target: localStats.waiting + 1, actual: localStats.waiting, color: '#907840' },
    { name: 'Completado', target: localStats.completed, actual: localStats.completed, color: '#568177' },
  ];

  // Today's tasks
  const todayTasks = useMemo(() => {
    return tasks
      .filter(t => isTaskDueToday(t) && t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
      .slice(0, 5);
  }, [tasks]);

  // Recent tasks for activity feed
  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);
  }, [tasks]);

  // Time-based activity data (tasks grouped by hour of creation)
  const activityHours = useMemo(() => {
    const hours = [9, 10, 11, 12, 13, 14, 15, 16];
    return hours.map(h => ({
      hour: `${h}:00`,
      pending: tasks.filter(t => t.status === 'PENDING' && getHours(new Date(t.createdAt)) === h).length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS' && getHours(new Date(t.createdAt)) === h).length,
      completed: tasks.filter(t => t.status === 'COMPLETED' && getHours(new Date(t.createdAt)) === h).length,
    }));
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <KPISkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-64 bg-muted/30 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              className={cn(
                'flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all duration-150 hover:shadow-sm active:scale-[0.98]',
                'bg-white dark:bg-card',
                action.border
              )}
            >
              <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', action.color)}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="text-[12px] font-semibold text-zinc-700 dark:text-foreground leading-tight">{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_ITEMS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="border-zinc-100 dark:border-border/60 hover:shadow-sm transition-all duration-150 rounded-2xl bg-white dark:bg-card cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', kpi.iconBg)}>
                    <Icon className={cn('h-5 w-5', kpi.iconColor)} />
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                    kpi.isNegative
                      ? 'bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                  )}>
                    {kpi.trend}
                  </span>
                </div>
                <p className="text-2xl font-bold text-zinc-900 dark:text-foreground mb-0.5">{kpi.value}</p>
                <p className="text-[11px] text-zinc-400 dark:text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className="text-[11px] text-zinc-400 dark:text-muted-foreground mt-0.5">{kpi.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Time-Based Activity Map (takes 2 cols) */}
        <Card className="lg:col-span-2 border-zinc-100 dark:border-border/60 rounded-2xl bg-white dark:bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[13px] font-bold text-zinc-900 dark:text-foreground">Mapa de Actividad</CardTitle>
                <p className="text-[11px] text-zinc-400 mt-0.5">Distribución de tareas por horario</p>
              </div>
              <TrendingUp className="h-4 w-4 text-zinc-300" />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={activityHours} barSize={14} barGap={2}>
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: '#9C9CAA' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9C9CAA' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    border: '1px solid #e4e4e7',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    color: '#18181b',
                    boxShadow: '0 4px 16px rgba(0,0,0,.06)',
                  }}
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                />
                <Bar dataKey="pending" name="Por hacer" fill="#E4E4E4" radius={[3, 3, 0, 0]} />
                <Bar dataKey="inProgress" name="En progreso" fill="#ED7A20" radius={[3, 3, 0, 0]} />
                <Bar dataKey="completed" name="Completado" fill="#568177" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2">
              {[
                { color: '#E4E4E4', label: 'Por hacer' },
                { color: '#ED7A20', label: 'En progreso' },
                { color: '#568177', label: 'Completado' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div style={{ height: '8px', width: '8px', borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: '10px', color: '#9C9CAA' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Today's tasks */}
        <Card className="border-zinc-100 dark:border-border/60 rounded-2xl bg-white dark:bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[13px] font-bold text-zinc-900 dark:text-foreground">Tareas de hoy</CardTitle>
              <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                <Calendar className="h-3.5 w-3.5" />
                <span>{format(new Date(), 'd MMM', { locale: es })}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[180px]">
              {todayTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
                  <CheckCircle2 className="h-8 w-8 text-zinc-200 dark:text-muted-foreground/30 mb-2" />
                  <p className="text-[11px] text-zinc-400">No hay tareas para hoy</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-50 dark:divide-border/20">
                  {todayTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-zinc-50/80 dark:hover:bg-muted/20 transition-colors">
                      <div className={cn(
                        'h-1.5 w-1.5 rounded-full mt-1.5 shrink-0',
                        task.priority === 'URGENT' ? 'bg-red-500' :
                        task.priority === 'HIGH' ? 'bg-orange-400' :
                        task.priority === 'MEDIUM' ? 'bg-teal-400' : 'bg-zinc-300'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-zinc-800 dark:text-foreground truncate font-medium">{task.title}</p>
                        <p className="text-[10px] text-zinc-400">{task.category || 'Sin categoría'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Milestone Tracker (2 cols) */}
        <Card className="lg:col-span-2 border-zinc-100 dark:border-border/60 rounded-2xl bg-white dark:bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[13px] font-bold text-zinc-900 dark:text-foreground">Milestone Tracker</CardTitle>
                <p className="text-[11px] text-zinc-400 mt-0.5">Meta vs. avance real</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-300" />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={milestoneData} barSize={20} barGap={4} barCategoryGap="30%">
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#9C9CAA' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9C9CAA' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    border: '1px solid #e4e4e7',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    color: '#18181b',
                    boxShadow: '0 4px 16px rgba(0,0,0,.06)',
                  }}
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                />
                <Bar dataKey="target" name="Meta" radius={[4, 4, 0, 0]} fill="#e4e4e7" />
                <Bar dataKey="actual" name="Real" radius={[4, 4, 0, 0]}>
                  {milestoneData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <div style={{ height: '8px', width: '16px', borderRadius: '4px', background: '#E4E4E4' }} />
                <span style={{ fontSize: '10px', color: '#9C9CAA' }}>Meta</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div style={{ height: '8px', width: '16px', borderRadius: '4px', background: '#568177' }} />
                <span style={{ fontSize: '10px', color: '#9C9CAA' }}>Real</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right side: Team + Upcoming */}
        <div className="space-y-4">
          {/* Team */}
          <Card className="border-zinc-100 dark:border-border/60 rounded-2xl bg-white dark:bg-card">
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[13px] font-bold text-zinc-900 dark:text-foreground">Equipo</CardTitle>
                <Users className="h-3.5 w-3.5 text-zinc-300" />
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-3">
              <div className="divide-y divide-zinc-50 dark:divide-border/20">
                {MOCK_TEAM.map(member => {
                  const initials = member.name.split(' ').map(w => w[0]).join('').slice(0, 2);
                  return (
                    <div key={member.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50/80 transition-colors">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className={cn('text-[10px] font-bold', member.color)}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-zinc-800 dark:text-foreground truncate">{member.name}</p>
                        <p className="text-[10px] text-zinc-400">{member.role}</p>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400 shrink-0">{member.tasks} tareas</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Meetings */}
          <Card className="border-zinc-100 dark:border-border/60 rounded-2xl bg-white dark:bg-card">
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[13px] font-bold text-zinc-900 dark:text-foreground">Próximas reuniones</CardTitle>
                <Clock className="h-3.5 w-3.5 text-zinc-300" />
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-3">
              <div className="space-y-2 px-4">
                {MOCK_MEETINGS.map(meeting => (
                  <div key={meeting.title} className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-muted/30 hover:bg-zinc-100/80 transition-colors">
                    <div className="h-8 w-8 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
                      <Calendar className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-zinc-800 dark:text-foreground leading-tight">{meeting.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-400">{meeting.time}</span>
                        <span className="text-[10px] text-zinc-300">·</span>
                        <span className="text-[10px] text-zinc-400">{meeting.attendees} participantes</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="border-zinc-100 dark:border-border/60 rounded-2xl bg-white dark:bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] font-bold text-zinc-900 dark:text-foreground">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-zinc-50 dark:divide-border/20">
            {recentTasks.slice(0, 5).map(task => {
              const overdue = isTaskOverdue(task);
              return (
                <div key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50/80 dark:hover:bg-muted/20 transition-colors">
                  <div className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    task.status === 'COMPLETED' ? 'bg-emerald-400' :
                    task.status === 'IN_PROGRESS' ? 'bg-teal-400' :
                    task.status === 'WAITING' ? 'bg-amber-400' :
                    overdue ? 'bg-red-400' : 'bg-zinc-300'
                  )} />

                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-zinc-800 dark:text-foreground truncate font-medium">{task.title}</p>
                    <p className="text-[10px] text-zinc-400">
                      {task.category || 'Sin categoría'} · {task.assignedToName || task.createdBy.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {overdue && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400">
                        Vencida
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="text-[11px] text-zinc-400">
                        {format(parseISO(task.dueDate), 'd MMM', { locale: es })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
