'use client';

import { useQuery } from '@tanstack/react-query';

interface UseNotificationsOptions {
  companyId: number | null | undefined;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  type?: string;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ Hook centralizado para notificaciones
 * Reemplaza fetch directo en NotificationContext
 * Evita múltiples llamadas: NotificationContext puede montarse varias veces
 * 
 * IMPORTANTE: staleTime alto (60-120s) para evitar refetch constante
 */
export function useNotifications(options: UseNotificationsOptions) {
  const {
    companyId,
    limit = 50,
    offset = 0,
    unreadOnly = false,
    type,
    enabled = true,
    staleTime = 120 * 1000 // 120s cache (notificaciones no cambian tan rápido)
  } = options;

  return useQuery({
    queryKey: ['notifications', companyId || null, limit, offset, unreadOnly, type],
    queryFn: async () => {
      // ⚠️ Esta función solo se ejecuta si enabled && !!companyId
      // Pero agregamos validación adicional por seguridad
      if (!companyId) {
        return { success: true, notifications: [] };
      }
      
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      if (unreadOnly) params.append('unreadOnly', 'true');
      if (type) params.append('type', type);

      const response = await fetch(`/api/notifications?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Usuario no autenticado, retornar array vacío
          return { success: true, notifications: [] };
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: enabled && !!companyId, // Solo habilitar cuando hay companyId
    staleTime,
    refetchOnWindowFocus: false, // CRÍTICO: evitar refetch al cambiar de pestaña
    placeholderData: (previousData) => previousData, // Evitar flash
    retry: false // No reintentar si falla (evita bloqueos)
  });
}

