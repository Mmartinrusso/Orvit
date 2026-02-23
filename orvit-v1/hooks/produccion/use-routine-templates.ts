'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

interface RoutineSection {
  id: string;
  name: string;
  description?: string;
}

interface RoutineTemplate {
  id: number;
  code: string;
  name: string;
  type: string;
  frequency: string;
  isActive: boolean;
  items: any[];
  groups?: any[];
  sections?: RoutineSection[];
  itemsStructure?: 'flat' | 'hierarchical';
  preExecutionInputs?: any[];
  workCenter: { id: number; name: string; code: string } | null;
  _count: { executions: number };
}

interface TemplatePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface TemplatesResponse {
  templates: RoutineTemplate[];
  pagination: TemplatePagination;
}

const TEMPLATES_KEY = 'routine-templates';

async function fetchTemplates(page: number, limit: number): Promise<TemplatesResponse> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());

  const res = await fetch(`/api/production/routines/templates?${params.toString()}`);
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Error al cargar plantillas');
  }

  return {
    templates: data.templates,
    pagination: data.pagination,
  };
}

export function useRoutineTemplates(page: number, limit: number, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [TEMPLATES_KEY, page, limit],
    queryFn: () => fetchTemplates(page, limit),
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  return {
    templates: query.data?.templates ?? [],
    pagination: query.data?.pagination ?? { page, limit, total: 0, totalPages: 0 },
    isLoading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] }),
  };
}

export type { RoutineTemplate, RoutineSection };
