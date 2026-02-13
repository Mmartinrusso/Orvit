'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadAuditEntry } from '@/lib/cargas/types';

interface UseLoadAuditResult {
  auditEntries: LoadAuditEntry[];
  isLoading: boolean;
  logAction: (loadId: number, action: string, changes?: Record<string, any>) => Promise<void>;
}

/**
 * Hook para gestionar auditoría de cargas
 */
export function useLoadAudit(loadId: number | null): UseLoadAuditResult {
  const queryClient = useQueryClient();

  // Obtener historial de auditoría
  const { data: auditEntries = [], isLoading } = useQuery<LoadAuditEntry[]>({
    queryKey: ['load-audit', loadId],
    queryFn: async () => {
      if (!loadId) return [];
      const response = await fetch(`/api/loads/${loadId}/audit`, {
        credentials: 'include',
      });
      if (!response.ok) {
        // Si la tabla no existe, retornar array vacío
        if (response.status === 404) return [];
        throw new Error('Error al obtener auditoría');
      }
      return response.json();
    },
    enabled: !!loadId,
    staleTime: 60 * 1000, // 1 minuto
  });

  // Registrar acción
  const logMutation = useMutation({
    mutationFn: async ({
      loadId,
      action,
      changes,
    }: {
      loadId: number;
      action: string;
      changes?: Record<string, any>;
    }) => {
      const response = await fetch(`/api/loads/${loadId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, changes }),
      });
      if (!response.ok) {
        // Ignorar errores de auditoría silenciosamente
        console.warn('No se pudo registrar auditoría');
        return null;
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['load-audit', variables.loadId] });
    },
  });

  return {
    auditEntries,
    isLoading,
    logAction: async (loadId, action, changes) => {
      try {
        await logMutation.mutateAsync({ loadId, action, changes });
      } catch {
        // Ignorar errores silenciosamente
      }
    },
  };
}

/**
 * Hook para registrar acciones de auditoría sin cargar el historial
 */
export function useLogLoadAction() {
  return async (loadId: number, action: string, changes?: Record<string, any>) => {
    try {
      await fetch(`/api/loads/${loadId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, changes }),
      });
    } catch {
      // Ignorar errores silenciosamente
    }
  };
}

export default useLoadAudit;
