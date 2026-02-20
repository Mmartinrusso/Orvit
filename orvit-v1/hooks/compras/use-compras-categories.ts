'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Category {
  id: number;
  name: string;
  description: string | null;
  code: string | null;
  color: string | null;
  icon: string | null;
  parentId: number | null;
  isActive: boolean;
  sortOrder: number;
  parent?: { id: number; name: string } | null;
  children?: Category[];
  _count?: { supplies: number; children: number };
}

const CATEGORIES_TREE_KEY = 'compras-categories-tree';
const CATEGORIES_FLAT_KEY = 'compras-categories-flat';

async function fetchCategoriesTree(): Promise<Category[]> {
  const res = await fetch('/api/compras/categorias');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.categories || [];
}

async function fetchCategoriesFlat(): Promise<Category[]> {
  const res = await fetch('/api/compras/categorias?flat=true');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.categories || [];
}

export function useComprasCategories(enabled = true) {
  const queryClient = useQueryClient();

  const tree = useQuery({
    queryKey: [CATEGORIES_TREE_KEY],
    queryFn: fetchCategoriesTree,
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const flat = useQuery({
    queryKey: [CATEGORIES_FLAT_KEY],
    queryFn: fetchCategoriesFlat,
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  return {
    categories: tree.data ?? [],
    flatCategories: flat.data ?? [],
    isLoading: tree.isLoading || flat.isLoading,
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_TREE_KEY] });
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_FLAT_KEY] });
    },
  };
}

export type { Category };
