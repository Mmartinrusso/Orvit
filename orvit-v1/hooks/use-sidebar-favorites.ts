import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCallback, useMemo } from 'react';

const QUERY_KEY = ['sidebar-favorites'] as const;

async function fetchFavorites(): Promise<string[]> {
  const res = await fetch('/api/user/sidebar/favorites');
  if (!res.ok) throw new Error('Failed to fetch favorites');
  const data = await res.json();
  return data.favorites as string[];
}

async function saveFavorites(favorites: string[]): Promise<string[]> {
  const res = await fetch('/api/user/sidebar/favorites', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorites }),
  });
  if (!res.ok) throw new Error('Failed to save favorites');
  const data = await res.json();
  return data.favorites as string[];
}

export function useSidebarFavorites() {
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFavorites,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const mutation = useMutation({
    mutationFn: saveFavorites,
    onMutate: async (newFavorites) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<string[]>(QUERY_KEY);
      queryClient.setQueryData<string[]>(QUERY_KEY, newFavorites);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      toast.error('Error al actualizar favoritos');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const isFavorite = useCallback(
    (moduleId: string) => favorites.includes(moduleId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (moduleId: string) => {
      const next = favorites.includes(moduleId)
        ? favorites.filter((id) => id !== moduleId)
        : [...favorites, moduleId];
      mutation.mutate(next);
    },
    [favorites, mutation]
  );

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading,
  };
}
