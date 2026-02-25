'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useDebounce } from '@/hooks/use-debounce';

export interface FailureFilters {
  search?: string;
  status?: string[];
  machineId?: number;
  priority?: string[];
  causedDowntime?: boolean;
  isIntermittent?: boolean;
  isObservation?: boolean;
  // Advanced filters
  dateFrom?: string;
  dateTo?: string;
  componentId?: number;
  subcomponentId?: number;
  reportedById?: number;
  hasWorkOrder?: boolean;
  hasDuplicates?: boolean;
}

interface FailureFiltersBarProps {
  filters: FailureFilters;
  onFiltersChange: (filters: FailureFilters) => void;
  onAdvancedFiltersOpen: () => void;
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'REPORTED', label: 'Reportada' },
  { value: 'IN_PROGRESS', label: 'En Proceso' },
  { value: 'RESOLVED', label: 'Resuelta' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

const PRIORITY_OPTIONS = [
  { value: 'ALL', label: 'Todas' },
  { value: 'P1', label: 'P1 - Urgente' },
  { value: 'P2', label: 'P2 - Alta' },
  { value: 'P3', label: 'P3 - Media' },
  { value: 'P4', label: 'P4 - Baja' },
];

interface Machine {
  id: number;
  name: string;
}

/**
 * Barra de filtros para la lista de fallas
 * Incluye: búsqueda, estado, máquina, prioridad, toggles
 */
export function FailureFiltersBar({
  filters,
  onFiltersChange,
  onAdvancedFiltersOpen,
}: FailureFiltersBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const debouncedSearch = useDebounce(searchInput, 300);

  const { currentSector } = useCompany();

  // Cargar máquinas
  const { data: machines } = useQuery<Machine[]>({
    queryKey: ['machines-filter', currentSector?.id],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '200' });
      if (currentSector?.id) {
        params.append('sectorId', currentSector.id.toString());
      }
      const res = await fetch(`/api/machines?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.machines || json.data || json;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Sincronizar búsqueda debounced
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ ...filters, search: debouncedSearch || undefined });
    }
  }, [debouncedSearch]);

  // Update filter
  const updateFilter = useCallback(
    <K extends keyof FailureFilters>(key: K, value: FailureFilters[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  // Toggle boolean filter
  const toggleBooleanFilter = (
    key: 'causedDowntime' | 'isIntermittent' | 'isObservation'
  ) => {
    const current = filters[key];
    updateFilter(key, current === true ? undefined : true);
  };

  // Get current status value for select (single select now)
  const currentStatus = filters.status?.length === 1 ? filters.status[0] : 'ALL';
  const currentPriority = filters.priority?.length === 1 ? filters.priority[0] : 'ALL';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Búsqueda */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por título, notas..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 h-9 text-xs bg-background"
        />
        {searchInput && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => {
              setSearchInput('');
              updateFilter('search', undefined);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Estado — oculto en móvil, disponible en AdvancedFiltersSheet */}
      <Select
        value={currentStatus}
        onValueChange={(value) =>
          updateFilter('status', value === 'ALL' ? undefined : [value])
        }
      >
        <SelectTrigger className="hidden sm:flex h-9 w-[120px] text-xs bg-background">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Máquina — oculto en móvil */}
      <Select
        value={filters.machineId?.toString() || 'ALL'}
        onValueChange={(value) =>
          updateFilter('machineId', value === 'ALL' ? undefined : parseInt(value))
        }
      >
        <SelectTrigger className="hidden sm:flex h-9 w-[140px] text-xs bg-background">
          <SelectValue placeholder="Máquina" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todas</SelectItem>
          {machines?.map((machine) => (
            <SelectItem key={machine.id} value={machine.id.toString()}>
              {machine.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Prioridad — oculto en móvil */}
      <Select
        value={currentPriority}
        onValueChange={(value) =>
          updateFilter('priority', value === 'ALL' ? undefined : [value])
        }
      >
        <SelectTrigger className="hidden sm:flex h-9 w-[120px] text-xs bg-background">
          <SelectValue placeholder="Prioridad" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Toggle Downtime — oculto en móvil */}
      <Button
        variant={filters.causedDowntime ? 'default' : 'outline'}
        size="sm"
        className="hidden sm:inline-flex h-9 text-xs"
        onClick={() => toggleBooleanFilter('causedDowntime')}
      >
        Downtime
      </Button>

      {/* Toggle Intermitente — oculto en móvil */}
      <Button
        variant={filters.isIntermittent ? 'default' : 'outline'}
        size="sm"
        className="hidden sm:inline-flex h-9 text-xs"
        onClick={() => toggleBooleanFilter('isIntermittent')}
      >
        Intermitente
      </Button>

      {/* Botón Filtros Avanzados — siempre visible */}
      <Button
        variant="outline"
        size="sm"
        className="h-9 text-xs gap-1 sm:px-3 px-2.5"
        onClick={onAdvancedFiltersOpen}
        aria-label="Filtros avanzados"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Avanzados</span>
      </Button>
    </div>
  );
}
