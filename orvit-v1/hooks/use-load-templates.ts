'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadItem, LoadTemplate } from '@/lib/cargas/types';
import { toast } from 'sonner';

interface UseLoadTemplatesResult {
  templates: LoadTemplate[];
  isLoading: boolean;
  createTemplate: (name: string, items: LoadItem[], truckId?: number | null) => Promise<void>;
  updateTemplate: (id: number, data: Partial<LoadTemplate>) => Promise<void>;
  deleteTemplate: (id: number) => Promise<void>;
  applyTemplate: (template: LoadTemplate) => LoadItem[];
}

/**
 * Hook para gestionar templates de carga
 */
export function useLoadTemplates(companyId: number | null | undefined): UseLoadTemplatesResult {
  const queryClient = useQueryClient();

  // Obtener templates
  const { data: templates = [], isLoading } = useQuery<LoadTemplate[]>({
    queryKey: ['load-templates', companyId],
    queryFn: async () => {
      const response = await fetch('/api/load-templates', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al obtener templates');
      return response.json();
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Crear template
  const createMutation = useMutation({
    mutationFn: async ({
      name,
      items,
      truckId,
    }: {
      name: string;
      items: LoadItem[];
      truckId?: number | null;
    }) => {
      const response = await fetch('/api/load-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, items, truckId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['load-templates'] });
      toast.success('Template guardado correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Actualizar template
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LoadTemplate> }) => {
      const response = await fetch(`/api/load-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['load-templates'] });
      toast.success('Template actualizado');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Eliminar template
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/load-templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['load-templates'] });
      toast.success('Template eliminado');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Aplicar template (convertir a items de carga)
  const applyTemplate = (template: LoadTemplate): LoadItem[] => {
    return template.items.map((item, index) => ({
      ...item,
      id: undefined, // Resetear IDs
      position: index,
    }));
  };

  return {
    templates,
    isLoading,
    createTemplate: async (name, items, truckId) => {
      await createMutation.mutateAsync({ name, items, truckId });
    },
    updateTemplate: async (id, data) => {
      await updateMutation.mutateAsync({ id, data });
    },
    deleteTemplate: async (id) => {
      await deleteMutation.mutateAsync(id);
    },
    applyTemplate,
  };
}

export default useLoadTemplates;
