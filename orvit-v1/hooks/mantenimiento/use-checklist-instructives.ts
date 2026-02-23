'use client';

import { useQuery } from '@tanstack/react-query';

export interface ChecklistInstructive {
  id: number;
  checklistId: number;
  title: string;
  content: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ChecklistInstructivesResponse {
  success: boolean;
  checklist: {
    instructives: ChecklistInstructive[];
  };
}

export function useChecklistInstructives(checklistId: number | null | undefined) {
  return useQuery<ChecklistInstructive[]>({
    queryKey: ['checklist-instructives', checklistId],
    queryFn: async () => {
      if (!checklistId) {
        throw new Error('checklistId es requerido');
      }

      const response = await fetch(`/api/maintenance/checklists/${checklistId}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data: ChecklistInstructivesResponse = await response.json();
      
      if (!data.success || !data.checklist.instructives) {
        return [];
      }

      return data.checklist.instructives.map((inst: any) => ({
        id: inst.id,
        checklistId: checklistId,
        title: inst.title || '',
        content: inst.content || '',
        order: inst.order ?? 0,
        createdAt: inst.createdAt,
        updatedAt: inst.updatedAt,
      }));
    },
    enabled: !!checklistId,
    staleTime: 30 * 1000, // 30s cache
    refetchOnWindowFocus: false,
  });
}

