import { useQuery } from '@tanstack/react-query';
import type { TasksDashboardDTO } from '@/app/api/tasks/dashboard/route';

export type TasksRangeKey = '7d' | '30d' | '90d';

async function fetchTasksDashboard(range: TasksRangeKey): Promise<TasksDashboardDTO> {
  const qs = new URLSearchParams();
  qs.set('range', range);
  const res = await fetch(`/api/tasks/dashboard?${qs.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('No se pudo cargar el dashboard de tareas');
  return res.json();
}

export function useTasksDashboard(range: TasksRangeKey) {
  return useQuery({
    queryKey: ['tasksDashboard', range],
    queryFn: () => fetchTasksDashboard(range),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
}


