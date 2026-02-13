import { useQuery } from '@tanstack/react-query';

interface PreviousSolution {
  id: number;
  occurrenceId: number;
  occurrenceDate: string;
  title: string;
  description: string;
  appliedById: number;
  appliedByName: string;
  appliedAt: string;
  actualHours: number | null;
  timeUnit: string;
  toolsUsed: any[];
  sparePartsUsed: any[];
  rootCause: string | null;
  preventiveActions: string | null;
  effectiveness: number | null;
  isPreferred: boolean;
  timesApplied?: number; // Cuántas veces se aplicó esta solución
}

interface UsePreviousSolutionsOptions {
  failureId?: number;
  machineId?: number;
  enabled?: boolean;
}

export function usePreviousSolutions({
  failureId,
  machineId,
  enabled = true
}: UsePreviousSolutionsOptions = {}) {
  return useQuery({
    queryKey: ['previous-solutions', failureId, machineId],
    queryFn: async () => {
      if (!failureId) {
        throw new Error('failureId is required');
      }

      const response = await fetch(`/api/failures/${failureId}/solutions`);

      if (!response.ok) {
        throw new Error('Error al obtener soluciones previas');
      }

      const data = await response.json();
      return {
        solutions: (data.solutions || []) as PreviousSolution[],
        failure: data.failure
      };
    },
    enabled: enabled && !!failureId
  });
}
