'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
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
  incidentType?: string;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only react to debounced value changes
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

  // Multi-select toggle helpers
  const toggleStatus = (value: string) => {
    const current = filters.status || [];
    const next = current.includes(value)
      ? current.filter(s => s !== value)
      : [...current, value];
    updateFilter('status', next.length > 0 ? next : undefined);
  };

  const togglePriority = (value: string) => {
    const current = filters.priority || [];
    const next = current.includes(value)
      ? current.filter(p => p !== value)
      : [...current, value];
    updateFilter('priority', next.length > 0 ? next : undefined);
  };

  const statusCount = filters.status?.length || 0;
  const priorityCount = filters.priority?.length || 0;

  const activeFilterCount = statusCount + priorityCount
    + (filters.causedDowntime ? 1 : 0)
    + (filters.isIntermittent ? 1 : 0)
    + (filters.machineId ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Búsqueda */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: '#9CA3AF' }} />
        <input
          placeholder="Buscar por título, notas..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{
            width: '100%',
            height: 34,
            paddingLeft: 32,
            paddingRight: searchInput ? 28 : 10,
            fontSize: 12,
            fontWeight: 400,
            color: '#374151',
            border: '1px solid #E4E4E8',
            borderRadius: 7,
            background: '#FAFAFA',
            outline: 'none',
            transition: 'border-color 150ms',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = '#FFFFFF'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#E4E4E8'; e.currentTarget.style.background = '#FAFAFA'; }}
        />
        {searchInput && (
          <button
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
            onClick={() => {
              setSearchInput('');
              updateFilter('search', undefined);
            }}
            style={{
              height: 20, width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer',
            }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Estado — Multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="hidden sm:flex"
            style={{
              height: 34, padding: '0 10px', fontSize: 12, fontWeight: 500,
              border: '1px solid #E4E4E8', borderRadius: 7,
              background: '#FAFAFA', color: '#6B7280',
              display: 'flex', alignItems: 'center', gap: 4,
              cursor: 'pointer', transition: '120ms', whiteSpace: 'nowrap',
            }}
          >
            Estado
            {statusCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 5px',
                borderRadius: 4, background: '#111827', color: '#FFFFFF',
                lineHeight: '14px',
              }}>
                {statusCount}
              </span>
            )}
            <ChevronDown className="h-3 w-3" style={{ color: '#9CA3AF', marginLeft: 2 }} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STATUS_OPTIONS.filter(o => o.value !== 'ALL').map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={filters.status?.includes(option.value) || false}
              onCheckedChange={() => toggleStatus(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Máquina — oculto en móvil */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="hidden sm:flex"
            style={{
              height: 34, padding: '0 10px', fontSize: 12, fontWeight: 500,
              border: '1px solid #E4E4E8', borderRadius: 7,
              background: '#FAFAFA', color: '#6B7280',
              display: 'flex', alignItems: 'center', gap: 4,
              cursor: 'pointer', transition: '120ms', whiteSpace: 'nowrap',
              minWidth: 100,
            }}
          >
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {filters.machineId
                ? machines?.find((m) => m.id === filters.machineId)?.name || 'Máquina'
                : 'Todas'}
            </span>
            <ChevronDown className="h-3 w-3" style={{ color: '#9CA3AF', flexShrink: 0 }} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[280px] overflow-y-auto">
          <DropdownMenuCheckboxItem
            checked={!filters.machineId}
            onCheckedChange={() => updateFilter('machineId', undefined)}
          >
            Todas
          </DropdownMenuCheckboxItem>
          {machines?.map((machine) => (
            <DropdownMenuCheckboxItem
              key={machine.id}
              checked={filters.machineId === machine.id}
              onCheckedChange={() =>
                updateFilter('machineId', filters.machineId === machine.id ? undefined : machine.id)
              }
            >
              {machine.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Prioridad — Multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="hidden sm:flex"
            style={{
              height: 34, padding: '0 10px', fontSize: 12, fontWeight: 500,
              border: '1px solid #E4E4E8', borderRadius: 7,
              background: '#FAFAFA', color: '#6B7280',
              display: 'flex', alignItems: 'center', gap: 4,
              cursor: 'pointer', transition: '120ms', whiteSpace: 'nowrap',
            }}
          >
            Prioridad
            {priorityCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 5px',
                borderRadius: 4, background: '#111827', color: '#FFFFFF',
                lineHeight: '14px',
              }}>
                {priorityCount}
              </span>
            )}
            <ChevronDown className="h-3 w-3" style={{ color: '#9CA3AF', marginLeft: 2 }} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PRIORITY_OPTIONS.filter(o => o.value !== 'ALL').map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={filters.priority?.includes(option.value) || false}
              onCheckedChange={() => togglePriority(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Toggle Downtime */}
      <button
        className="hidden sm:inline-flex"
        onClick={() => toggleBooleanFilter('causedDowntime')}
        style={{
          height: 34, padding: '0 10px', fontSize: 12, fontWeight: 500,
          border: filters.causedDowntime ? '1px solid #111827' : '1px solid #E4E4E8',
          borderRadius: 7,
          background: filters.causedDowntime ? '#111827' : '#FAFAFA',
          color: filters.causedDowntime ? '#FFFFFF' : '#6B7280',
          cursor: 'pointer', transition: '120ms', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center',
        }}
      >
        Downtime
      </button>

      {/* Toggle Intermitente */}
      <button
        className="hidden sm:inline-flex"
        onClick={() => toggleBooleanFilter('isIntermittent')}
        style={{
          height: 34, padding: '0 10px', fontSize: 12, fontWeight: 500,
          border: filters.isIntermittent ? '1px solid #111827' : '1px solid #E4E4E8',
          borderRadius: 7,
          background: filters.isIntermittent ? '#111827' : '#FAFAFA',
          color: filters.isIntermittent ? '#FFFFFF' : '#6B7280',
          cursor: 'pointer', transition: '120ms', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center',
        }}
      >
        Intermitente
      </button>

      {/* Botón Filtros Avanzados */}
      <button
        onClick={onAdvancedFiltersOpen}
        aria-label="Filtros avanzados"
        style={{
          height: 34, padding: '0 10px', fontSize: 12, fontWeight: 500,
          border: '1px solid #E4E4E8', borderRadius: 7,
          background: '#FAFAFA', color: '#6B7280',
          cursor: 'pointer', transition: '120ms', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
        <span className="hidden sm:inline">Avanzados</span>
      </button>

      {/* Active filter count indicator */}
      {activeFilterCount > 0 && (
        <button
          onClick={() => {
            onFiltersChange({});
            setSearchInput('');
          }}
          style={{
            height: 24, padding: '0 8px', fontSize: 10, fontWeight: 600,
            borderRadius: 12, border: 'none',
            background: '#F3F4F6', color: '#9CA3AF',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            transition: '120ms',
          }}
        >
          {activeFilterCount} filtro{activeFilterCount !== 1 ? 's' : ''}
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
