'use client';

import React from 'react';
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
import {
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  Plus,
  X,
  SlidersHorizontal,
  Download,
} from 'lucide-react';
import { UnitsFilters, SortOption } from './useUnitsFilters';
import { cn } from '@/lib/utils';

interface UnitsToolbarProps {
  totalCount: number;
  filteredCount: number;
  filters: UnitsFilters;
  onFiltersChange: (filters: UnitsFilters) => void;
  onRefresh: () => void;
  onCreateUnit: () => void;
  onExport?: () => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
  canCreate: boolean;
  refreshing?: boolean;
  availableSectores: Array<{ id: number; name: string }>;
  tiposUnidad: string[];
  className?: string;
}

export function UnitsToolbar({
  totalCount,
  filteredCount,
  filters,
  onFiltersChange,
  onRefresh,
  onCreateUnit,
  onExport,
  viewMode,
  onViewModeChange,
  canCreate,
  refreshing = false,
  availableSectores,
  tiposUnidad,
  className,
}: UnitsToolbarProps) {
  const hasFilters = filteredCount !== totalCount;

  const handleFilterChange = (key: keyof UnitsFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: 'name-asc', label: 'A-Z' },
    { value: 'name-desc', label: 'Z-A' },
    { value: 'sector', label: 'Sector' },
    { value: 'updated-desc', label: 'Última actualización' },
    { value: 'meter-asc', label: 'Medidor (menor)' },
    { value: 'meter-desc', label: 'Medidor (mayor)' },
    { value: 'next-service-asc', label: 'Próximo service (próximo)' },
    { value: 'next-service-desc', label: 'Próximo service (lejano)' },
  ];

  const activeFilterChips = React.useMemo(() => {
    const chips: Array<{ label: string; key: string; onRemove: () => void }> = [];
    
    if (filters.tipo !== 'all') {
      chips.push({
        label: `Tipo: ${filters.tipo}`,
        key: 'tipo',
        onRemove: () => handleFilterChange('tipo', 'all'),
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
        onRemove: () => handleFilterChange('estado', 'all'),
      });
    }
    
    if (filters.sectorId !== 'all') {
      const sector = availableSectores.find(s => s.id.toString() === filters.sectorId);
      chips.push({
        label: `Sector: ${sector?.name || filters.sectorId}`,
        key: 'sectorId',
        onRemove: () => handleFilterChange('sectorId', 'all'),
      });
    }

    return chips;
  }, [filters, availableSectores]);

  const hasActiveFilters = activeFilterChips.length > 0 || filters.search;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header Sticky */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 gap-4">
          {/* Lado izquierdo: Título y contador */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">
                Unidades Móviles
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Gestión de vehículos, equipos móviles y unidades de transporte
              </p>
            </div>
            <Badge 
              variant="secondary" 
              className="text-xs font-medium tabular-nums shrink-0"
            >
              {hasFilters ? (
                <span>
                  <span className="font-semibold">{filteredCount}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span>{totalCount}</span>
                </span>
              ) : (
                <span>{totalCount} {totalCount === 1 ? 'unidad' : 'unidades'}</span>
              )}
            </Badge>
          </div>

          {/* Lado derecho: Acciones */}
          <div className="flex gap-2 flex-wrap sm:flex-nowrap items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-9 w-9 p-0"
              aria-label="Actualizar"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
            {onExport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                className="h-9 w-9 p-0"
                aria-label="Exportar CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('grid')}
                className="h-9 w-9 p-0 rounded-r-none"
                aria-label="Vista de grilla"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('table')}
                className="h-9 w-9 p-0 rounded-l-none border-l"
                aria-label="Vista de tabla"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            {canCreate && (
              <Button
                onClick={onCreateUnit}
                size="lg"
                className="items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-md px-3 bg-black hover:bg-gray-800 text-white hidden sm:inline-flex text-xs"
              >
                <Plus className="h-3 w-3 mr-2" />
                Nueva Unidad
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-4 md:px-6">
        <div className="flex flex-wrap items-center gap-2 h-10">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, patente, marca..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Select value={filters.tipo} onValueChange={(v) => handleFilterChange('tipo', v)}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {tiposUnidad.map(tipo => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.estado} onValueChange={(v) => handleFilterChange('estado', v)}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="ACTIVO">Activo</SelectItem>
              <SelectItem value="MANTENIMIENTO">En mantenimiento</SelectItem>
              <SelectItem value="FUERA_SERVICIO">Fuera de servicio</SelectItem>
              <SelectItem value="DESHABILITADO">Deshabilitado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.sortBy} onValueChange={(v) => handleFilterChange('sortBy', v as SortOption)}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="lg" className="text-xs">
                <SlidersHorizontal className="h-3 w-3 mr-2" />
                Filtros avanzados
              </Button>
            </SheetTrigger>
            <SheetContent side="right" size="md">
              <SheetHeader>
                <SheetTitle>Filtros avanzados</SheetTitle>
                <SheetDescription>
                  Aplicá filtros adicionales para encontrar unidades específicas
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sector</label>
                  <Select value={filters.sectorId} onValueChange={(v) => handleFilterChange('sectorId', v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todos los sectores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los sectores</SelectItem>
                      {availableSectores.map(sector => (
                        <SelectItem key={sector.id} value={sector.id.toString()}>
                          {sector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </SheetBody>
            </SheetContent>
          </Sheet>
        </div>

        {/* Active Filters Chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-muted-foreground">Filtros activos:</span>
            {activeFilterChips.map((chip) => (
              <Badge
                key={chip.key}
                variant="secondary"
                className="text-xs px-2 py-0.5 h-6 flex items-center gap-1.5"
              >
                <span>{chip.label}</span>
                <button
                  onClick={chip.onRemove}
                  className="hover:bg-muted rounded-full p-0.5 -mr-1"
                  aria-label={`Remover filtro ${chip.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {filters.search && (
              <Badge
                variant="secondary"
                className="text-xs px-2 py-0.5 h-6 flex items-center gap-1.5"
              >
                <span>Búsqueda: "{filters.search}"</span>
                <button
                  onClick={() => handleFilterChange('search', '')}
                  className="hover:bg-muted rounded-full p-0.5 -mr-1"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                handleFilterChange('search', '');
                handleFilterChange('tipo', 'all');
                handleFilterChange('estado', 'all');
                handleFilterChange('sectorId', 'all');
              }}
              className="h-6 text-xs px-2"
            >
              Limpiar todo
            </Button>
          </div>
        )}

        {/* Results count */}
        {hasFilters && (
          <p className="text-xs text-muted-foreground mt-2">
            Mostrando {filteredCount} de {totalCount} unidades
          </p>
        )}
      </div>
    </div>
  );
}

