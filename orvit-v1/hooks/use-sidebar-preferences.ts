import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface SidebarPreferences {
  visible: string[];
  pinned: string[];
  order: string[];
  collapsed: string[];
}

/**
 * Hook to manage user's sidebar preferences for a specific module
 */
export function useSidebarPreferences(module: 'ventas') {
  const queryClient = useQueryClient();

  // Fetch preferences
  const { data, isLoading, error } = useQuery({
    queryKey: ['sidebar-preferences', module],
    queryFn: async () => {
      const response = await fetch(`/api/user/sidebar/${module}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sidebar preferences');
      }
      const data = await response.json();
      return data.preferences as SidebarPreferences;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update preferences
  const updateMutation = useMutation({
    mutationFn: async (newPreferences: Partial<SidebarPreferences>) => {
      const response = await fetch(`/api/user/sidebar/${module}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visible: newPreferences.visible || data?.visible || [],
          pinned: newPreferences.pinned || data?.pinned || [],
          order: newPreferences.order || data?.order || [],
          collapsed: newPreferences.collapsed || data?.collapsed || [],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update sidebar preferences');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-preferences', module] });
      toast.success('Preferencias actualizadas');
    },
    onError: (error) => {
      console.error('Error updating sidebar preferences:', error);
      toast.error('Error al actualizar preferencias');
    },
  });

  // Helper functions
  const toggleModule = (moduleId: string) => {
    if (!data) return;

    const isVisible = data.visible.includes(moduleId);
    const newVisible = isVisible
      ? data.visible.filter((id) => id !== moduleId)
      : [...data.visible, moduleId];

    updateMutation.mutate({ visible: newVisible });
  };

  const togglePin = (moduleId: string) => {
    if (!data) return;

    const isPinned = data.pinned.includes(moduleId);
    const newPinned = isPinned
      ? data.pinned.filter((id) => id !== moduleId)
      : [...data.pinned, moduleId];

    updateMutation.mutate({ pinned: newPinned });
  };

  const reorderModules = (newOrder: string[]) => {
    updateMutation.mutate({ order: newOrder });
  };

  const toggleCollapsed = (sectionId: string) => {
    if (!data) return;

    const isCollapsed = data.collapsed.includes(sectionId);
    const newCollapsed = isCollapsed
      ? data.collapsed.filter((id) => id !== sectionId)
      : [...data.collapsed, sectionId];

    updateMutation.mutate({ collapsed: newCollapsed });
  };

  const resetToDefaults = () => {
    // Fetch default preferences from the backend
    updateMutation.mutate({
      visible: [],
      pinned: [],
      order: [],
      collapsed: [],
    });
  };

  return {
    preferences: data,
    isLoading,
    error,
    toggleModule,
    togglePin,
    reorderModules,
    toggleCollapsed,
    resetToDefaults,
    updatePreferences: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
