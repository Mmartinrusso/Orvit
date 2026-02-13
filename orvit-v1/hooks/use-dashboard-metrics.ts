'use client';

import { useQuery } from '@tanstack/react-query';

interface DashboardMetricsData {
  monthSummary: {
    month: string;
    daysWorked: number;
    daysTotal: number;
    mtd: number;
    budget: number;
    runRate: number;
    forecastEom: number;
    yoyPct: number;
  };
  dailyData: any[];
  contributions: any[];
  metrics: {
    totalSales: number;
    totalCosts: number;
    totalUnitsSold: number;
    netMargin: number;
    marginPercentage: number;
    yoyGrowth: number;
    costBreakdown: {
      materials: number;
      indirects: number;
      employees: number;
      purchases: number;
    };
  };
  currentMetrics: {
    ventas: number;
    costos: number;
    sueldos: number;
    indirectos: number;
    compras: number;
    materiales: number;
    margenBruto: number;
    margenNeto: number;
    margenBrutoPct: number;
    margenNetoPct: number;
  };
  changes: {
    ventas: { amount: number; percentage: number };
    costos: { amount: number; percentage: number };
    sueldos: { amount: number; percentage: number };
  };
  period: {
    current: string;
    previous: string | null;
  };
}

/**
 * ✨ HOOK OPTIMIZADO: Dashboard metrics con React Query
 * Elimina fetches duplicados usando caché de React Query
 * 
 * @param companyId - ID de la empresa
 * @param month - Mes en formato YYYY-MM
 * @param enabled - Si el query está habilitado (por defecto true)
 */
export function useDashboardMetrics(
  companyId: string | number | undefined,
  month?: string,
  enabled: boolean = true
) {
  return useQuery<DashboardMetricsData, Error>({
    queryKey: ['dashboard-metrics', companyId, month],
    queryFn: async () => {
      if (!companyId) {
        throw new Error('Company ID is required');
      }
      
      const url = `/api/dashboard/metrics?companyId=${companyId}${month ? `&month=${month}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch dashboard metrics');
      }
      
      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime: 30 * 1000, // 30 segundos - datos cambian frecuentemente
    gcTime: 5 * 60 * 1000, // 5 minutos
    retry: 1, // Solo reintentar 1 vez en caso de error
  });
}

