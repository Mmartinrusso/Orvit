import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { QuickActionRequest, TaskResponse } from '../api/types';

export function useQuickAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: QuickActionRequest): Promise<TaskResponse> => {
      const { data } = await apiClient.post('/api/task/quick', request);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-history'] });
    },
  });
}
