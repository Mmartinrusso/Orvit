import { useQueries } from '@tanstack/react-query';

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error fetching ${url}`);
  return res.json();
}

export function useSupervisorDashboardData(companyId: number, sectorId: number | null | undefined, userId: number) {
  const sectorParam = sectorId ? `&sectorId=${sectorId}` : '';

  const results = useQueries({
    queries: [
      {
        queryKey: ['sup-dash-kpis', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/maintenance/kpis?companyId=${companyId}${sectorParam}`),
        staleTime: 2 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['sup-dash-wo', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/work-orders/dashboard?companyId=${companyId}${sectorParam}`),
        staleTime: 2 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['sup-dash-workload', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/maintenance/team-workload?companyId=${companyId}${sectorParam}`),
        staleTime: 2 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['sup-dash-health', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/maintenance/health-score?companyId=${companyId}${sectorParam}`),
        staleTime: 5 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['sup-dash-controls', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/maintenance/controls/pending?companyId=${companyId}${sectorParam}`),
        staleTime: 2 * 60_000,
        enabled: !!companyId,
      },
    ],
  });

  return {
    kpis: { data: results[0].data, isLoading: results[0].isLoading },
    workOrders: { data: results[1].data, isLoading: results[1].isLoading },
    teamWorkload: { data: results[2].data, isLoading: results[2].isLoading },
    healthScore: { data: results[3].data, isLoading: results[3].isLoading },
    controls: { data: results[4].data, isLoading: results[4].isLoading },
    isLoading: results.some(r => r.isLoading),
  };
}
