'use client';

import { useQuery } from '@tanstack/react-query';

interface Machine {
  id: number;
  name: string;
  nickname?: string;
  aliases?: string[] | null;
  type: string;
  brand?: string;
  model?: string;
  status: string;
  photo?: string;
  logo?: string;
  serialNumber?: string;
  sectorId?: number;
  companyId?: number;
  plantZoneId?: number | null;
  plantZone?: {
    id: number;
    name: string;
    color?: string;
  } | null;
  sector?: {
    id: number;
    name: string;
    areaId?: number;
  };
  // Métricas CMMS
  healthScore?: number | null;
  criticalityScore?: number | null;
  // Contadores de OTs y Fallas
  pendingWorkOrders: number;
  openFailures: number;
  _count?: {
    components: number;
    workOrders: number;
  };
}

interface Sector {
  id: number;
  name: string;
  area?: {
    id: number;
    name: string;
  };
}

interface MachinesStats {
  total: number;
  active: number;
  inactive: number;
  maintenance: number;
  withOpenFailures: number;
}

interface MachinesInitialData {
  machines: Machine[];
  sectors: Sector[];
  stats: MachinesStats;
  metadata: {
    companyId: number;
    sectorId: number | null;
    timestamp: string;
    total: number;
  };
}

interface UseMachinesInitialOptions {
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ HOOK OPTIMIZADO: Datos iniciales de máquinas
 * Usa el endpoint agregador /api/machines/initial
 * 
 * ANTES: 3-5 requests separados
 * DESPUÉS: 1 request con React Query (cache + deduplicación)
 */
export function useMachinesInitial(
  companyId: number | null | undefined,
  sectorId?: number | null,
  options: UseMachinesInitialOptions = {}
) {
  const { enabled = true, staleTime = 3 * 60 * 1000 } = options; // 3 min cache

  return useQuery<MachinesInitialData>({
    queryKey: ['machines-initial', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());

      const response = await fetch(`/api/machines/initial?${params.toString()}`);
      
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
export function useMachinesList(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMachinesInitial(companyId, sectorId);
  
  return {
    machines: data?.machines || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useMachinesStats(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading } = useMachinesInitial(companyId, sectorId);
  
  return {
    stats: data?.stats || null,
    isLoading
  };
}
