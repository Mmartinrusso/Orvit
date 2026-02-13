'use client';

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGlobalCache, createCacheKey } from './use-global-cache';

// Tipos para el detalle de máquina
interface MachineBasic {
  id: number;
  name: string;
  nickname?: string;
  type: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  description?: string;
  status: string;
  photo?: string;
  logo?: string;
  sector?: {
    id: number;
    name: string;
    area?: {
      id: number;
      name: string;
    };
  };
  company?: {
    id: number;
    name: string;
  };
}

interface MachineComponent {
  id: number;
  name: string;
  code?: string;
  type?: string;
  description?: string;
  system?: string;
  children?: {
    id: number;
    name: string;
    type?: string;
    description?: string;
  }[];
  _count?: {
    children: number;
  };
}

interface MachineFailure {
  id: number;
  title: string;
  description?: string;
  failure_type?: string;
  priority?: string;
  status?: string;
  reported_date?: string;
  estimated_hours?: number;
  affected_components?: any;
  created_at?: string;
}

interface MachineWorkOrder {
  id: number;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  scheduledDate?: string;
  completedDate?: string;
  startedDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  createdAt: string;
  assignedTo?: {
    id: number;
    name: string;
  };
  assignedWorker?: {
    id: number;
    name: string;
  };
  component?: {
    id: number;
    name: string;
  };
}

interface MachineDocument {
  id: number;
  name?: string;
  fileName?: string;
  type?: string;
  url: string;
  fileSize?: number;
  createdAt: string;
  uploadedBy?: {
    id: number;
    name: string;
  };
}

interface MaintenanceHistoryItem {
  id: number;
  workOrderId: number;
  executedAt: string;
  duration?: number;
  cost?: number;
  notes?: string;
  rootCause?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  spareParts?: any;
  nextMaintenanceDate?: string;
  completionRate?: number;
  qualityScore?: number;
  createdAt: string;
  User?: {
    id: number;
    name: string;
  };
  Component?: {
    id: number;
    name: string;
  };
  work_orders?: {
    id: number;
    title: string;
    type: string;
    status: string;
  };
}

interface MachineTool {
  id: number;
  name: string;
  description?: string;
  code?: string;
  category?: string;
  brand?: string;
  model?: string;
  stockQuantity: number;
  minStockLevel: number;
  status: string;
  location?: string;
}

interface MachineDetailStats {
  totalComponents: number;
  openFailures: number;
  pendingWorkOrders: number;
  completedMaintenances: number;
  totalWorkOrders: number;
  totalDocuments: number;
  totalTools: number;
  totalSpareParts: number;
}

interface MachineDetailData {
  machine: MachineBasic;
  components: MachineComponent[];
  failures: MachineFailure[];
  workOrders: MachineWorkOrder[];
  documents: MachineDocument[];
  maintenanceHistory: MaintenanceHistoryItem[];
  tools: MachineTool[];
  spareParts: MachineTool[];
  stats: MachineDetailStats;
  metadata: {
    machineId: number;
    companyId: number;
    timestamp: string;
  };
}

interface UseMachineDetailOptions {
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ HOOK OPTIMIZADO: Detalle completo de una máquina
 * Usa el endpoint agregador /api/machines/detail
 * 
 * ANTES: 5-8 requests separados
 * DESPUÉS: 1 request con React Query
 */
export function useMachineDetail(
  machineId: number | null | undefined,
  options: UseMachineDetailOptions = {}
) {
  const { enabled = true, staleTime = 2 * 60 * 1000 } = options; // 2 min cache

  return useQuery<MachineDetailData>({
    queryKey: ['machine-detail', machineId],
    queryFn: async () => {
      if (!machineId) throw new Error('machineId is required');
      
      const response = await fetch(`/api/machines/detail?machineId=${machineId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: enabled && !!machineId && machineId > 0,
    staleTime,
    refetchOnWindowFocus: false,
    retry: 1
  });
}

// ============================================================================
// HOOKS DERIVADOS - Extraen datos específicos sin hacer requests adicionales
// ============================================================================

export function useMachineComponents(machineId: number | null | undefined, enabled = true) {
  const { data, isLoading, refetch, isError, error } = useMachineDetail(machineId, { enabled });
  
  return {
    components: data?.components || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useMachineFailures(machineId: number | null | undefined, enabled = true) {
  const { data, isLoading, refetch, isError, error } = useMachineDetail(machineId, { enabled });
  
  return {
    failures: data?.failures || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

/**
 * ✨ OPTIMIZADO: Hook para obtener work orders de una máquina específica
 * Combina órdenes de trabajo (WorkOrder) con mantenimientos preventivos (Document)
 * ya que los preventivos se guardan en una tabla diferente
 */
export function useMachineWorkOrders(
  machineId: number | null | undefined,
  enabled = true,
  companyId?: number | null,
  sectorId?: number | null
) {
  const queryClient = useQueryClient();
  const cache = useGlobalCache();

  const dashboardCacheKey = companyId
    ? createCacheKey('maintenance-dashboard', companyId.toString(), sectorId?.toString() || 'all', '50')
    : null;

  // Fetch work orders (correctivos, etc.)
  const workOrdersQuery = useQuery({
    queryKey: ['work-orders', 'machine', machineId],
    queryFn: async () => {
      if (!machineId) throw new Error('machineId is required');
      const response = await fetch(`/api/work-orders?machineId=${machineId}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: enabled && !!machineId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Fetch preventive maintenances (stored in Document table)
  const preventiveQuery = useQuery({
    queryKey: ['preventive-maintenance', 'machine', machineId, companyId],
    queryFn: async () => {
      if (!machineId || !companyId) return [];
      const response = await fetch(`/api/maintenance/preventive?companyId=${companyId}&machineId=${machineId}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const templates = await response.json();

      // Transform preventive templates/instances to work order format
      const preventiveOrders: any[] = [];
      for (const template of templates) {
        // Check if this template is for this machine
        if (template.machineId !== machineId) continue;

        // Add pending instances as work orders
        if (template.instances && Array.isArray(template.instances)) {
          for (const instance of template.instances) {
            preventiveOrders.push({
              id: `prev-${template.id}-${instance.scheduledDate}`,
              title: template.title,
              description: template.description,
              type: 'PREVENTIVE',
              status: instance.status || 'PENDING',
              priority: template.priority || 'MEDIUM',
              scheduledDate: instance.scheduledDate,
              completedDate: instance.actualEndDate,
              estimatedHours: template.estimatedHours,
              actualHours: instance.actualHours,
              machineId: template.machineId,
              assignedTo: template.assignedToName ? { id: template.assignedToId, name: template.assignedToName } : null,
              component: template.componentNames?.[0] ? { id: template.componentIds?.[0], name: template.componentNames[0] } : null,
              componentId: template.componentIds?.[0],
              createdAt: template.createdAt,
              _isPreventiveTemplate: true,
              _templateId: template.id,
              _frequencyDays: template.frequencyDays
            });
          }
        }
      }
      return preventiveOrders;
    },
    enabled: enabled && !!machineId && !!companyId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Combine work orders and preventive maintenances (with deduplication)
  const workOrders = React.useMemo(() => {
    const orders = workOrdersQuery.data ? (Array.isArray(workOrdersQuery.data) ? workOrdersQuery.data : []) : [];
    const preventive = preventiveQuery.data || [];

    // Create a Set of existing work order preventive template IDs to avoid duplicates
    const existingPreventiveIds = new Set(
      orders
        .filter((o: any) => o.type === 'PREVENTIVE' && o.preventiveTemplateId)
        .map((o: any) => `${o.preventiveTemplateId}-${o.scheduledDate ? new Date(o.scheduledDate).toISOString().split('T')[0] : ''}`)
    );

    // Filter out preventive instances that already exist as work orders
    const uniquePreventive = preventive.filter((p: any) => {
      const key = `${p._templateId}-${p.scheduledDate ? new Date(p.scheduledDate).toISOString().split('T')[0] : ''}`;
      return !existingPreventiveIds.has(key);
    });

    // Also dedupe by ID to handle any remaining edge cases
    const seenIds = new Set<string>();
    const combined = [...orders, ...uniquePreventive].filter((item: any) => {
      const id = String(item.id);
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    return combined;
  }, [workOrdersQuery.data, preventiveQuery.data]);

  const isLoading = workOrdersQuery.isLoading || preventiveQuery.isLoading;
  const isError = workOrdersQuery.isError || preventiveQuery.isError;
  const error = workOrdersQuery.error || preventiveQuery.error;

  const refetch = React.useCallback(() => {
    workOrdersQuery.refetch();
    preventiveQuery.refetch();
    queryClient.invalidateQueries({ queryKey: ['machine-detail', machineId] });
    if (dashboardCacheKey) {
      cache.remove(dashboardCacheKey);
    }
  }, [workOrdersQuery, preventiveQuery, queryClient, machineId, dashboardCacheKey, cache]);

  return {
    workOrders,
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useMachineDocuments(machineId: number | null | undefined, enabled = true) {
  const { data, isLoading, refetch, isError, error } = useMachineDetail(machineId, { enabled });
  
  return {
    documents: data?.documents || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

/**
 * ✨ OPTIMIZADO: Hook que intenta usar cache del dashboard primero
 * Si el dashboard ya cargó historial, lo reutiliza filtrando por machineId
 * Si no, hace fetch directamente a los endpoints de mantenimiento
 * 
 * Estrategia de carga:
 * 1. Intentar cache global del dashboard (useGlobalCache) - filtrar por machineId
 * 2. Intentar cache de React Query del dashboard - filtrar por machineId
 * 3. Si no hay cache, hacer fetch a /api/maintenance/history?companyId=${companyId}&machineId=${machineId}
 * 4. Como último recurso, usar cache de useMachineDetail
 */
export function useMachineMaintenanceHistory(
  machineId: number | null | undefined, 
  enabled = true,
  companyId?: number | null,
  sectorId?: number | null
) {
  const queryClient = useQueryClient();
  const cache = useGlobalCache();
  
  // 1. Intentar cache global del dashboard
  const dashboardCacheKey = companyId 
    ? createCacheKey('maintenance-dashboard', companyId.toString(), sectorId?.toString() || 'all', '50')
    : null;
  const dashboardData = dashboardCacheKey ? cache.get(dashboardCacheKey) : null;
  
  // 2. Intentar cache de React Query del dashboard (si existe)
  const dashboardQueryData = companyId 
    ? queryClient.getQueryData(['maintenance-dashboard', companyId, sectorId || 'all', '50'])
    : null;
  
  // Usar datos del dashboard (global o React Query)
  const dashboardDataFinal = dashboardData || dashboardQueryData;
  
  // Filtrar historial del dashboard por machineId
  const dashboardHistory = React.useMemo(() => {
    if (!dashboardDataFinal?.recentHistory || !machineId) return null;
    const filtered = dashboardDataFinal.recentHistory.filter((h: any) => 
      h.machineId === machineId || 
      h.work_orders?.machineId === machineId ||
      h.machine?.id === machineId
    );
    return filtered.length > 0 ? filtered : null;
  }, [dashboardDataFinal, machineId]);
  
  // 3. Si no hay datos del dashboard, hacer fetch directamente
  const directFetchQuery = useQuery({
    queryKey: ['maintenance-history', 'machine', machineId, companyId],
    queryFn: async () => {
      if (!machineId || !companyId) throw new Error('machineId and companyId are required');
      const params = new URLSearchParams({
        companyId: companyId.toString(),
        machineId: machineId.toString()
      });
      if (sectorId) {
        params.append('sectorId', sectorId.toString());
      }
      
      const response = await fetch(`/api/maintenance/history?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      // El endpoint devuelve { data: { executions: [...] } }
      return data.data?.executions || [];
    },
    enabled: enabled && !!machineId && !!companyId && !dashboardHistory, // Solo si no hay cache del dashboard
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: false
  });
  
  // 4. Usar useMachineDetail como último recurso
  const { data: machineDetailData } = useMachineDetail(machineId, { 
    enabled: enabled && !dashboardHistory && !directFetchQuery.data // Solo si no hay otros datos
  });
  
  // Priorizar datos: dashboard > direct fetch > machine detail
  const maintenanceHistory = React.useMemo(() => {
    if (dashboardHistory) return dashboardHistory;
    if (directFetchQuery.data) return Array.isArray(directFetchQuery.data) ? directFetchQuery.data : [];
    return machineDetailData?.maintenanceHistory || [];
  }, [dashboardHistory, directFetchQuery.data, machineDetailData?.maintenanceHistory]);
  
  const isLoading = dashboardHistory 
    ? false 
    : (directFetchQuery.isLoading || (machineDetailData === undefined));
  
  const isError = directFetchQuery.isError;
  const error = directFetchQuery.error;
  
  const refetch = React.useCallback(() => {
    directFetchQuery.refetch();
    queryClient.invalidateQueries({ queryKey: ['machine-detail', machineId] });
    if (dashboardCacheKey) {
      cache.remove(dashboardCacheKey);
    }
  }, [directFetchQuery, queryClient, machineId, dashboardCacheKey, cache]);
  
  return {
    maintenanceHistory,
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useMachineStats(machineId: number | null | undefined, enabled = true) {
  const { data, isLoading, isError, error } = useMachineDetail(machineId, { enabled });
  
  return {
    stats: data?.stats || null,
    isLoading,
    isError,
    error
  };
}

export function useMachineTools(machineId: number | null | undefined, enabled = true) {
  const { data, isLoading, refetch, isError, error } = useMachineDetail(machineId, { enabled });
  
  return {
    tools: data?.tools || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useMachineSpareParts(machineId: number | null | undefined, enabled = true) {
  const { data, isLoading, refetch, isError, error } = useMachineDetail(machineId, { enabled });
  
  return {
    spareParts: data?.spareParts || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Hook para invalidar el cache de detalle de máquina
 * Útil después de crear/editar/eliminar componentes, fallas, etc.
 */
export function useInvalidateMachineDetail() {
  const queryClient = useQueryClient();
  
  return {
    invalidate: (machineId: number) => {
      queryClient.invalidateQueries({ queryKey: ['machine-detail', machineId] });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['machine-detail'] });
    }
  };
}

// Exportar tipos para uso externo
export type {
  MachineDetailData,
  MachineBasic,
  MachineComponent,
  MachineFailure,
  MachineWorkOrder,
  MachineDocument,
  MaintenanceHistoryItem,
  MachineDetailStats,
  MachineTool
};
