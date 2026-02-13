'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * ✨ MUTATION: Aprobar tool request
 * Reemplaza fetch directo en PanolPage
 */
export function useApproveToolRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/tool-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve tool request');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['tool-requests'] });
      queryClient.invalidateQueries({ queryKey: ['tools-dashboard'] });
    },
  });
}

/**
 * ✨ MUTATION: Rechazar tool request
 * Reemplaza fetch directo en PanolPage
 */
export function useRejectToolRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const response = await fetch(`/api/tool-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reject tool request');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['tool-requests'] });
      queryClient.invalidateQueries({ queryKey: ['tools-dashboard'] });
    },
  });
}

