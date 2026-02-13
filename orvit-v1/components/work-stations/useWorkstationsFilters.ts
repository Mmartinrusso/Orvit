import { useState, useCallback, useMemo } from 'react';

export type SortOption = 
  | 'name-asc' 
  | 'name-desc' 
  | 'instructives-desc' 
  | 'machines-desc' 
  | 'recent-desc';

export interface WorkstationsFilters {
  search: string;
  estado: string;
  hasInstructives: string;
  hasMachines: string;
  sortBy: SortOption;
  sectorId?: string;
}

const defaultFilters: WorkstationsFilters = {
  search: '',
  estado: 'all',
  hasInstructives: 'all',
  hasMachines: 'all',
  sortBy: 'name-asc',
};

export function useWorkstationsFilters() {
  const [filters, setFilters] = useState<WorkstationsFilters>(defaultFilters);

  const updateFilter = useCallback((key: keyof WorkstationsFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.estado !== 'all' ||
      filters.hasInstructives !== 'all' ||
      filters.hasMachines !== 'all' ||
      filters.sectorId
    );
  }, [filters]);

  return {
    filters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
  };
}

