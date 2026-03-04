'use client';

import { FolderKanban, Folder, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressRing } from './ProgressRing';
import type { AgendaTask } from '@/lib/agenda/types';

interface TaskGroupItem {
  id: number;
  name: string;
  color?: string | null;
  isProject: boolean;
  _count?: { tasks: number };
}

interface PortfolioMobileProps {
  groups: TaskGroupItem[];
  tasks: AgendaTask[];
  onSelectGroup: (groupId: number) => void;
  onCreateGroup: () => void;
  loadingGroups?: boolean;
}

export function PortfolioMobile({ groups, tasks, onSelectGroup, onCreateGroup, loadingGroups }: PortfolioMobileProps) {
  const getGroupStats = (groupId: number) => {
    const groupTasks = tasks.filter((t) => t.groupId === groupId && !t.isArchived);
    const total = groupTasks.length;
    const completed = groupTasks.filter((t) => t.status === 'COMPLETED').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  };

  const allActiveTasks = tasks.filter((t) => !t.isArchived);
  const allCompletedTasks = allActiveTasks.filter((t) => t.status === 'COMPLETED');
  const completionRate = allActiveTasks.length > 0
    ? Math.round((allCompletedTasks.length / allActiveTasks.length) * 100)
    : 0;

  const projects = groups.filter((g) => g.isProject);
  const simpleGroups = groups.filter((g) => !g.isProject);

  return (
    <div className="px-4 pt-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Portfolio</h2>
        <button
          onClick={onCreateGroup}
          className="flex items-center gap-1 text-sm font-medium text-primary active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      {/* Summary card */}
      <div className="bg-card rounded-xl p-4 border border-border mb-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold text-foreground">{groups.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Grupos</p>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{allActiveTasks.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Tareas</p>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{completionRate}%</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Completado</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {loadingGroups ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Folder className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Sin grupos</p>
          <p className="mt-1 text-xs text-muted-foreground mb-4">Crea tu primer grupo o proyecto</p>
          <button
            onClick={onCreateGroup}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" />
            Crear grupo
          </button>
        </div>
      ) : (
        <>
          {/* Projects section */}
          {projects.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Proyectos
              </p>
              <div className="space-y-2">
                {projects.map((group) => {
                  const stats = getGroupStats(group.id);
                  return (
                    <button
                      key={group.id}
                      onClick={() => onSelectGroup(group.id)}
                      className="w-full bg-card rounded-xl border border-border p-3.5 text-left active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: group.color ?? undefined }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{group.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {stats.total} tarea{stats.total !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <ProgressRing percent={stats.pct} size={28} strokeWidth={2.5} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Simple groups section */}
          {simpleGroups.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Grupos
              </p>
              <div className="space-y-2">
                {simpleGroups.map((group) => {
                  const stats = getGroupStats(group.id);
                  return (
                    <button
                      key={group.id}
                      onClick={() => onSelectGroup(group.id)}
                      className="w-full bg-card rounded-xl border border-border p-3.5 text-left active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: group.color ?? undefined }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{group.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {stats.total} tarea{stats.total !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <ProgressRing percent={stats.pct} size={28} strokeWidth={2.5} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
