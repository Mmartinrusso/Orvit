'use client';

import { useMemo } from 'react';
import { useChecklistDetail } from './use-checklist-detail';

interface ChecklistItemFlat {
  id: string;
  code?: string;
  title: string;
  description?: string;
  estimatedTime?: number;
  minutes?: number;
  maintenanceId?: number;
  phaseId?: string;
  order?: number;
}

export interface ItemsTreeResponse {
  totalItems: number;
  totalMinutes: number;
  flatItems: ChecklistItemFlat[];
}

export function useChecklistItemsTree(checklistId: number | null | undefined) {
  const { data: checklistData, isLoading, error, refetch } = useChecklistDetail(checklistId);

  const tree = useMemo<ItemsTreeResponse | null>(() => {
    if (!checklistData?.checklist || isLoading) {
      return null;
    }

    const checklist = checklistData.checklist;
    
    // Recopilar todos los items planos
    const flatItems: ChecklistItemFlat[] = [];
    
    if (checklist.phases && checklist.phases.length > 0) {
      checklist.phases.forEach((phase, phaseIndex) => {
        if (phase.items && phase.items.length > 0) {
          phase.items.forEach((item: any, itemIndex: number) => {
            flatItems.push({
              id: item.id || `item_${phaseIndex}_${itemIndex}`,
              code: item.code || `${phaseIndex + 1}.${itemIndex + 1}`,
              title: item.title || 'Sin título',
              description: item.description,
              estimatedTime: item.estimatedTime || 0,
              minutes: item.estimatedTime || item.minutes || 0,
              maintenanceId: item.maintenanceId,
              phaseId: phase.id,
              order: item.order || itemIndex,
            });
          });
        }
      });
    } else if (checklist.items && checklist.items.length > 0) {
      checklist.items.forEach((item: any, index: number) => {
        flatItems.push({
          id: item.id || `item_${index}`,
          code: item.code || `${index + 1}`,
          title: item.title || 'Sin título',
          description: item.description,
          estimatedTime: item.estimatedTime || 0,
          minutes: item.estimatedTime || item.minutes || 0,
          maintenanceId: item.maintenanceId,
          order: item.order || index,
        });
      });
    }

    const totalItems = flatItems.length;
    const totalMinutes = flatItems.reduce((sum, item) => sum + (item.minutes || 0), 0);

    return {
      totalItems,
      totalMinutes,
      flatItems,
    };
  }, [checklistData, isLoading]);

  return {
    data: tree,
    isLoading,
    error,
    refetch,
  };
}

// Utilidades para ordenar códigos
export function parseCode(code: string): number[] {
  if (!code || code === '—') return [Infinity];
  return code.split('.').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? Infinity : num;
  });
}

export function compareCodes(a: number[], b: number[]): number {
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const aVal = a[i] ?? Infinity;
    const bVal = b[i] ?? Infinity;
    if (aVal !== bVal) {
      return aVal - bVal;
    }
  }
  return 0;
}
