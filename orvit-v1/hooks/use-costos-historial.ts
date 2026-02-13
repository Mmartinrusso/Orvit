'use client';

import { useQuery } from '@tanstack/react-query';

export interface HistorialEntry {
  id: string;
  employeeId: string;
  oldSalary: number;
  newSalary: number;
  changeDate: string;
  changeReason: string;
  companyId: number;
  employeeName: string;
  employeeRole: string;
  source: string;
}

/**
 * Helper para generar queryKey consistente
 */
export function costosHistorialKey(
  companyId: number | string | undefined,
  employeeId?: string | null
): (string | number | null | undefined)[] {
  return ['costos-historial', Number(companyId), employeeId || null];
}

/**
 * Hook para obtener historial de costos (sueldos)
 */
export function useCostosHistorial(
  companyId: number | string | undefined,
  employeeId?: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: costosHistorialKey(companyId, employeeId),
    queryFn: async () => {
      if (!companyId) {
        throw new Error('companyId es requerido');
      }
      
      let url = `/api/costos/historial?companyId=${Number(companyId)}`;
      if (employeeId) {
        url += `&employeeId=${employeeId}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener historial');
      }
      
      return response.json() as Promise<HistorialEntry[]>;
    },
    enabled: enabled && !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false,
    networkMode: 'always',
    retry: 1,
  });
}

