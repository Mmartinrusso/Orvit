'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import {
  Filter,
  X,
  Search,
  ChevronDown,
  RotateCcw,
  Package,
  DollarSign,
  Warehouse,
  Tag as TagIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProductFilters {
  search: string;
  categoryId: string | null;
  costType: string | null;
  costCurrency: string | null;
  stockStatus: 'all' | 'low' | 'out' | 'available';
  priceMin: number | null;
  priceMax: number | null;
  marginMin: number | null;
  marginMax: number | null;
  tags: string[];
  onlyActive: boolean;
  sortBy: 'name' | 'code' | 'costPrice' | 'currentStock' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

interface Category {
  id: number;
  name: string;
}

interface ProductAdvancedFiltersProps {
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  categories?: Category[];
  className?: string;
}

const defaultFilters: ProductFilters = {
  search: '',
  categoryId: null,
  costType: null,
  costCurrency: null,
  stockStatus: 'all',
  priceMin: null,
  priceMax: null,
  marginMin: null,
  marginMax: null,
  tags: [],
  onlyActive: true,
  sortBy: 'name',
  sortOrder: 'asc',
};

export function ProductAdvancedFilters({
  filters,
  onChange,
  categories = [],
  className,
}: ProductAdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<ProductFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onChange(localFilters);
    setIsOpen(false);
  };

  const handleReset = () => {
    setLocalFilters(defaultFilters);
    onChange(defaultFilters);
  };

  const activeFilterCount = [
    filters.categoryId,
    filters.costType,
    filters.costCurrency,
    filters.stockStatus !== 'all',
    filters.priceMin !== null,
    filters.priceMax !== null,
    filters.marginMin !== null,
    filters.marginMax !== null,
    filters.tags.length > 0,
    !filters.onlyActive,
  ].filter(Boolean).length;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Busqueda rapida */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, codigo o descripcion..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Filtro de categoria rapido */}
      <Select
        value={filters.categoryId || 'all'}
        onValueChange={(value) =>
          onChange({ ...filters, categoryId: value === 'all' ? null : value })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorias</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={String(cat.id)}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Boton de filtros avanzados */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filtros Avanzados</h4>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Limpiar
              </Button>
            </div>

            {/* Tipo de Costo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Tipo de Costo
              </Label>
              <Select
                value={localFilters.costType || 'all'}
                onValueChange={(value) =>
                  setLocalFilters({
                    ...localFilters,
                    costType: value === 'all' ? null : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="PRODUCTION">Produccion</SelectItem>
                  <SelectItem value="PURCHASE">Compra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estado de Stock */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Warehouse className="w-4 h-4" />
                Estado de Stock
              </Label>
              <Select
                value={localFilters.stockStatus}
                onValueChange={(value) =>
                  setLocalFilters({
                    ...localFilters,
                    stockStatus: value as any,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="available">Con stock disponible</SelectItem>
                  <SelectItem value="low">Stock bajo (bajo minimo)</SelectItem>
                  <SelectItem value="out">Sin stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rango de Precios */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Rango de Precio de Costo
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Minimo"
                  value={localFilters.priceMin || ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      priceMin: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                />
                <Input
                  type="number"
                  placeholder="Maximo"
                  value={localFilters.priceMax || ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      priceMax: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>

            {/* Rango de Margen */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Rango de Margen (%)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Minimo %"
                  value={localFilters.marginMin || ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      marginMin: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                />
                <Input
                  type="number"
                  placeholder="Maximo %"
                  value={localFilters.marginMax || ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      marginMax: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>

            {/* Ordenamiento */}
            <div className="space-y-2">
              <Label>Ordenar por</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={localFilters.sortBy}
                  onValueChange={(value) =>
                    setLocalFilters({ ...localFilters, sortBy: value as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nombre</SelectItem>
                    <SelectItem value="code">Codigo</SelectItem>
                    <SelectItem value="costPrice">Precio</SelectItem>
                    <SelectItem value="currentStock">Stock</SelectItem>
                    <SelectItem value="createdAt">Fecha creacion</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={localFilters.sortOrder}
                  onValueChange={(value) =>
                    setLocalFilters({ ...localFilters, sortOrder: value as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascendente</SelectItem>
                    <SelectItem value="desc">Descendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Incluir inactivos */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="onlyActive">Solo productos activos</Label>
                <p className="text-xs text-muted-foreground">
                  Ocultar productos desactivados
                </p>
              </div>
              <Switch
                id="onlyActive"
                checked={localFilters.onlyActive}
                onCheckedChange={(checked) =>
                  setLocalFilters({ ...localFilters, onlyActive: checked })
                }
              />
            </div>

            {/* Botones de accion */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleApply}>Aplicar Filtros</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Chips de filtros activos */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1">
          {filters.categoryId && (
            <Badge variant="secondary" className="gap-1">
              {categories.find((c) => String(c.id) === filters.categoryId)?.name || 'Categoria'}
              <button
                onClick={() => onChange({ ...filters, categoryId: null })}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.stockStatus !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {filters.stockStatus === 'low' ? 'Stock bajo' : filters.stockStatus === 'out' ? 'Sin stock' : 'Con stock'}
              <button
                onClick={() => onChange({ ...filters, stockStatus: 'all' })}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.costType && (
            <Badge variant="secondary" className="gap-1">
              {filters.costType}
              <button
                onClick={() => onChange({ ...filters, costType: null })}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// Hook para aplicar filtros a una lista de productos
export function useProductFilters(products: any[], filters: ProductFilters) {
  return products.filter((product) => {
    // Busqueda por texto
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matches =
        product.name?.toLowerCase().includes(searchLower) ||
        product.code?.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower) ||
        product.barcode?.toLowerCase().includes(searchLower);
      if (!matches) return false;
    }

    // Categoria
    if (filters.categoryId && String(product.categoryId) !== filters.categoryId) {
      return false;
    }

    // Tipo de costo
    if (filters.costType && product.costType !== filters.costType) {
      return false;
    }

    // Estado de stock
    if (filters.stockStatus !== 'all') {
      const stock = product.currentStock || 0;
      const minStock = product.minStock || 0;

      if (filters.stockStatus === 'out' && stock > 0) return false;
      if (filters.stockStatus === 'low' && (stock > minStock || minStock === 0))
        return false;
      if (filters.stockStatus === 'available' && stock <= 0) return false;
    }

    // Rango de precios
    if (filters.priceMin !== null && (product.costPrice || 0) < filters.priceMin) {
      return false;
    }
    if (filters.priceMax !== null && (product.costPrice || 0) > filters.priceMax) {
      return false;
    }

    // Solo activos
    if (filters.onlyActive && product.isActive === false) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    const aValue = a[filters.sortBy];
    const bValue = b[filters.sortBy];

    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    const comparison = aValue < bValue ? -1 : 1;
    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });
}
