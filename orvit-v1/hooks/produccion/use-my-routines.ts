'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

interface RoutineSummary {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

interface MyRoutinesResponse {
  routines: any[];
  summary: RoutineSummary;
}

const MY_ROUTINES_KEY = 'my-routines';

async function fetchMyRoutines(sectorId: number): Promise<MyRoutinesResponse> {
  const res = await fetch(`/api/production/routines/my-pending?sectorId=${sectorId}`);
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Error al cargar mis rutinas');
  }

  return {
    routines: data.routines,
    summary: data.summary,
  };
}

export function useMyRoutines(sectorId: number | undefined | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [MY_ROUTINES_KEY, sectorId],
    queryFn: () => fetchMyRoutines(sectorId!),
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });

  return {
    routines: query.data?.routines ?? [],
    summary: query.data?.summary ?? { total: 0, completed: 0, inProgress: 0, pending: 0 },
    isLoading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: [MY_ROUTINES_KEY] }),
  };
}
