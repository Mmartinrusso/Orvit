'use client';

import { useMemo } from 'react';
import { useAgenda } from '@/hooks/use-agenda-tasks';
import { useTaskStore } from '@/hooks/use-task-store';
import type { AgendaTaskFilters } from '@/lib/agenda/types';
import type {
  UnifiedTask,
  UnifiedTaskOrigin,
  UnifiedTaskStatus,
  UnifiedTaskPriority,
} from '@/types/unified-task';
import {
  mapAgendaToUnified,
  mapRegularToUnified,
  isUnifiedTaskOverdue,
  isUnifiedTaskDueToday,
} from '@/types/unified-task';

export type OriginFilter = 'all' | 'agenda' | 'regular';

interface UseUnifiedTasksOptions {
  originFilter?: OriginFilter;
  statusFilter?: UnifiedTaskStatus | 'all';
  priorityFilter?: UnifiedTaskPriority | 'all';
  searchTerm?: string;
  showOnlyOverdue?: boolean;
  showOnlyToday?: boolean;
  selectedPerson?: string | null;
}

interface UnifiedTasksReturn {
  // Todas las tareas unificadas (ya filtradas)
  tasks: UnifiedTask[];

  // Loading
  isLoading: boolean;

  // Stats
  stats: {
    total: number;
    overdue: number;
    today: number;
    urgent: number;
    completedToday: number;
    agendaCount: number;
    regularCount: number;
  };

  // Refetch
  refetch: () => void;

  // Acceso a hooks originales para mutaciones
  agenda: ReturnType<typeof useAgenda>;
  taskStore: ReturnType<typeof useTaskStore>;
}

export function useUnifiedTasks(options: UseUnifiedTasksOptions = {}): UnifiedTasksReturn {
  const {
    originFilter = 'all',
    statusFilter = 'all',
    priorityFilter = 'all',
    searchTerm = '',
    showOnlyOverdue = false,
    showOnlyToday = false,
    selectedPerson = null,
  } = options;

  // Construir filtros para agenda API
  const agendaApiFilters: AgendaTaskFilters = useMemo(() => ({
    search: searchTerm || undefined,
  }), [searchTerm]);

  // Hook de agenda
  const agenda = useAgenda(agendaApiFilters);

  // Hook de tareas regulares (Zustand store)
  const taskStore = useTaskStore();

  // Mapear y combinar todas las tareas
  const allUnifiedTasks = useMemo(() => {
    const unified: UnifiedTask[] = [];

    // Mapear agenda tasks (normalizar por si viene undefined/null/objeto)
    if (originFilter === 'all' || originFilter === 'agenda') {
      const agendaTasks = Array.isArray(agenda?.tasks) ? agenda.tasks : [];
      agendaTasks.forEach(t => {
        unified.push(mapAgendaToUnified(t));
      });
    }

    // Mapear regular tasks (normalizar por si viene undefined/null/objeto)
    if (originFilter === 'all' || originFilter === 'regular') {
      const regularTasks = Array.isArray(taskStore?.tasks) ? taskStore.tasks : [];
      regularTasks.forEach(t => {
        unified.push(mapRegularToUnified(t));
      });
    }

    return unified;
  }, [agenda.tasks, taskStore.tasks, originFilter]);

  // Filtrar
  const filteredTasks = useMemo(() => {
    let result = allUnifiedTasks;

    // Filtrar por estado
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    // Filtrar por prioridad
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    // Filtrar por persona
    if (selectedPerson) {
      result = result.filter(t => t.assigneeName === selectedPerson);
    }

    // Filtrar solo vencidas
    if (showOnlyOverdue) {
      result = result.filter(t => isUnifiedTaskOverdue(t));
    }

    // Filtrar solo hoy
    if (showOnlyToday) {
      result = result.filter(t => isUnifiedTaskDueToday(t));
    }

    // Búsqueda local
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.assigneeName.toLowerCase().includes(term)
      );
    }

    // Ordenar: vencidas primero, luego por prioridad, luego por fecha
    result.sort((a, b) => {
      const aOverdue = isUnifiedTaskOverdue(a);
      const bOverdue = isUnifiedTaskOverdue(b);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      const priorityOrder: Record<UnifiedTaskPriority, number> = {
        urgent: 0, high: 1, medium: 2, low: 3,
      };
      const priDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priDiff !== 0) return priDiff;

      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [allUnifiedTasks, statusFilter, priorityFilter, selectedPerson, showOnlyOverdue, showOnlyToday, searchTerm]);

  // Stats calculadas sobre todas las tareas (sin filtros de UI)
  const stats = useMemo(() => {
    const today = new Date();
    const activeStatuses: UnifiedTaskStatus[] = ['pending', 'in_progress', 'waiting'];

    const active = allUnifiedTasks.filter(t => activeStatuses.includes(t.status));
    const overdue = active.filter(t => isUnifiedTaskOverdue(t));
    const todayTasks = allUnifiedTasks.filter(t => isUnifiedTaskDueToday(t));
    const urgent = active.filter(t => t.priority === 'urgent' || t.priority === 'high');
    const completedToday = allUnifiedTasks.filter(t => {
      if (t.status !== 'completed') return false;
      // Checkear si fue completada hoy
      if (t.originalAgendaTask?.completedAt) {
        const d = new Date(t.originalAgendaTask.completedAt);
        return d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate();
      }
      return false;
    });

    return {
      total: allUnifiedTasks.length,
      overdue: overdue.length,
      today: todayTasks.length,
      urgent: urgent.length,
      completedToday: completedToday.length,
      agendaCount: allUnifiedTasks.filter(t => t.origin === 'agenda').length,
      regularCount: allUnifiedTasks.filter(t => t.origin === 'regular').length,
    };
  }, [allUnifiedTasks]);

  // Refetch combinado
  const refetch = () => {
    agenda.refetch();
    taskStore.fetchTasks();
  };

  return {
    tasks: filteredTasks,
    isLoading: agenda.isLoading || taskStore.isLoading,
    stats,
    refetch,
    agenda,
    taskStore,
  };
}
