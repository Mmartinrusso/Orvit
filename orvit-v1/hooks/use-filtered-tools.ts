import { useMemo } from 'react';

export interface Tool {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  itemType: string;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  stockQuantity: number;
  minStockLevel: number;
  location?: string | null;
  status?: string;
  isCritical?: boolean;
  supplier?: string | null;
  cost?: number | null;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface FilterOptions {
  searchTerm?: string;
  itemType?: string | 'all';
  category?: string | 'all';
  location?: string | 'all';
  stockFilter?: 'all' | 'ok' | 'low' | 'out' | 'critical';
  status?: string | 'all';
  sortBy?: 'name' | 'stock' | 'updated' | 'cost' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export interface FilteredToolsResult {
  filteredTools: Tool[];
  stats: {
    total: number;
    filtered: number;
    lowStock: number;
    outOfStock: number;
    critical: number;
    totalValue: number;
  };
  hasActiveFilters: boolean;
}

export function useFilteredTools(
  tools: Tool[],
  options: FilterOptions = {}
): FilteredToolsResult {
  const {
    searchTerm = '',
    itemType = 'all',
    category = 'all',
    location = 'all',
    stockFilter = 'all',
    status = 'all',
    sortBy = 'name',
    sortOrder = 'asc',
  } = options;

  const result = useMemo(() => {
    // Calculate stats from all tools (before filtering)
    const stats = {
      total: tools.length,
      filtered: 0,
      lowStock: tools.filter(t => t.stockQuantity > 0 && t.stockQuantity <= t.minStockLevel).length,
      outOfStock: tools.filter(t => t.stockQuantity === 0).length,
      critical: tools.filter(t => t.isCritical && t.stockQuantity <= t.minStockLevel).length,
      totalValue: tools.reduce((sum, t) => sum + ((t.cost || 0) * t.stockQuantity), 0),
    };

    // Filter tools
    let filtered = tools.filter((tool) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          tool.name.toLowerCase().includes(search) ||
          (tool.code || '').toLowerCase().includes(search) ||
          (tool.description || '').toLowerCase().includes(search) ||
          (tool.brand || '').toLowerCase().includes(search) ||
          (tool.model || '').toLowerCase().includes(search) ||
          (tool.supplier || '').toLowerCase().includes(search);

        if (!matchesSearch) return false;
      }

      // Item type filter
      if (itemType !== 'all' && tool.itemType !== itemType) {
        return false;
      }

      // Category filter
      if (category !== 'all' && tool.category !== category) {
        return false;
      }

      // Location filter
      if (location !== 'all' && tool.location !== location) {
        return false;
      }

      // Status filter
      if (status !== 'all' && tool.status !== status) {
        return false;
      }

      // Stock filter
      if (stockFilter !== 'all') {
        switch (stockFilter) {
          case 'ok':
            if (tool.stockQuantity <= tool.minStockLevel) return false;
            break;
          case 'low':
            if (tool.stockQuantity === 0 || tool.stockQuantity > tool.minStockLevel) return false;
            break;
          case 'out':
            if (tool.stockQuantity !== 0) return false;
            break;
          case 'critical':
            if (!tool.isCritical || tool.stockQuantity > tool.minStockLevel) return false;
            break;
        }
      }

      return true;
    });

    // Sort tools
    filtered = filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'stock':
          comparison = a.stockQuantity - b.stockQuantity;
          break;
        case 'updated':
          comparison = new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
          break;
        case 'cost':
          comparison = (a.cost || 0) - (b.cost || 0);
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    stats.filtered = filtered.length;

    // Check if any filters are active
    const hasActiveFilters =
      searchTerm !== '' ||
      itemType !== 'all' ||
      category !== 'all' ||
      location !== 'all' ||
      stockFilter !== 'all' ||
      status !== 'all';

    return {
      filteredTools: filtered,
      stats,
      hasActiveFilters,
    };
  }, [tools, searchTerm, itemType, category, location, stockFilter, status, sortBy, sortOrder]);

  return result;
}

// Helper to get unique values for filter dropdowns
export function useToolFilterOptions(tools: Tool[]) {
  return useMemo(() => {
    const categories = [...new Set(tools.map(t => t.category).filter(Boolean))] as string[];
    const locations = [...new Set(tools.map(t => t.location).filter(Boolean))] as string[];
    const itemTypes = [...new Set(tools.map(t => t.itemType))] as string[];
    const statuses = [...new Set(tools.map(t => t.status).filter(Boolean))] as string[];

    return {
      categories: categories.sort(),
      locations: locations.sort(),
      itemTypes,
      statuses,
    };
  }, [tools]);
}

export default useFilteredTools;
