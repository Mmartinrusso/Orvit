import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface FailureType {
  id: number;
  title: string;
  description: string | null;
  machineId: number;
  machineName: string | null;
  failureType: string;
  priority: string;
  estimatedHours: number | null;
  affectedComponents: number[] | null;
  isActive: boolean;
  occurrencesCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UseFailureTypesOptions {
  companyId: number | null;
  machineId?: number | null;
  search?: string;
  isActive?: boolean;
  enabled?: boolean;
}

interface CreateFailureTypeData {
  title: string;
  description?: string;
  machineId: number;
  companyId?: number;
  failureType?: string;
  priority?: string;
  estimatedHours?: number;
  affectedComponents?: number[];
}

// Hook para obtener tipos de falla del catálogo
export function useFailureTypes(options: UseFailureTypesOptions) {
  const { companyId, machineId, search, isActive, enabled = true } = options;

  return useQuery({
    queryKey: ['failure-types', companyId, machineId, search, isActive],
    queryFn: async (): Promise<{ failureTypes: FailureType[] }> => {
      const params = new URLSearchParams();

      if (companyId) params.append('companyId', String(companyId));
      if (machineId) params.append('machineId', String(machineId));
      if (search) params.append('search', search);
      if (isActive !== undefined) params.append('isActive', String(isActive));

      const response = await fetch(`/api/failure-types?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cargar tipos de falla');
      }

      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Hook para crear un nuevo tipo de falla
export function useCreateFailureType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFailureTypeData): Promise<{ failureType: FailureType }> => {
      const response = await fetch('/api/failure-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear tipo de falla');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidar cache de tipos de falla
      queryClient.invalidateQueries({ queryKey: ['failure-types'] });
    },
  });
}

// Hook para buscar tipos de falla por texto
export function useSearchFailureTypes(
  companyId: number | null,
  machineId: number | null,
  searchTerm: string
) {
  return useFailureTypes({
    companyId,
    machineId: machineId || undefined,
    search: searchTerm,
    isActive: true,
    enabled: !!companyId && searchTerm.length >= 2,
  });
}
