import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';

interface Symptom {
  id: number;
  title: string;
  keywords: string[];
  shortNote?: string;
  componentId?: number;
  subcomponentId?: number;
  machineId?: number;
  usageCount: number;
}

interface UseSymptomSearchOptions {
  componentId?: number;
  subcomponentId?: number;
  machineId?: number;
  topUsed?: boolean;
}

/**
 * Hook para buscar síntomas con debounce
 */
export function useSymptomSearch(
  search: string,
  options: UseSymptomSearchOptions = {}
) {
  const debouncedSearch = useDebounce(search, 300);

  return useQuery({
    queryKey: ['symptoms', debouncedSearch, options],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (debouncedSearch) params.set('search', debouncedSearch);
      if (options.componentId) params.set('componentId', String(options.componentId));
      if (options.subcomponentId) params.set('subcomponentId', String(options.subcomponentId));
      if (options.machineId) params.set('machineId', String(options.machineId));
      if (options.topUsed) params.set('topUsed', 'true');

      params.set('take', '20');

      const res = await fetch(`/api/symptom-library?${params}`);
      if (!res.ok) throw new Error('Error al buscar síntomas');

      const json = await res.json();
      return json.data as Symptom[];
    },
    enabled: debouncedSearch.length >= 2 || options.topUsed === true,
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para obtener los síntomas más usados
 */
export function useTopSymptoms(options: UseSymptomSearchOptions = {}) {
  return useQuery({
    queryKey: ['symptoms-top', options],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (options.componentId) params.set('componentId', String(options.componentId));
      if (options.subcomponentId) params.set('subcomponentId', String(options.subcomponentId));
      if (options.machineId) params.set('machineId', String(options.machineId));

      params.set('topUsed', 'true');
      params.set('take', '10');

      const res = await fetch(`/api/symptom-library?${params}`);
      if (!res.ok) throw new Error('Error al obtener síntomas');

      const json = await res.json();
      return json.data as Symptom[];
    },
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Hook para crear un síntoma nuevo
 */
export function useCreateSymptom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      keywords?: string[];
      shortNote?: string;
      componentId?: number;
      subcomponentId?: number;
      machineId?: number;
    }) => {
      const res = await fetch('/api/symptom-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear síntoma');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symptoms'] });
      queryClient.invalidateQueries({ queryKey: ['symptoms-top'] });
    },
  });
}

/**
 * Hook para incrementar uso de un síntoma
 */
export function useIncrementSymptomUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (symptomId: number) => {
      const res = await fetch(`/api/symptom-library/${symptomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // El backend debería tener un endpoint específico para esto
          // Por ahora solo actualizamos para invalidar cache
        }),
      });

      if (!res.ok) throw new Error('Error al actualizar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symptoms-top'] });
    },
  });
}
