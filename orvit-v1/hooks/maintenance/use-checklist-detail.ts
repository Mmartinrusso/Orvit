'use client';

import { useQuery } from '@tanstack/react-query';

interface ChecklistDetailResponse {
  success: boolean;
  checklist: {
    id: number;
    title: string;
    description: string | null;
    frequency: string;
    category: string;
    isActive: boolean;
    estimatedTotalTime: number;
    machineId: number | null;
    sectorId: number | null;
    companyId: number;
    items: Array<{
      id: string;
      estimatedTime?: number;
      phaseId?: string;
    }>;
    phases: Array<{
      id: string;
      name: string;
      items: Array<{
        id: string;
        estimatedTime?: number;
      }>;
    }>;
    sector: {
      id: number;
      name: string;
      description?: string;
    } | null;
    machine: {
      id: number;
      name: string;
      type: string;
    } | null;
    company: {
      id: number;
      name: string;
    } | null;
    createdAt: string;
    updatedAt: string;
  };
}

export function useChecklistDetail(checklistId: number | null | undefined) {
  return useQuery<ChecklistDetailResponse>({
    queryKey: ['checklist-detail', checklistId],
    queryFn: async () => {
      if (!checklistId) {
        throw new Error('checklistId es requerido');
      }

      const response = await fetch(`/api/maintenance/checklists/${checklistId}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!checklistId,
    staleTime: 60 * 1000, // 60s cache
    refetchOnWindowFocus: false,
  });
}

