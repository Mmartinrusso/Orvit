import { useQueries } from '@tanstack/react-query';

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error fetching ${url}`);
  return res.json();
}

export function useOperatorDashboardData(companyId: number, sectorId: number | null | undefined, userId: number) {
  const sectorParam = sectorId ? `&sectorId=${sectorId}` : '';

  const results = useQueries({
    queries: [
      {
        queryKey: ['op-dash-kpis', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/maintenance/kpis?companyId=${companyId}${sectorParam}`),
        staleTime: 2 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['op-dash-wo', companyId, sectorId],
        queryFn: () => fetchJSON(`/api/work-orders/dashboard?companyId=${companyId}${sectorParam}`),
        staleTime: 2 * 60_000,
        enabled: !!companyId,
      },
      {
        queryKey: ['op-dash-controls', companyId, userId],
        queryFn: () => fetchJSON(`/api/maintenance/controls/pending?companyId=${companyId}&userId=${userId}`),
        staleTime: 2 * 60_000,
        enabled: !!companyId && !!userId,
      },
    ],
  });

  return {
    kpis: { data: results[0].data, isLoading: results[0].isLoading },
    workOrders: { data: results[1].data, isLoading: results[1].isLoading },
    controls: { data: results[2].data, isLoading: results[2].isLoading },
    isLoading: results.some(r => r.isLoading),
  };
}
