'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

const DRAFTS_KEY = 'routine-drafts';

async function fetchDrafts(): Promise<any[]> {
  const res = await fetch('/api/production/routines/draft');
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Error al cargar borradores');
  }

  return data.drafts;
}

export function useRoutineDrafts(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [DRAFTS_KEY],
    queryFn: fetchDrafts,
    enabled,
    staleTime: 60 * 1000,
  });

  return {
    drafts: query.data ?? [],
    isLoading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: [DRAFTS_KEY] }),
  };
}
