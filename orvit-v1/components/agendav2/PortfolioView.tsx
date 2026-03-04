'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Users, Plus, CheckCircle2, Clock, Circle, ChevronRight, ChevronDown,
  Briefcase, BarChart2, ArrowRight, AlertCircle, TrendingUp, PlayCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { AgendaTask } from '@/lib/agenda/types';
import type { TaskGroupItem } from './AgendaV2Sidebar';
import { PortfolioViewSkeleton } from './TaskCardSkeleton';

// ── Design tokens ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING:     '#9CA3AF',
  IN_PROGRESS: '#7C3AED',
  WAITING:     '#D97706',
  COMPLETED:   '#059669',
  CANCELLED:   '#ED8A94',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:     'Pendiente',
  IN_PROGRESS: 'En progreso',
  WAITING:     'Esperando',
  COMPLETED:   'Completada',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function fadeStyle(mounted: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(10px)',
    transition: `opacity 350ms ease ${delay}ms, transform 350ms ease ${delay}ms`,
  };
}

function getAssigneeName(t: AgendaTask): string {
  return t.assignedToUser?.name || t.assignedToContact?.name || t.assignedToName || 'Sin asignar';
}

function getGroupStats(tasks: AgendaTask[]) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'COMPLETED').length;
  const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const pending = tasks.filter(t => t.status === 'PENDING').length;
  const waiting = tasks.filter(t => t.status === 'WAITING').length;
  const overdue = tasks.filter(t => {
    if (!t.dueDate || t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
    return new Date(t.dueDate) < new Date();
  }).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, inProgress, pending, waiting, overdue, pct };
}

function getMemberBreakdown(tasks: AgendaTask[]) {
  const map = new Map<string, { name: string; avatar?: string; total: number; completed: number }>();
  for (const t of tasks) {
    const name = getAssigneeName(t);
    const key = String(t.assignedToUserId ?? t.assignedToContactId ?? name);
    const existing = map.get(key) || { name, avatar: t.assignedToUser?.avatar, total: 0, completed: 0 };
    existing.total++;
    if (t.status === 'COMPLETED') existing.completed++;
    map.set(key, existing);
  }
  return Array.from(map.values())
    .filter(m => m.name !== 'Sin asignar')
    .sort((a, b) => b.total - a.total);
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, accent, animStyle,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
  animStyle?: React.CSSProperties;
}) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm"
      style={animStyle}
    >
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accent}18` }}
      >
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-[22px] font-extrabold text-foreground leading-none mt-0.5 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ── Expanded Stats Panel ──────────────────────────────────────────────────────

function GroupStatsPanel({
  group,
  tasks,
  onViewTasks,
}: {
  group: TaskGroupItem;
  tasks: AgendaTask[];
  onViewTasks: () => void;
}) {
  const stats = getGroupStats(tasks);
  const members = getMemberBreakdown(tasks);

  const statusItems = [
    { key: 'COMPLETED', label: 'Completadas', count: stats.completed, color: STATUS_COLORS.COMPLETED, icon: CheckCircle2 },
    { key: 'IN_PROGRESS', label: 'En progreso', count: stats.inProgress, color: STATUS_COLORS.IN_PROGRESS, icon: PlayCircle },
    { key: 'PENDING', label: 'Pendientes', count: stats.pending, color: STATUS_COLORS.PENDING, icon: Circle },
    { key: 'WAITING', label: 'Esperando', count: stats.waiting, color: STATUS_COLORS.WAITING, icon: Clock },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm animate-in slide-in-from-top-2 duration-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Status distribution */}
        <div>
          <h4 className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Distribución de estado
          </h4>
          {/* Stacked bar */}
          {stats.total > 0 && (
            <div className="h-2.5 rounded-full overflow-hidden flex mb-3">
              {statusItems.map(s => {
                const w = (s.count / stats.total) * 100;
                if (w === 0) return null;
                return <div key={s.key} style={{ width: `${w}%`, backgroundColor: s.color }} />;
              })}
            </div>
          )}
          <div className="space-y-2">
            {statusItems.map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <s.icon className="h-3.5 w-3.5 shrink-0" style={{ color: s.color }} />
                <span className="text-[12px] text-muted-foreground flex-1">{s.label}</span>
                <span className="text-[13px] font-bold text-foreground tabular-nums">{s.count}</span>
              </div>
            ))}
          </div>
          {stats.overdue > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
              <span className="text-[12px] text-red-500 font-semibold flex-1">Vencidas</span>
              <span className="text-[13px] font-bold text-red-500 tabular-nums">{stats.overdue}</span>
            </div>
          )}
        </div>

        {/* Member breakdown */}
        <div className="md:col-span-2">
          <h4 className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Por miembro
          </h4>
          {members.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Sin miembros asignados</p>
          ) : (
            <div className="space-y-2.5">
              {members.slice(0, 6).map((m) => {
                const pct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                return (
                  <div key={m.name} className="flex items-center gap-3">
                    <Avatar className="h-6 w-6 shrink-0">
                      {m.avatar && <AvatarImage src={m.avatar} />}
                      <AvatarFallback
                        className="text-[8px] font-bold"
                        style={{ backgroundColor: `${group.color}25`, color: group.color }}
                      >
                        {getInitials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[12px] font-medium text-foreground truncate">{m.name}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums ml-2 shrink-0">
                          {m.completed}/{m.total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: group.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {members.length > 6 && (
                <p className="text-[11px] text-muted-foreground">+{members.length - 6} más</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
          <span><span className="font-bold text-foreground tabular-nums">{stats.pct}%</span> completado</span>
          <span><span className="font-bold text-foreground tabular-nums">{stats.total}</span> tareas</span>
        </div>
        <button
          onClick={onViewTasks}
          className="flex items-center gap-1.5 text-[12px] font-semibold transition-colors hover:opacity-80"
          style={{ color: group.color }}
        >
          Ver tareas
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

function ProjectCard({
  group,
  tasks,
  isExpanded,
  onToggle,
  animStyle,
}: {
  group: TaskGroupItem;
  tasks: AgendaTask[];
  isExpanded: boolean;
  onToggle: () => void;
  animStyle?: React.CSSProperties;
}) {
  const stats = getGroupStats(tasks);

  return (
    <div
      onClick={onToggle}
      className={cn(
        'bg-card border rounded-2xl p-5 cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        isExpanded
          ? 'ring-2 shadow-md'
          : 'border-border hover:border-border',
      )}
      style={{
        ...(isExpanded ? { borderColor: `${group.color}50`, ringColor: `${group.color}40` } : {}),
        ...animStyle,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border"
            style={{
              backgroundColor: `${group.color}15`,
              borderColor: `${group.color}30`,
            }}
          >
            <Briefcase className="h-4 w-4" style={{ color: group.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-foreground truncate">{group.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.total} tarea{stats.total !== 1 ? 's' : ''}
              {stats.overdue > 0 && (
                <span className="text-red-500 font-semibold"> · {stats.overdue} vencida{stats.overdue !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
        </div>

        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0',
          isExpanded ? 'bg-muted' : 'hover:bg-muted',
        )}>
          {isExpanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Progress bar + percentage */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[20px] font-extrabold" style={{ color: group.color }}>{stats.pct}%</span>
          <span className="text-[11px] text-muted-foreground">{stats.completed}/{stats.total}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${stats.pct}%`, backgroundColor: group.color }}
          />
        </div>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-1.5 mb-3">
        {[
          { label: 'Comp.', count: stats.completed, color: STATUS_COLORS.COMPLETED },
          { label: 'Prog.', count: stats.inProgress, color: STATUS_COLORS.IN_PROGRESS },
          { label: 'Pend.', count: stats.pending, color: STATUS_COLORS.PENDING },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/50">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
            <span className="text-[10px] font-bold text-foreground tabular-nums">{s.count}</span>
          </div>
        ))}
      </div>

      {/* Members */}
      <div className="flex items-center justify-between">
        {group.members.length > 0 ? (
          <div className="flex items-center">
            {group.members.slice(0, 4).map((m, i) => (
              <Avatar
                key={m.userId}
                className="h-6 w-6 border-2 border-card"
                style={{ marginLeft: i === 0 ? 0 : '-6px', zIndex: group.members.length - i }}
              >
                {m.user.avatar && <AvatarImage src={m.user.avatar} />}
                <AvatarFallback
                  className="text-[8px] font-bold"
                  style={{ backgroundColor: `${group.color}25`, color: group.color }}
                >
                  {getInitials(m.user.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {group.members.length > 4 && (
              <div
                className="flex items-center justify-center h-6 w-6 rounded-full bg-muted border-2 border-card text-[8px] font-bold text-muted-foreground"
                style={{ marginLeft: '-6px' }}
              >
                +{group.members.length - 4}
              </div>
            )}
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              {group.members.length} miembro{group.members.length !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="text-[10px] text-muted-foreground/40">Sin miembros</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SimpleGroupCard (for non-project groups) ──────────────────────────────────

function SimpleGroupCard({
  group,
  tasks,
  isExpanded,
  onToggle,
  animStyle,
}: {
  group: TaskGroupItem;
  tasks: AgendaTask[];
  isExpanded: boolean;
  onToggle: () => void;
  animStyle?: React.CSSProperties;
}) {
  const stats = getGroupStats(tasks);

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full text-left bg-card border rounded-xl px-4 py-3 cursor-pointer',
        'transition-all duration-150 flex items-center gap-3',
        'hover:bg-muted/50',
        isExpanded ? 'border-border ring-1' : 'border-border',
      )}
      style={{
        ...(isExpanded ? { ringColor: `${group.color}40` } : {}),
        ...animStyle,
      }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: group.color }}
      />
      <span className="text-[13px] font-semibold text-foreground flex-1 truncate">{group.name}</span>
      <div className="flex items-center gap-2">
        <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${stats.pct}%`, backgroundColor: group.color }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums min-w-[28px] text-right">{stats.total}</span>
      </div>
      {isExpanded
        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      }
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PortfolioViewProps {
  groups: TaskGroupItem[];
  tasks: AgendaTask[];
  onSelectGroup: (id: number) => void;
  onCreateGroup: (isProject: boolean) => void;
  loadingGroups?: boolean;
}

export function PortfolioView({
  groups,
  tasks,
  onSelectGroup,
  onCreateGroup,
  loadingGroups,
}: PortfolioViewProps) {
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const projects     = groups.filter(g => g.isProject);
  const simpleGroups = groups.filter(g => !g.isProject);

  function tasksForGroup(groupId: number): AgendaTask[] {
    return tasks.filter(t => t.groupId === groupId);
  }

  // Summary metrics
  const summary = useMemo(() => {
    const totalTasks   = tasks.length;
    const completedAll = tasks.filter(t => t.status === 'COMPLETED').length;
    const inProgressAll = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const overdueAll   = tasks.filter(t => {
      if (!t.dueDate || t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
      return new Date(t.dueDate) < new Date();
    }).length;
    const completionRate = totalTasks > 0 ? Math.round((completedAll / totalTasks) * 100) : 0;
    return { totalTasks, completedAll, inProgressAll, overdueAll, completionRate };
  }, [tasks]);

  const toggleExpanded = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (loadingGroups) {
    return <PortfolioViewSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Summary KPI bar ──────────────────────────────────────────── */}
      {groups.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3" style={fadeStyle(mounted, 0)}>
          <KpiCard
            label="Proyectos"
            value={projects.length}
            icon={Briefcase}
            accent="#7C3AED"
            animStyle={fadeStyle(mounted, 0)}
          />
          <KpiCard
            label="Tareas totales"
            value={summary.totalTasks}
            icon={BarChart2}
            accent="#3070A8"
            animStyle={fadeStyle(mounted, 50)}
          />
          <KpiCard
            label="Completadas"
            value={summary.completedAll}
            icon={CheckCircle2}
            accent="#059669"
            animStyle={fadeStyle(mounted, 100)}
          />
          <KpiCard
            label="En progreso"
            value={summary.inProgressAll}
            icon={PlayCircle}
            accent="#7C3AED"
            animStyle={fadeStyle(mounted, 150)}
          />
          <KpiCard
            label="Vencidas"
            value={summary.overdueAll}
            icon={AlertCircle}
            accent={summary.overdueAll > 0 ? '#C05060' : '#9CA3AF'}
            animStyle={fadeStyle(mounted, 200)}
          />
        </div>
      )}

      {/* ── Completion rate bar ──────────────────────────────────────── */}
      {groups.length > 0 && summary.totalTasks > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm" style={fadeStyle(mounted, 220)}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                Progreso general
              </span>
            </div>
            <span className="text-[18px] font-extrabold text-foreground tabular-nums">{summary.completionRate}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${summary.completionRate}%`,
                background: 'linear-gradient(90deg, #059669, #10b981)',
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
            <span>{summary.completedAll} completadas</span>
            <span>{summary.totalTasks - summary.completedAll} restantes</span>
          </div>
        </div>
      )}

      {/* ── Projects ──────────────────────────────────────────────── */}
      <div style={fadeStyle(mounted, 260)}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Proyectos</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {projects.length} proyecto{projects.length !== 1 ? 's' : ''} activo{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => onCreateGroup(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12px] font-semibold bg-foreground text-background hover:opacity-85 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo proyecto
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-muted/30 border-2 border-dashed border-border rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">Sin proyectos aún</p>
            <p className="text-[11px] text-muted-foreground mt-1 mb-4">
              Creá tu primer proyecto para colaborar con tu equipo
            </p>
            <button
              onClick={() => onCreateGroup(true)}
              className="px-5 py-2.5 rounded-[10px] text-[12px] font-semibold bg-foreground text-background hover:opacity-85 transition-opacity"
            >
              + Crear proyecto
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {projects.map((group, i) => (
                <ProjectCard
                  key={group.id}
                  group={group}
                  tasks={tasksForGroup(group.id)}
                  isExpanded={expandedId === group.id}
                  onToggle={() => toggleExpanded(group.id)}
                  animStyle={fadeStyle(mounted, 300 + i * 60)}
                />
              ))}
              {/* New project card */}
              <button
                onClick={() => onCreateGroup(true)}
                className="bg-transparent border-2 border-dashed border-border rounded-2xl p-5 cursor-pointer flex flex-col items-center justify-center gap-2 min-h-[180px] transition-all hover:border-muted-foreground/30 hover:bg-muted/30"
                style={fadeStyle(mounted, 300 + projects.length * 60)}
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-[12px] font-semibold text-muted-foreground">Nuevo proyecto</span>
              </button>
            </div>

            {/* Expanded stats panel */}
            {expandedId !== null && projects.find(p => p.id === expandedId) && (
              <GroupStatsPanel
                group={projects.find(p => p.id === expandedId)!}
                tasks={tasksForGroup(expandedId)}
                onViewTasks={() => onSelectGroup(expandedId)}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Groups ────────────────────────────────────────────────── */}
      {simpleGroups.length > 0 && (
        <div style={fadeStyle(mounted, 360)}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-foreground">Grupos</h2>
            <button
              onClick={() => onCreateGroup(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Nuevo grupo
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {simpleGroups.map((group, i) => (
              <div key={group.id}>
                <SimpleGroupCard
                  group={group}
                  tasks={tasksForGroup(group.id)}
                  isExpanded={expandedId === group.id}
                  onToggle={() => toggleExpanded(group.id)}
                  animStyle={fadeStyle(mounted, 400 + i * 40)}
                />
                {expandedId === group.id && (
                  <div className="mt-2 ml-5">
                    <GroupStatsPanel
                      group={group}
                      tasks={tasksForGroup(group.id)}
                      onViewTasks={() => onSelectGroup(group.id)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no groups at all */}
      {groups.length === 0 && (
        <div className="text-center py-6" style={fadeStyle(mounted, 100)}>
          <p className="text-[13px] text-muted-foreground">
            Creá grupos y proyectos desde el sidebar para verlos aquí
          </p>
        </div>
      )}
    </div>
  );
}
