'use client';

import { useQuery } from '@tanstack/react-query';

interface Tool {
  id: number;
  name: string;
  description?: string;
  itemType: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  stockQuantity: number;
  minStockLevel: number;
  location?: string;
  status: string;
  cost?: number;
  supplier?: string;
  logo?: string;
}

interface ToolLoan {
  id: number;
  toolId: number;
  quantity: number;
  borrowedAt: string;
  expectedReturnDate?: string;
  status: string;
  tool: {
    id: number;
    name: string;
    itemType: string;
    category: string;
  };
  user?: {
    id: number;
    name: string;
    email: string;
  };
  worker?: {
    id: number;
    name: string;
    phone?: string;
  };
}

interface ToolMovement {
  id: number;
  toolId: number;
  type: string;
  quantity: number;
  reason: string;
  createdAt: string;
  tool: {
    id: number;
    name: string;
    itemType: string;
  };
}

interface ToolRequest {
  id: number;
  toolId: number;
  quantity: number;
  status: string;
  createdAt: string;
  tool: {
    id: number;
    name: string;
    itemType: string;
    stockQuantity: number;
  };
  requestedBy: {
    id: number;
    name: string;
  };
}

interface ToolsStats {
  total: number;
  available: number;
  inUse: number;
  maintenance: number;
  lowStock: number;
  outOfStock: number;
  activeLoans: number;
}

interface ToolsDashboardData {
  tools: Tool[];
  activeLoans: ToolLoan[];
  returnedLoans: ToolLoan[];
  recentMovements: ToolMovement[];
  pendingRequests: ToolRequest[];
  stats: ToolsStats;
  categories: string[];
  metadata: {
    companyId: number;
    itemType: string | null;
    timestamp: string;
    totalTools: number;
  };
}

interface UseToolsDashboardOptions {
  enabled?: boolean;
  staleTime?: number;
  itemType?: string;
}

/**
 * ✨ HOOK OPTIMIZADO: Dashboard de herramientas/pañol
 * Usa el endpoint agregador /api/tools/dashboard
 * 
 * ANTES: 5-6 requests separados (tools, loans, movements, requests, stats)
 * DESPUÉS: 1 request con React Query
 */
export function useToolsDashboard(
  companyId: number | null | undefined,
  options: UseToolsDashboardOptions = {}
) {
  const { enabled = true, staleTime = 2 * 60 * 1000, itemType } = options; // 2 min cache

  return useQuery<ToolsDashboardData>({
    queryKey: ['tools-dashboard', companyId, itemType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.append('companyId', companyId.toString());
      if (itemType) params.append('itemType', itemType);

      const response = await fetch(`/api/tools/dashboard?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime,
    refetchOnWindowFocus: false
  });
}

// Hooks derivados para compatibilidad
export function useToolsList(companyId: number | null | undefined, itemType?: string) {
  const { data, isLoading, isError, error, refetch } = useToolsDashboard(companyId, { itemType });
  
  return {
    tools: data?.tools || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useActiveLoans(companyId: number | null | undefined) {
  const { data, isLoading, refetch } = useToolsDashboard(companyId);
  
  return {
    loans: data?.activeLoans || [],
    isLoading,
    refetch
  };
}

export function useToolsStats(companyId: number | null | undefined) {
  const { data, isLoading } = useToolsDashboard(companyId);
  
  return {
    stats: data?.stats || null,
    isLoading
  };
}

export function useRecentMovements(companyId: number | null | undefined) {
  const { data, isLoading, refetch } = useToolsDashboard(companyId);
  
  return {
    movements: data?.recentMovements || [],
    isLoading,
    refetch
  };
}

export function usePendingToolRequests(companyId: number | null | undefined) {
  const { data, isLoading, refetch } = useToolsDashboard(companyId);
  
  return {
    requests: data?.pendingRequests || [],
    isLoading,
    refetch
  };
}

export function useReturnedLoans(companyId: number | null | undefined) {
  const { data, isLoading, refetch } = useToolsDashboard(companyId);
  
  return {
    loans: data?.returnedLoans || [],
    isLoading,
    refetch
  };
}
