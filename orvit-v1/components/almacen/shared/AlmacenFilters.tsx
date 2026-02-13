'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWarehouses } from '../hooks';
import {
  MaterialRequestStatuses,
  MaterialRequestStatusLabels,
  MaterialRequestTypes,
  MaterialRequestTypeLabels,
  DespachoStatuses,
  DespachoStatusLabels,
  DespachoTypes,
  DespachoTypeLabels,
  DevolucionStatuses,
  DevolucionStatusLabels,
  ReservaStatuses,
  ReservaStatusLabels,
  Priorities,
  PriorityLabels,
} from '@/lib/almacen/types';

interface FilterOption {
  value: string;
  label: string;
}

interface AlmacenFiltersProps {
  // Filtros activos
  search?: string;
  estado?: string;
  tipo?: string;
  warehouseId?: number;
  urgencia?: string;

  // Callbacks
  onSearchChange?: (value: string) => void;
  onEstadoChange?: (value: string) => void;
  onTipoChange?: (value: string) => void;
  onWarehouseChange?: (value: number | undefined) => void;
  onUrgenciaChange?: (value: string) => void;
  onClear?: () => void;
  onRefresh?: () => void;

  // Configuración
  showSearch?: boolean;
  showEstado?: boolean;
  showTipo?: boolean;
  showWarehouse?: boolean;
  showUrgencia?: boolean;

  // Opciones personalizadas (o usar defaults)
  estadoOptions?: FilterOption[];
  tipoOptions?: FilterOption[];
  filterType?: 'solicitudes' | 'despachos' | 'devoluciones' | 'reservas';

  // Indicador de carga
  isLoading?: boolean;

  className?: string;
}

/**
 * Componente de filtros reutilizable para el módulo de almacén
 */
export function AlmacenFilters({
  search = '',
  estado = 'all',
  tipo = 'all',
  warehouseId,
  urgencia = 'all',
  onSearchChange,
  onEstadoChange,
  onTipoChange,
  onWarehouseChange,
  onUrgenciaChange,
  onClear,
  onRefresh,
  showSearch = true,
  showEstado = true,
  showTipo = false,
  showWarehouse = true,
  showUrgencia = false,
  estadoOptions,
  tipoOptions,
  filterType = 'solicitudes',
  isLoading = false,
  className,
}: AlmacenFiltersProps) {
  const { data: warehouses = [] } = useWarehouses();
  const [localSearch, setLocalSearch] = useState(search);

  // Obtener opciones por defecto según el tipo
  const defaultEstadoOptions = getDefaultEstadoOptions(filterType);
  const defaultTipoOptions = getDefaultTipoOptions(filterType);

  const finalEstadoOptions = estadoOptions || defaultEstadoOptions;
  const finalTipoOptions = tipoOptions || defaultTipoOptions;

  // Verificar si hay filtros activos
  const hasActiveFilters =
    search !== '' ||
    estado !== 'all' ||
    tipo !== 'all' ||
    warehouseId !== undefined ||
    urgencia !== 'all';

  // Handler para búsqueda con debounce
  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearchChange?.(localSearch);
    },
    [localSearch, onSearchChange]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        onSearchChange?.(localSearch);
      }
    },
    [localSearch, onSearchChange]
  );

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Búsqueda */}
        {showSearch && (
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-8 h-9"
            />
            {localSearch && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 w-7 p-0"
                onClick={() => {
                  setLocalSearch('');
                  onSearchChange?.('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </form>
        )}

        {/* Estado */}
        {showEstado && (
          <Select value={estado} onValueChange={onEstadoChange}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {finalEstadoOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Tipo */}
        {showTipo && (
          <Select value={tipo} onValueChange={onTipoChange}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {finalTipoOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Depósito */}
        {showWarehouse && (
          <Select
            value={warehouseId?.toString() || 'all'}
            onValueChange={(val) =>
              onWarehouseChange?.(val === 'all' ? undefined : Number(val))
            }
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Depósito" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los depósitos</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                  {warehouse.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Urgencia */}
        {showUrgencia && (
          <Select value={urgencia} onValueChange={onUrgenciaChange}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Urgencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Priorities.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {PriorityLabels[priority]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Botones de acción */}
        <div className="flex items-center gap-1 ml-auto">
          {hasActiveFilters && onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-9 px-2"
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}

          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-9 w-9 p-0"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function getDefaultEstadoOptions(type: string): FilterOption[] {
  switch (type) {
    case 'solicitudes':
      return MaterialRequestStatuses.map((s) => ({
        value: s,
        label: MaterialRequestStatusLabels[s],
      }));
    case 'despachos':
      return DespachoStatuses.map((s) => ({
        value: s,
        label: DespachoStatusLabels[s],
      }));
    case 'devoluciones':
      return DevolucionStatuses.map((s) => ({
        value: s,
        label: DevolucionStatusLabels[s],
      }));
    case 'reservas':
      return ReservaStatuses.map((s) => ({
        value: s,
        label: ReservaStatusLabels[s],
      }));
    default:
      return [];
  }
}

function getDefaultTipoOptions(type: string): FilterOption[] {
  switch (type) {
    case 'solicitudes':
      return MaterialRequestTypes.map((t) => ({
        value: t,
        label: MaterialRequestTypeLabels[t],
      }));
    case 'despachos':
      return DespachoTypes.map((t) => ({
        value: t,
        label: DespachoTypeLabels[t],
      }));
    default:
      return [];
  }
}

/**
 * Componente de chips para mostrar filtros activos
 */
export function ActiveFilterChips({
  filters,
  onRemove,
}: {
  filters: Array<{ key: string; label: string; value: string }>;
  onRemove: (key: string) => void;
}) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {filters.map((filter) => (
        <div
          key={filter.key}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
        >
          <span className="font-medium">{filter.label}:</span>
          <span>{filter.value}</span>
          <button
            onClick={() => onRemove(filter.key)}
            className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
