'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import {
  fetchAgendaTasks,
  createAgendaTask,
  updateAgendaTask,
  deleteAgendaTask,
  fetchAgendaStats,
} from '@/lib/agenda/api';
import type {
  AgendaTask,
  AgendaStats,
  AgendaTaskFilters,
  CreateAgendaTaskInput,
  UpdateAgendaTaskInput,
} from '@/lib/agenda/types';

const TASKS_KEY = 'agenda-tasks';
const STATS_KEY = 'agenda-stats';

/**
 * Hook para gestionar tareas de agenda
 */
export function useAgendaTasks(filters?: AgendaTaskFilters) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  return useQuery<AgendaTask[]>({
    queryKey: [TASKS_KEY, companyId, filters],
    queryFn: () => fetchAgendaTasks(companyId!, filters),
    enabled: !!companyId,
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para estadísticas de agenda
 */
export function useAgendaStats() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  return useQuery<AgendaStats>({
    queryKey: [STATS_KEY, companyId],
    queryFn: () => fetchAgendaStats(companyId!),
    enabled: !!companyId,
    staleTime: 60000, // 1 minuto
    refetchInterval: 60000, // Refrescar cada minuto
  });
}

/**
 * Hook para crear tarea
 */
export function useCreateAgendaTask() {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  return useMutation({
    mutationFn: (data: CreateAgendaTaskInput) => createAgendaTask(companyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
      queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    },
  });
}

/**
 * Hook para actualizar tarea
 */
export function useUpdateAgendaTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: UpdateAgendaTaskInput }) =>
      updateAgendaTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
      queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    },
  });
}

/**
 * Hook para eliminar tarea
 */
export function useDeleteAgendaTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => deleteAgendaTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
      queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    },
  });
}

/**
 * Hook combinado para todas las operaciones de agenda
 */
export function useAgenda(filters?: AgendaTaskFilters) {
  const tasksQuery = useAgendaTasks(filters);
  const statsQuery = useAgendaStats();
  const createMutation = useCreateAgendaTask();
  const updateMutation = useUpdateAgendaTask();
  const deleteMutation = useDeleteAgendaTask();

  return {
    // Data
    tasks: tasksQuery.data || [],
    stats: statsQuery.data,

    // Loading states
    isLoading: tasksQuery.isLoading,
    isStatsLoading: statsQuery.isLoading,

    // Error states
    error: tasksQuery.error,
    statsError: statsQuery.error,

    // Refetch
    refetch: tasksQuery.refetch,
    refetchStats: statsQuery.refetch,

    // Mutations
    createTask: createMutation.mutateAsync,
    updateTask: (taskId: number, data: UpdateAgendaTaskInput) =>
      updateMutation.mutateAsync({ taskId, data }),
    deleteTask: deleteMutation.mutateAsync,

    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
