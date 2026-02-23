'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TIPOS
// ============================================================================

interface TaxBase {
  id: number;
  name: string;
  description?: string;
  recurringDay: number;
  companyId: number;
  isRecurring: boolean;
  isActive: boolean;
  notes?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  createdByUser?: {
    id: number;
    name: string;
    email: string;
  };
  taxRecords?: Array<{
    id: number;
    month: string;
    status: string;
    amount: number;
  }>;
}

interface TaxRecord {
  id: number;
  taxBaseId: number;
  month: string;
  amount: number;
  status: string;
  alertDate: string;
  receivedDate?: string;
  paidDate?: string;
  receivedBy?: number;
  paidBy?: number;
  notes?: string;
  taxBase?: {
    id: number;
    name: string;
    description?: string;
    recurringDay: number;
    isRecurring: boolean;
  };
  receivedByUser?: {
    id: number;
    name: string;
    email: string;
  };
  paidByUser?: {
    id: number;
    name: string;
    email: string;
  };
}

interface TaxAlert {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  taxBaseId?: number;
  taxRecordId?: number;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const taxQueryKeys = {
  all: ['tax'] as const,
  bases: (companyId: number | string | undefined) => ['tax', 'bases', companyId] as const,
  records: (companyId: number | string | undefined, month?: string, status?: string) => 
    ['tax', 'records', companyId, month, status] as const,
  alerts: (companyId: number | string | undefined) => ['tax', 'alerts', companyId] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * ✨ HOOK OPTIMIZADO: Tax bases con React Query
 * Reemplaza fetch directo en TaxControlModal
 */
export function useTaxBases(
  companyId: number | string | undefined,
  enabled: boolean = true
) {
  return useQuery<TaxBase[]>({
    queryKey: taxQueryKeys.bases(companyId),
    queryFn: async () => {
      if (!companyId) {
        throw new Error('Company ID is required');
      }
      
      const response = await fetch(`/api/tax-base?companyId=${companyId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch tax bases');
      }
      
      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * ✨ HOOK OPTIMIZADO: Tax records con React Query
 * Reemplaza fetch directo en TaxControlModal
 */
export function useTaxRecords(
  companyId: number | string | undefined,
  month?: string,
  status?: string,
  enabled: boolean = true
) {
  return useQuery<TaxRecord[]>({
    queryKey: taxQueryKeys.records(companyId, month, status),
    queryFn: async () => {
      if (!companyId) {
        throw new Error('Company ID is required');
      }
      
      const params = new URLSearchParams({
        companyId: companyId.toString(),
      });
      
      if (month) {
        params.append('month', month);
      }
      
      if (status && status !== 'all') {
        params.append('status', status);
      }
      
      const response = await fetch(`/api/tax-record?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch tax records');
      }
      
      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutos (datos cambian más frecuentemente)
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: (previousData) => previousData, // Mantener datos anteriores mientras carga
  });
}

/**
 * ✨ HOOK OPTIMIZADO: Tax alerts con React Query
 * Reemplaza fetch directo en TaxControlModal
 */
export function useTaxAlerts(
  companyId: number | string | undefined,
  enabled: boolean = true
) {
  return useQuery<{ alerts: TaxAlert[]; summary?: any }>({
    queryKey: taxQueryKeys.alerts(companyId),
    queryFn: async () => {
      if (!companyId) {
        throw new Error('Company ID is required');
      }
      
      const response = await fetch(`/api/tax-alerts/check?companyId=${companyId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch tax alerts');
      }
      
      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime: 1 * 60 * 1000, // 1 minuto (alerts cambian frecuentemente)
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * ✨ MUTATION: Crear tax base
 */
export function useCreateTaxBase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      recurringDay: number;
      companyId: number;
      notes?: string;
    }) => {
      const response = await fetch('/api/tax-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          name: data.name.trim(),
          isRecurring: true,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create tax base');
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: taxQueryKeys.bases(variables.companyId) });
    },
  });
}

/**
 * ✨ MUTATION: Crear/actualizar tax record
 */
export function useUpsertTaxRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      taxBaseId: number;
      amount: number;
      month: string;
      notes?: string;
      alertDate?: string;
      companyId: number;
    }) => {
      const response = await fetch('/api/tax-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create/update tax record');
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ 
        queryKey: taxQueryKeys.records(variables.companyId, variables.month) 
      });
      queryClient.invalidateQueries({ 
        queryKey: taxQueryKeys.alerts(variables.companyId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: taxQueryKeys.bases(variables.companyId) 
      });
    },
  });
}

/**
 * ✨ MUTATION: Actualizar status de tax record (optimistic update)
 */
export function useUpdateTaxRecordStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, companyId, month }: { id: number; status: string; companyId: number; month?: string }) => {
      const response = await fetch(`/api/tax-record/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update tax record status');
      }

      return response.json();
    },
    onMutate: async ({ id, status, companyId }) => {
      const queryKeyPrefix = ['tax', 'records', companyId];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const queries = queryClient.getQueriesData<TaxRecord[]>({ queryKey: queryKeyPrefix });
      queryClient.setQueriesData<TaxRecord[]>(
        { queryKey: queryKeyPrefix },
        (old) => old?.map(r => r.id === id ? { ...r, status } : r) ?? []
      );
      return { queries };
    },
    onError: (_err, _vars, context) => {
      context?.queries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: taxQueryKeys.records(variables.companyId, variables.month) });
      queryClient.invalidateQueries({ queryKey: taxQueryKeys.alerts(variables.companyId) });
    },
  });
}

/**
 * ✨ MUTATION: Eliminar tax record (optimistic update)
 */
export function useDeleteTaxRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId, month }: { id: number; companyId: number; month?: string }) => {
      const response = await fetch(`/api/tax-record/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete tax record');
      }

      return response.json();
    },
    onMutate: async ({ id, companyId }) => {
      const queryKeyPrefix = ['tax', 'records', companyId];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const queries = queryClient.getQueriesData<TaxRecord[]>({ queryKey: queryKeyPrefix });
      queryClient.setQueriesData<TaxRecord[]>(
        { queryKey: queryKeyPrefix },
        (old) => old?.filter(r => r.id !== id) ?? []
      );
      return { queries };
    },
    onError: (_err, _vars, context) => {
      context?.queries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: taxQueryKeys.records(variables.companyId, variables.month) });
      queryClient.invalidateQueries({ queryKey: taxQueryKeys.alerts(variables.companyId) });
    },
  });
}

/**
 * ✨ MUTATION: Eliminar tax base (optimistic update)
 */
export function useDeleteTaxBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: number; companyId: number }) => {
      const response = await fetch(`/api/tax-base?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete tax base');
      }

      return response.json();
    },
    onMutate: async ({ id, companyId }) => {
      await queryClient.cancelQueries({ queryKey: taxQueryKeys.bases(companyId) });
      const previousBases = queryClient.getQueryData<TaxBase[]>(taxQueryKeys.bases(companyId));
      queryClient.setQueryData<TaxBase[]>(
        taxQueryKeys.bases(companyId),
        (old) => old?.filter(b => b.id !== id) ?? []
      );
      return { previousBases };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousBases) {
        queryClient.setQueryData(taxQueryKeys.bases(_vars.companyId), context.previousBases);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: taxQueryKeys.bases(variables.companyId) });
      queryClient.invalidateQueries({ queryKey: taxQueryKeys.records(variables.companyId) });
    },
  });
}

// Exportar tipos
export type { TaxBase, TaxRecord, TaxAlert };

