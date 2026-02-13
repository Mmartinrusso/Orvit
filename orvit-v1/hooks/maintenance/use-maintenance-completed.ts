'use client';

import { useQuery } from '@tanstack/react-query';

interface UseMaintenanceCompletedOptions {
  companyId: number | null | undefined;
  sectorId?: number | null;
  machineId?: number | null;
  todayOnly?: boolean;
  timeFilter?: 'today' | 'week' | 'month' | 'all';
  priority?: string;
  type?: string;
  machineIds?: string;
  unidadMovilIds?: string;
  searchTerm?: string;
  minFrequencyDays?: number;
  maxFrequencyDays?: number;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ Hook centralizado para mantenimientos completados
 * Reemplaza fetch directo en EnhancedMaintenancePanel
 */
export function useMaintenanceCompleted(options: UseMaintenanceCompletedOptions) {
  const {
    companyId,
    sectorId,
    machineId,
    todayOnly,
    timeFilter,
    priority,
    type,
    machineIds,
    unidadMovilIds,
    searchTerm,
    minFrequencyDays,
    maxFrequencyDays,
    page = 0,
    pageSize = 50,
    enabled = true,
    staleTime = 30 * 1000 // 30s cache
  } = options;

  return useQuery({
    queryKey: [
      'maintenance-completed', 
      Number(companyId), 
      Number(sectorId) || null, 
      Number(machineId) || null, 
      todayOnly, 
      timeFilter,
      priority,
      type,
      machineIds,
      unidadMovilIds,
      searchTerm,
      minFrequencyDays,
      maxFrequencyDays,
      page, 
      pageSize
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      if (machineId) params.append('machineId', machineId.toString());
      if (todayOnly) params.append('todayOnly', 'true');
      if (timeFilter) params.append('timeFilter', timeFilter);
      if (priority) params.append('priority', priority);
      if (type) params.append('type', type);
      if (machineIds) params.append('machineIds', machineIds);
      if (unidadMovilIds) params.append('unidadMovilIds', unidadMovilIds);
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (minFrequencyDays) params.append('minFrequencyDays', minFrequencyDays.toString());
      if (maxFrequencyDays) params.append('maxFrequencyDays', maxFrequencyDays.toString());
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const response = await fetch(`/api/maintenance/completed?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData // Evitar flash
  });
}

