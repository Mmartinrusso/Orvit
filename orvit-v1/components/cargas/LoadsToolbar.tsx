'use client';

/**
 * Barra de herramientas para la lista de cargas
 * Incluye búsqueda, filtros, vistas y acciones
 */

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  X,
  LayoutGrid,
  Table2,
  Filter,
  Download,
  Plus,
  CheckSquare,
  RefreshCw,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { TruckData } from '@/lib/cargas/types';
import { useDebouncedCallback } from 'use-debounce';
import { DateRange } from 'react-day-picker';

interface LoadsToolbarProps {
  // Búsqueda
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Filtros
  filterTruckType: 'ALL' | 'CHASIS' | 'EQUIPO' | 'SEMI';
  onFilterTruckTypeChange: (type: 'ALL' | 'CHASIS' | 'EQUIPO' | 'SEMI') => void;
  filterClient: string;
  onFilterClientChange: (client: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;

  // Clientes disponibles
  uniqueClients: string[];

  // Vista
  viewMode: 'card' | 'table';
  onViewModeChange: (mode: 'card' | 'table') => void;

  // Selección
  selectionMode: boolean;
  onSelectionModeChange: (mode: boolean) => void;
  selectedCount: number;

  // Acciones
  onCreateNew: () => void;
  onCreateWithAI?: () => void;
  onExport: () => void;
  onRefresh: () => void;

  // Permisos
  canManageLoads: boolean;

  // Estado
  isLoading?: boolean;
  totalCount?: number;
}

export default function LoadsToolbar({
  searchQuery,
  onSearchChange,
  filterTruckType,
  onFilterTruckTypeChange,
  filterClient,
  onFilterClientChange,
  dateRange,
  onDateRangeChange,
  uniqueClients,
  viewMode,
  onViewModeChange,
  selectionMode,
  onSelectionModeChange,
  selectedCount,
  onCreateNew,
  onCreateWithAI,
  onExport,
  onRefresh,
  canManageLoads,
  isLoading = false,
  totalCount,
}: LoadsToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Debounce búsqueda
  const debouncedSearch = useDebouncedCallback((value: string) => {
    onSearchChange(value);
  }, 300);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    debouncedSearch(value);
  };

  const clearSearch = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  const hasActiveFilters = filterTruckType !== 'ALL' || filterClient !== 'ALL' || dateRange;

  const clearAllFilters = () => {
    onFilterTruckTypeChange('ALL');
    onFilterClientChange('ALL');
    onDateRangeChange(undefined);
    clearSearch();
  };

  return (
    <div className="space-y-4">
      {/* Primera fila: Búsqueda y acciones principales */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Búsqueda */}
        <div className="flex-1 w-full sm:w-auto flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descripción, camión, cliente..."
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 bg-background"
            />
            {localSearch && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={clearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>

          {canManageLoads && (
            <>
              <Button onClick={onCreateNew} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Manual</span>
              </Button>
              {onCreateWithAI && (
                <Button onClick={onCreateWithAI} className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Nueva con IA</span>
                  <span className="sm:hidden">IA</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Segunda fila: Filtros y controles de vista */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Filtro por tipo de camión */}
          <Select
            value={filterTruckType}
            onValueChange={(value: any) => onFilterTruckTypeChange(value)}
          >
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los tipos</SelectItem>
              <SelectItem value="CHASIS">Chasis</SelectItem>
              <SelectItem value="EQUIPO">Equipo</SelectItem>
              <SelectItem value="SEMI">Semi</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por cliente */}
          <Select value={filterClient} onValueChange={onFilterClientChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los clientes</SelectItem>
              {uniqueClients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro por rango de fechas */}
          <DatePickerWithRange
            date={dateRange}
            onDateChange={onDateRangeChange}
          />

          {/* Indicador de filtros activos */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Limpiar filtros
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Contador de resultados */}
          {totalCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              {totalCount} carga{totalCount !== 1 ? 's' : ''}
            </span>
          )}

          {/* Toggle de selección */}
          {canManageLoads && (
            <Button
              variant={selectionMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onSelectionModeChange(!selectionMode)}
              className="gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              {selectionMode ? (
                selectedCount > 0 ? `${selectedCount} seleccionada${selectedCount !== 1 ? 's' : ''}` : 'Cancelar'
              ) : (
                'Seleccionar'
              )}
            </Button>
          )}

          {/* Toggle de vista */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('card')}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('table')}
              className="rounded-l-none"
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
