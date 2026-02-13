'use client';

import React, { useState, useCallback, useEffect } from 'react';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetBody,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Search, Filter, X, Grid3X3, List, Users } from 'lucide-react';
import { FilterOptions } from './AdvancedFilters';
import AdvancedFilters from './AdvancedFilters';
import { useDebounce } from '@/hooks/use-debounce';

interface WorkOrdersFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
  advancedFilters: FilterOptions;
  onAdvancedFiltersChange: (filters: FilterOptions) => void;
  onResetFilters: () => void;
  availableUsers: Array<{ id: number; name: string; type: 'user' | 'worker' }>;
  activeFiltersCount: number;
}

export function WorkOrdersFilters({
  searchValue,
  onSearchChange,
  assigneeFilter,
  onAssigneeChange,
  statusFilter,
  onStatusChange,
  viewMode,
  onViewModeChange,
  advancedFilters,
  onAdvancedFiltersChange,
  onResetFilters,
  availableUsers,
  activeFiltersCount,
}: WorkOrdersFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    onSearchChange(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
  }, []);

  const getActiveFilterChips = () => {
    const chips: Array<{ label: string; onRemove: () => void }> = [];

    if (searchValue) {
      chips.push({
        label: `Búsqueda: "${searchValue}"`,
        onRemove: () => {
          setLocalSearch('');
          onSearchChange('');
        },
      });
    }

    if (assigneeFilter !== 'all') {
      const user = availableUsers.find(u => `${u.type}-${u.id}` === assigneeFilter);
      chips.push({
        label: `Asignado: ${user?.name || 'Desconocido'}`,
        onRemove: () => onAssigneeChange('all'),
      });
    }

    if (statusFilter !== 'ALL') {
      const statusLabels: Record<string, string> = {
        PENDING: 'Pendiente',
        IN_PROGRESS: 'En Proceso',
        COMPLETED: 'Completada',
        CANCELLED: 'Cancelada',
      };
      chips.push({
        label: `Estado: ${statusLabels[statusFilter] || statusFilter}`,
        onRemove: () => onStatusChange('ALL'),
      });
    }

    if (advancedFilters.priority.length > 0) {
      chips.push({
        label: `Prioridad: ${advancedFilters.priority.join(', ')}`,
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, priority: [] }),
      });
    }

    if (advancedFilters.type.length > 0) {
      chips.push({
        label: `Tipo: ${advancedFilters.type.length} seleccionado(s)`,
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, type: [] }),
      });
    }

    if (advancedFilters.overdue) {
      chips.push({
        label: 'Vencidas',
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, overdue: false }),
      });
    }

    if (advancedFilters.unassigned) {
      chips.push({
        label: 'Sin asignar',
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, unassigned: false }),
      });
    }

    return chips;
  };

  const filterChips = getActiveFilterChips();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar órdenes..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>

        <Select value={assigneeFilter} onValueChange={onAssigneeChange}>
          <SelectTrigger className="h-10 w-[180px] text-sm">
            <Users className="h-3.5 w-3.5 mr-2" />
            <SelectValue placeholder="Asignado a..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
            {availableUsers.map((user) => (
              <SelectItem key={`${user.type}-${user.id}`} value={`${user.type}-${user.id}`}>
                {user.name} ({user.type === 'user' ? 'Usuario' : 'Operario'})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="h-10 w-[160px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="IN_PROGRESS">En Proceso</SelectItem>
            <SelectItem value="COMPLETED">Completada</SelectItem>
            <SelectItem value="CANCELLED">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-10 text-sm">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Filtros Avanzados
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" size="sm">
            <SheetHeader>
              <SheetTitle>Filtros Avanzados</SheetTitle>
              <SheetDescription>
                Configura filtros adicionales para encontrar órdenes específicas
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <AdvancedFilters
                filters={advancedFilters}
                onFiltersChange={onAdvancedFiltersChange}
                onReset={onResetFilters}
              />
            </SheetBody>
          </SheetContent>
        </Sheet>

        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && onViewModeChange(value as 'grid' | 'table')}
          className="border rounded-md"
        >
          <ToggleGroupItem value="grid" aria-label="Vista de cuadrícula" className="h-10 px-3">
            <Grid3X3 className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Vista de tabla" className="h-10 px-3">
            <List className="h-3.5 w-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtros activos:</span>
          {filterChips.map((chip, index) => (
            <Badge
              key={index}
              variant="outline"
              className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive"
              onClick={chip.onRemove}
            >
              {chip.label}
              <X className="h-3 w-3 ml-1.5" />
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Limpiar todo
          </Button>
        </div>
      )}
    </div>
  );
}

