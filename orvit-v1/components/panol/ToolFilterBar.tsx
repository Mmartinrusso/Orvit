'use client';

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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  X,
  Filter,
  SortAsc,
  SortDesc,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToolFilterBarProps {
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // Filters
  itemType?: string;
  onItemTypeChange?: (value: string) => void;
  showItemTypeFilter?: boolean;

  category?: string;
  onCategoryChange?: (value: string) => void;
  categories?: string[];
  showCategoryFilter?: boolean;

  location?: string;
  onLocationChange?: (value: string) => void;
  locations?: string[];
  showLocationFilter?: boolean;

  stockFilter?: string;
  onStockFilterChange?: (value: string) => void;
  showStockFilter?: boolean;

  // Sort
  sortBy?: string;
  onSortByChange?: (value: string) => void;
  sortOrder?: 'asc' | 'desc';
  onSortOrderChange?: (value: 'asc' | 'desc') => void;
  sortOptions?: { value: string; label: string }[];
  showSort?: boolean;

  // View mode
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (value: 'grid' | 'list') => void;
  showViewToggle?: boolean;

  // Results
  resultCount?: number;
  totalCount?: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;

  // Refresh
  onRefresh?: () => void;
  isRefreshing?: boolean;

  // Custom class
  className?: string;
}

const ITEM_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'TOOL', label: 'Herramientas' },
  { value: 'SUPPLY', label: 'Insumos' },
  { value: 'SPARE_PART', label: 'Repuestos' },
  { value: 'HAND_TOOL', label: 'Herr. Manuales' },
];

const STOCK_FILTER_OPTIONS = [
  { value: 'all', label: 'Todo el stock' },
  { value: 'ok', label: 'Stock OK' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'out', label: 'Sin stock' },
  { value: 'critical', label: 'Críticos' },
];

const DEFAULT_SORT_OPTIONS = [
  { value: 'name', label: 'Nombre' },
  { value: 'stock', label: 'Stock' },
  { value: 'updated', label: 'Actualización' },
  { value: 'cost', label: 'Costo' },
];

export function ToolFilterBar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Buscar por nombre, código, marca...',

  itemType = 'all',
  onItemTypeChange,
  showItemTypeFilter = true,

  category = 'all',
  onCategoryChange,
  categories = [],
  showCategoryFilter = false,

  location = 'all',
  onLocationChange,
  locations = [],
  showLocationFilter = false,

  stockFilter = 'all',
  onStockFilterChange,
  showStockFilter = true,

  sortBy = 'name',
  onSortByChange,
  sortOrder = 'asc',
  onSortOrderChange,
  sortOptions = DEFAULT_SORT_OPTIONS,
  showSort = true,

  viewMode = 'list',
  onViewModeChange,
  showViewToggle = false,

  resultCount,
  totalCount,
  hasActiveFilters = false,
  onClearFilters,

  onRefresh,
  isRefreshing = false,

  className,
}: ToolFilterBarProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Main filter row */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-8"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => onSearchChange('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Item Type Filter */}
        {showItemTypeFilter && onItemTypeChange && (
          <Select value={itemType} onValueChange={onItemTypeChange}>
            <SelectTrigger className="w-full md:w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {ITEM_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Category Filter */}
        {showCategoryFilter && onCategoryChange && categories.length > 0 && (
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full md:w-[160px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Location Filter */}
        {showLocationFilter && onLocationChange && locations.length > 0 && (
          <Select value={location} onValueChange={onLocationChange}>
            <SelectTrigger className="w-full md:w-[160px]">
              <SelectValue placeholder="Ubicación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ubicaciones</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Stock Filter */}
        {showStockFilter && onStockFilterChange && (
          <Select value={stockFilter} onValueChange={onStockFilterChange}>
            <SelectTrigger className="w-full md:w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Stock" />
            </SelectTrigger>
            <SelectContent>
              {STOCK_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Sort */}
        {showSort && onSortByChange && (
          <div className="flex gap-1">
            <Select value={sortBy} onValueChange={onSortByChange}>
              <SelectTrigger className="w-full md:w-[130px]">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {onSortOrderChange && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? (
                      <SortAsc className="h-4 w-4" />
                    ) : (
                      <SortDesc className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* View Toggle */}
        {showViewToggle && onViewModeChange && (
          <div className="flex border rounded-lg p-1 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onViewModeChange('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vista grilla</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onViewModeChange('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vista lista</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Refresh */}
        {onRefresh && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Actualizar</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Results and clear filters row */}
      {(hasActiveFilters || (resultCount !== undefined && totalCount !== undefined)) && (
        <div className="flex items-center gap-3 text-sm">
          {resultCount !== undefined && totalCount !== undefined && (
            <span className="text-muted-foreground">
              {resultCount === totalCount ? (
                `${totalCount} resultado${totalCount !== 1 ? 's' : ''}`
              ) : (
                `${resultCount} de ${totalCount} resultado${totalCount !== 1 ? 's' : ''}`
              )}
            </span>
          )}

          {hasActiveFilters && onClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Limpiar filtros
            </Button>
          )}

          {/* Active filter badges */}
          <div className="flex gap-1 flex-wrap">
            {itemType !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {ITEM_TYPE_OPTIONS.find(o => o.value === itemType)?.label}
              </Badge>
            )}
            {stockFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {STOCK_FILTER_OPTIONS.find(o => o.value === stockFilter)?.label}
              </Badge>
            )}
            {category !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {category}
              </Badge>
            )}
            {location !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {location}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolFilterBar;
