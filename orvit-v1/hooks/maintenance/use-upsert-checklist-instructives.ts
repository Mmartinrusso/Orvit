'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChecklistInstructive } from './use-checklist-instructives';

interface UpsertInstructivesRequest {
  checklistId: number;
  instructives: Array<{
    id?: number;
    title: string;
    content: string;
  }>;
}

interface UpsertInstructivesResponse {
  success: boolean;
  checklist: {
    instructives: ChecklistInstructive[];
  };
}

export function useUpsertChecklistInstructives() {
  const queryClient = useQueryClient();

  return useMutation<UpsertInstructivesResponse, Error, UpsertInstructivesRequest>({
    mutationFn: async ({ checklistId, instructives }) => {
      // Obtener el checklist actual para hacer PUT completo
      const getResponse = await fetch(`/api/maintenance/checklists/${checklistId}`);
      
      if (!getResponse.ok) {
        throw new Error(`Error obteniendo checklist: ${getResponse.status}`);
      }

      const currentData = await getResponse.json();
      
      if (!currentData.success) {
        throw new Error('Error obteniendo checklist actual');
      }

      // Actualizar solo los instructivos
      const updateResponse = await fetch(`/api/maintenance/checklists/${checklistId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...currentData.checklist,
          instructives: instructives.map((inst, index) => ({
            id: inst.id,
            title: inst.title,
            content: inst.content,
            order: index,
          })),
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${updateResponse.status}: ${updateResponse.statusText}`);
      }

      return updateResponse.json();
    },
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['checklist-detail', variables.checklistId] });
      queryClient.invalidateQueries({ queryKey: ['checklist-instructives', variables.checklistId] });
    },
  });
}

