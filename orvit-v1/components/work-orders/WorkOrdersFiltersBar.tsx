'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { 
  Search, 
  SlidersHorizontal, 
  X, 
  LayoutGrid, 
  List,
  ArrowUpDown,
} from 'lucide-react';
import { WorkOrderStatus, Priority, MaintenanceType } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { WorkOrdersAdvancedFiltersSheet } from './WorkOrdersAdvancedFiltersSheet';
import {
  filterStatusLabels,
  filterPriorityLabels,
  sortByLabels,
  type WorkOrderFilters,
  defaultFilters,
} from './workOrders.helpers';

// Re-export para compatibilidad
export type { WorkOrderFilters };
export { defaultFilters };

interface WorkOrdersFiltersBarProps {
  filters: WorkOrderFilters;
  onFiltersChange: (filters: WorkOrderFilters) => void;
  onResetFilters: () => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
  availableUsers: Array<{ id: number; name: string; type: 'user' | 'worker' }>;
  availableMachines?: Array<{ id: number; name: string }>;
  className?: string;
  isAdvancedSheetOpen?: boolean;
  onAdvancedSheetOpenChange?: (open: boolean) => void;
}

export function WorkOrdersFiltersBar({
  filters,
  onFiltersChange,
  onResetFilters,
  viewMode,
  onViewModeChange,
  availableUsers,
  availableMachines = [],
  className,
  isAdvancedSheetOpen: externalIsAdvancedSheetOpen,
  onAdvancedSheetOpenChange,
}: WorkOrdersFiltersBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);
  const [internalIsAdvancedSheetOpen, setInternalIsAdvancedSheetOpen] = useState(false);
  
  // Usar estado externo si se proporciona, sino usar estado interno
  const isAdvancedSheetOpen = externalIsAdvancedSheetOpen !== undefined 
    ? externalIsAdvancedSheetOpen 
    : internalIsAdvancedSheetOpen;
  
  const setIsAdvancedSheetOpen = (open: boolean) => {
    if (onAdvancedSheetOpenChange) {
      onAdvancedSheetOpenChange(open);
    } else {
      setInternalIsAdvancedSheetOpen(open);
    }
  };

  // Sincronizar búsqueda debounced
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch]);

  // Sincronizar localSearch cuando cambia externamente
  useEffect(() => {
    if (filters.search !== localSearch && filters.search === '') {
      setLocalSearch('');
    }
  }, [filters.search]);

  const handleFilterChange = useCallback((key: keyof WorkOrderFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  // Generar chips de filtros activos
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; key: string; onRemove: () => void }> = [];

    if (filters.search) {
      chips.push({
        key: 'search',
        label: `"${filters.search}"`,
        onRemove: () => {
          setLocalSearch('');
          handleFilterChange('search', '');
        },
      });
    }

    if (filters.status && filters.status !== 'ALL' && filters.status !== 'OVERDUE') {
      chips.push({
        key: 'status',
        label: `Estado: ${filterStatusLabels[filters.status as WorkOrderStatus]}`,
        onRemove: () => handleFilterChange('status', null),
      });
    }

    if (filters.priority && filters.priority !== 'ALL') {
      chips.push({
        key: 'priority',
        label: `Prioridad: ${filterPriorityLabels[filters.priority as Priority]}`,
        onRemove: () => handleFilterChange('priority', null),
      });
    }

    if (filters.assignee && filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned') {
        chips.push({
          key: 'assignee',
          label: 'Sin asignar',
          onRemove: () => handleFilterChange('assignee', 'all'),
        });
      } else {
        const user = availableUsers.find(u => `${u.type}-${u.id}` === filters.assignee);
        if (user) {
          chips.push({
            key: 'assignee',
            label: user.name,
            onRemove: () => handleFilterChange('assignee', 'all'),
          });
        }
      }
    }

    if (filters.machineId) {
      const machine = availableMachines.find(m => m.id === filters.machineId);
      if (machine) {
        chips.push({
          key: 'machine',
          label: `Máquina: ${machine.name}`,
          onRemove: () => handleFilterChange('machineId', null),
        });
      }
    }

    if (filters.sortBy) {
      chips.push({
        key: 'sortBy',
        label: `Orden: ${sortByLabels[filters.sortBy]}`,
        onRemove: () => handleFilterChange('sortBy', undefined),
      });
    }

    if (filters.dateRange?.from || filters.dateRange?.to) {
      chips.push({
        key: 'dateRange',
        label: 'Rango de fechas',
        onRemove: () => handleFilterChange('dateRange', {}),
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      chips.push({
        key: 'tags',
        label: `${filters.tags.length} tags`,
        onRemove: () => handleFilterChange('tags', []),
      });
    }

    if (filters.onlyOverdue) {
      chips.push({
        key: 'overdue',
        label: 'Solo vencidas',
        onRemove: () => handleFilterChange('onlyOverdue', false),
      });
    }

    if (filters.onlyUnassigned) {
      chips.push({
        key: 'unassigned',
        label: 'Solo sin asignar',
        onRemove: () => handleFilterChange('onlyUnassigned', false),
      });
    }

    return chips;
  }, [filters, availableUsers, availableMachines, handleFilterChange]);

  const hasActiveFilters = activeFilterChips.length > 0;

  const handleReset = useCallback(() => {
    setLocalSearch('');
    onResetFilters();
  }, [onResetFilters]);

  return (
    <div className={className}>
      {/* Barra de filtros principal */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar órdenes..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-background"
          />
          {localSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => {
                setLocalSearch('');
                handleFilterChange('search', '');
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Estado */}
        <Select
          value={filters.status || 'ALL'}
          onValueChange={(value) => handleFilterChange('status', value === 'ALL' ? null : value)}
        >
          <SelectTrigger className="h-9 flex-1 min-w-[130px] text-xs bg-background">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value={WorkOrderStatus.PENDING}>Pendiente</SelectItem>
            <SelectItem value={WorkOrderStatus.IN_PROGRESS}>En proceso</SelectItem>
            <SelectItem value={WorkOrderStatus.COMPLETED}>Completada</SelectItem>
            <SelectItem value={WorkOrderStatus.CANCELLED}>Cancelada</SelectItem>
            <SelectItem value={WorkOrderStatus.ON_HOLD}>En espera</SelectItem>
          </SelectContent>
        </Select>

        {/* Prioridad */}
        <Select
          value={filters.priority || 'ALL'}
          onValueChange={(value) => handleFilterChange('priority', value === 'ALL' ? null : value)}
        >
          <SelectTrigger className="h-9 flex-1 min-w-[120px] text-xs bg-background">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value={Priority.LOW}>Baja</SelectItem>
            <SelectItem value={Priority.MEDIUM}>Media</SelectItem>
            <SelectItem value={Priority.HIGH}>Alta</SelectItem>
            <SelectItem value={Priority.URGENT}>Urgente</SelectItem>
          </SelectContent>
        </Select>

        {/* Responsable */}
        <Select
          value={filters.assignee || 'all'}
          onValueChange={(value) => handleFilterChange('assignee', value)}
        >
          <SelectTrigger className="h-9 flex-1 min-w-[150px] text-xs bg-background">
            <SelectValue placeholder="Responsable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
            {availableUsers.map((user) => (
              <SelectItem key={`${user.type}-${user.id}`} value={`${user.type}-${user.id}`}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Máquina */}
        {availableMachines.length > 0 && (
          <Select
            value={filters.machineId?.toString() || 'all'}
            onValueChange={(value) => handleFilterChange('machineId', value === 'all' ? null : parseInt(value))}
          >
            <SelectTrigger className="h-9 flex-1 min-w-[150px] text-xs bg-background">
              <SelectValue placeholder="Máquina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {availableMachines.map((machine) => (
                <SelectItem key={machine.id} value={machine.id.toString()}>
                  {machine.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Ordenar por */}
        <Select
          value={filters.sortBy || 'none'}
          onValueChange={(value) => handleFilterChange('sortBy', value === 'none' ? undefined : value)}
        >
          <SelectTrigger className="h-9 flex-1 min-w-[140px] text-xs bg-background">
            <ArrowUpDown className="h-3 w-3 mr-1.5" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin ordenar</SelectItem>
            <SelectItem value="dueDate">Vence primero</SelectItem>
            <SelectItem value="priority">Mayor prioridad</SelectItem>
            <SelectItem value="recent">Más reciente</SelectItem>
            <SelectItem value="created">Fecha creación</SelectItem>
          </SelectContent>
        </Select>

        {/* Filtros avanzados */}
        <WorkOrdersAdvancedFiltersSheet
          isOpen={isAdvancedSheetOpen}
          onOpenChange={setIsAdvancedSheetOpen}
          filters={filters}
          onFiltersChange={onFiltersChange}
          availableMachines={availableMachines}
        >
          <Button 
            variant="outline" 
            className="items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md px-3 h-9 text-xs"
          >
            <SlidersHorizontal className="h-3 w-3 mr-1.5" />
            Más filtros
          </Button>
        </WorkOrdersAdvancedFiltersSheet>

        {/* Toggle vista */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && onViewModeChange(value as 'grid' | 'table')}
          className="border border-border rounded-lg bg-background"
        >
          <ToggleGroupItem 
            value="grid" 
            aria-label="Vista de cuadrícula" 
            className="h-9 px-3 data-[state=on]:bg-muted"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="table" 
            aria-label="Vista de tabla" 
            className="h-9 px-3 data-[state=on]:bg-muted"
          >
            <List className="h-3.5 w-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Chips de filtros activos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-muted-foreground font-medium">Filtros:</span>
          {activeFilterChips.map((chip) => (
            <Badge
              key={chip.key}
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors pl-2 pr-1 py-1 gap-1"
              onClick={chip.onRemove}
            >
              {chip.label}
              <X className="h-3 w-3 ml-0.5" />
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-6 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar todo
          </Button>
        </div>
      )}
    </div>
  );
}
