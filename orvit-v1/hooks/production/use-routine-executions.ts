'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ExecutionFilters {
  dateFrom: string;
  dateTo: string;
  typeFilter?: string;
  hasIssuesFilter?: string;
  page: number;
  limit: number;
}

interface RoutineExecution {
  id: number;
  date: string;
  hasIssues: boolean;
  issueDescription: string | null;
  responses: any[];
  executedAt: string;
  template: {
    id: number;
    code: string;
    name: string;
    type: string;
  };
  workCenter: { id: number; name: string; code: string } | null;
  shift: { id: number; name: string } | null;
  executedBy: { id: number; name: string };
}

interface ExecutionStats {
  totalExecutions: number;
  withIssues: number;
  withoutIssues: number;
}

interface ExecutionPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ExecutionsResponse {
  executions: RoutineExecution[];
  stats: ExecutionStats;
  pagination: ExecutionPagination;
}

const EXECUTIONS_KEY = 'routine-executions';

async function fetchExecutions(filters: ExecutionFilters): Promise<ExecutionsResponse> {
  const params = new URLSearchParams();
  params.append('dateFrom', filters.dateFrom);
  params.append('dateTo', filters.dateTo);
  params.append('page', filters.page.toString());
  params.append('limit', filters.limit.toString());

  if (filters.hasIssuesFilter && filters.hasIssuesFilter !== 'all') {
    params.append('hasIssues', filters.hasIssuesFilter);
  }

  const res = await fetch(`/api/production/routines?${params.toString()}`);
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Error al cargar ejecuciones');
  }

  return {
    executions: data.routines,
    stats: data.stats,
    pagination: data.pagination,
  };
}

export function useRoutineExecutions(filters: ExecutionFilters, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [EXECUTIONS_KEY, filters],
    queryFn: () => fetchExecutions(filters),
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  return {
    executions: query.data?.executions ?? [],
    stats: query.data?.stats ?? { totalExecutions: 0, withIssues: 0, withoutIssues: 0 },
    pagination: query.data?.pagination ?? { page: filters.page, limit: filters.limit, total: 0, totalPages: 0 },
    isLoading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: [EXECUTIONS_KEY] }),
  };
}

export type { RoutineExecution, ExecutionStats, ExecutionPagination };
