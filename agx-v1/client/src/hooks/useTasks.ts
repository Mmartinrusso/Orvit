import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/api';
import type { TaskRequest, EnhancePromptRequest } from '@/api';

export function useTaskHistory(limit: number = 50) {
  return useQuery({
    queryKey: ['tasks', 'history', limit],
    queryFn: () => tasksApi.getHistory(limit),
    staleTime: 30_000, // 30 seconds
  });
}

// Alias for useTaskHistory
export const useTasks = useTaskHistory;

export function useTaskDetails(taskId: string) {
  return useQuery({
    queryKey: ['tasks', taskId],
    queryFn: () => tasksApi.getById(taskId),
    enabled: !!taskId,
  });
}

export function useActiveTasks(enabled: boolean = true) {
  return useQuery({
    queryKey: ['tasks', 'active'],
    queryFn: () => tasksApi.getActive(),
    // Polling as backup - SSE handles real-time updates via query invalidation
    refetchInterval: enabled ? 30_000 : false, // Reduced from 5s to 30s
    refetchIntervalInBackground: false,
  });
}

export function useQueuedTasks(enabled: boolean = true) {
  return useQuery({
    queryKey: ['tasks', 'queue'],
    queryFn: () => tasksApi.getQueue(),
    // Polling as backup - SSE handles real-time updates via query invalidation
    refetchInterval: enabled ? 30_000 : false, // Reduced from 5s to 30s
    refetchIntervalInBackground: false,
  });
}

export function useTaskStats(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['tasks', 'stats', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => tasksApi.getStats(startDate, endDate),
    staleTime: 60_000, // 1 minute
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TaskRequest) => tasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCancelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.cancel(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'queue'] });
    },
  });
}

export function useRetryTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.retry(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Hook to get live logs for an active task
 * @deprecated Use useTaskSSE hook instead for real-time updates
 * Kept for fallback scenarios where SSE is not available
 */
export function useTaskLiveLogs(taskId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['tasks', 'logs', taskId],
    queryFn: () => tasksApi.getLiveLogs(taskId),
    enabled: enabled && !!taskId,
    refetchInterval: enabled ? 10_000 : false, // Reduced from 2s to 10s - SSE is primary
    refetchIntervalInBackground: false,
  });
}

export function useEnhancePrompt() {
  return useMutation({
    mutationFn: (data: EnhancePromptRequest) => tasksApi.enhancePrompt(data),
  });
}

export function useInterruptedTasks() {
  return useQuery({
    queryKey: ['tasks', 'interrupted'],
    queryFn: () => tasksApi.getInterrupted(),
    staleTime: 60_000,
  });
}

export function useDismissTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.dismiss(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'interrupted'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
