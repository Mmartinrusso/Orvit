import { useState, useCallback, useMemo } from 'react';

export type SortOption = 
  | 'name-asc' 
  | 'name-desc' 
  | 'sector' 
  | 'updated-desc' 
  | 'meter-asc' 
  | 'meter-desc'
  | 'next-service-asc'
  | 'next-service-desc';

export interface UnitsFilters {
  search: string;
  tipo: string;
  estado: string;
  sectorId: string;
  sortBy: SortOption;
}

const defaultFilters: UnitsFilters = {
  search: '',
  tipo: 'all',
  estado: 'all',
  sectorId: 'all',
  sortBy: 'name-asc',
};

export function useUnitsFilters() {
  const [filters, setFilters] = useState<UnitsFilters>(defaultFilters);

  const updateFilter = useCallback((key: keyof UnitsFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.tipo !== 'all' ||
      filters.estado !== 'all' ||
      filters.sectorId !== 'all'
    );
  }, [filters]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; key: string; onRemove: () => void }> = [];
    
    if (filters.tipo !== 'all') {
      chips.push({
        label: `Tipo: ${filters.tipo}`,
        key: 'tipo',
        onRemove: () => updateFilter('tipo', 'all'),
      });
    }
    
    if (filters.estado !== 'all') {
      const estadoLabels: Record<string, string> = {
        'ACTIVO': 'Activo',
        'MANTENIMIENTO': 'En mantenimiento',
        'FUERA_SERVICIO': 'Fuera de servicio',
        'DESHABILITADO': 'Deshabilitado',
      };
      chips.push({
        label: `Estado: ${estadoLabels[filters.estado] || filters.estado}`,
        key: 'estado',
        onRemove: () => updateFilter('estado', 'all'),
      });
    }
    
    if (filters.sectorId !== 'all') {
      chips.push({
        label: `Sector: ${filters.sectorId}`,
        key: 'sectorId',
        onRemove: () => updateFilter('sectorId', 'all'),
      });
    }

    return chips;
  }, [filters, updateFilter]);

  return {
    filters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
    activeFilterChips,
  };
}

