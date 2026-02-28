import { useQueries } from '@tanstack/react-query';

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error fetching ${url}`);
  return res.json();
}

export function useManagerDashboardData(companyId: number, sectorId: number | null | undefined) {
  const sectorParam = sectorId ? `&sectorId=${sectorId}` : '';

  const results = useQueries({
    queries: [
      {
        queryKey: ['mgr-dash-kpis', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/maintenance/kpis?companyId=${companyId}${sectorParam}`),
        staleTime: 2 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['mgr-dash-wo', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/work-orders/dashboard?companyId=${companyId}${sectorParam}`),
        staleTime: 2 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['mgr-dash-costs', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/maintenance/costs?companyId=${companyId}${sectorParam}`),
        staleTime: 5 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['mgr-dash-cross-sector', companyId],
        queryFn: () => fetchJSON(`/api/maintenance/cross-sector-stats?companyId=${companyId}`),
        staleTime: 5 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['mgr-dash-health', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/maintenance/health-score?companyId=${companyId}${sectorParam}`),
        staleTime: 5 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['mgr-dash-solution-eff', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/maintenance/solution-effectiveness?companyId=${companyId}${sectorParam}`),
        staleTime: 5 * 60_000,
        enabled: !!companyId,
      },
    ],
  });

  return {
    kpis: { data: results[0].data, isLoading: results[0].isLoading },
    workOrders: { data: results[1].data, isLoading: results[1].isLoading },
    costs: { data: results[2].data, isLoading: results[2].isLoading },
    crossSector: { data: results[3].data, isLoading: results[3].isLoading },
    healthScore: { data: results[4].data, isLoading: results[4].isLoading },
    solutionEffectiveness: { data: results[5].data, isLoading: results[5].isLoading },
    isLoading: results.some(r => r.isLoading),
  };
}
