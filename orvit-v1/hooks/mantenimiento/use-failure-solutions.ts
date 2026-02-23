import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface FailureSolution {
  id: number;
  occurrenceId: number;
  title: string;
  description: string;
  appliedById: number;
  appliedByName: string | null;
  appliedAt: string;
  actualHours: number | null;
  timeUnit: string;
  toolsUsed: any[] | null;
  sparePartsUsed: any[] | null;
  rootCause: string | null;
  preventiveActions: string | null;
  attachments: any[] | null;
  effectiveness: number | null;
  isPreferred: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FailureSolutionsResponse {
  success: boolean;
  occurrence: {
    id: number;
    workOrderId: number;
    workOrderTitle: string;
    status: string;
  };
  solutions: FailureSolution[];
  totalSolutions: number;
}

interface CreateSolutionData {
  title: string;
  description: string;
  appliedById: number;
  appliedAt?: string;
  actualHours?: number;
  timeUnit?: string;
  toolsUsed?: any[];
  sparePartsUsed?: any[];
  rootCause?: string;
  preventiveActions?: string;
  attachments?: any[];
  effectiveness?: number;
  isPreferred?: boolean;
}

// Hook para obtener soluciones de una ocurrencia
export function useFailureSolutions(occurrenceId: number | null) {
  return useQuery({
    queryKey: ['failure-solutions', occurrenceId],
    queryFn: async (): Promise<FailureSolutionsResponse> => {
      if (!occurrenceId) throw new Error('Occurrence ID required');

      const response = await fetch(`/api/failure-occurrences/${occurrenceId}/solutions`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cargar soluciones');
      }

      return response.json();
    },
    enabled: !!occurrenceId,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

// Hook para agregar una solución a una ocurrencia
export function useAddSolution(occurrenceId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSolutionData): Promise<{ solution: FailureSolution; message: string }> => {
      if (!occurrenceId) throw new Error('Occurrence ID required');

      const response = await fetch(`/api/failure-occurrences/${occurrenceId}/solutions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al agregar solución');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidar cache de soluciones
      queryClient.invalidateQueries({ queryKey: ['failure-solutions', occurrenceId] });
      // Invalidar cache de fallas para actualizar el estado
      queryClient.invalidateQueries({ queryKey: ['failures'] });
      queryClient.invalidateQueries({ queryKey: ['machine-failures'] });
    },
  });
}

// Hook para obtener soluciones por WorkOrder ID
// Útil cuando solo tienes el workOrderId pero no el occurrenceId
export function useFailureSolutionsByWorkOrder(workOrderId: number | null) {
  return useQuery({
    queryKey: ['failure-solutions-by-workorder', workOrderId],
    queryFn: async (): Promise<FailureSolutionsResponse | null> => {
      if (!workOrderId) return null;

      // Primero obtener la ocurrencia por workOrderId
      // (esto requiere una API adicional o modificar la existente)
      // Por ahora, usamos el endpoint existente de solutions que ya maneja workOrderId
      const response = await fetch(`/api/failures/${workOrderId}/solutions`);

      if (!response.ok) {
        // Si no hay soluciones, retornar estructura vacía
        if (response.status === 404) {
          return null;
        }
        const error = await response.json();
        throw new Error(error.error || 'Error al cargar soluciones');
      }

      return response.json();
    },
    enabled: !!workOrderId,
    staleTime: 2 * 60 * 1000,
  });
}
