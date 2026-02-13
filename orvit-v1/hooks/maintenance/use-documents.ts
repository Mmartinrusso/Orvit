'use client';

import { useQuery } from '@tanstack/react-query';

interface UseDocumentsOptions {
  entityType: string;
  entityId: string | number | null | undefined;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ Hook centralizado para documentos
 * Reemplaza fetch directo en MachineDetailDialog (DocumentacionTab, MachineInfoDocuments)
 * Evita duplicación: mismo endpoint llamado desde múltiples lugares
 */
export function useDocuments(options: UseDocumentsOptions) {
  const {
    entityType,
    entityId,
    enabled = true,
    staleTime = 60 * 1000 // 60s cache (documentos cambian poco)
  } = options;

  return useQuery({
    queryKey: ['documents', entityType, String(entityId)],
    queryFn: async () => {
      if (!entityId) throw new Error('entityId is required');
      
      const response = await fetch(`/api/documents?entityType=${entityType}&entityId=${entityId}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: enabled && !!entityId,
    staleTime,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData // Evitar flash
  });
}

