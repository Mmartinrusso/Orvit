import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api';
import type { KnowledgeBaseUpdateRequest } from '@/api/types';

// ===========================================
// Knowledge Base
// ===========================================

/**
 * Get the current knowledge base
 */
export function useKnowledgeBase() {
  return useQuery({
    queryKey: ['knowledge-base'],
    queryFn: () => settingsApi.getKnowledgeBase(),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Update the knowledge base
 */
export function useUpdateKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: KnowledgeBaseUpdateRequest) => settingsApi.updateKnowledgeBase(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    },
  });
}

/**
 * Delete/deactivate the knowledge base
 */
export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => settingsApi.deleteKnowledgeBase(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    },
  });
}
