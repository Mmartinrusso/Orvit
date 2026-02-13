'use client';

import { useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, RefreshCw, AlertTriangle, Package, ArrowUpRight } from 'lucide-react';
import { useInventario, useWarehouses, type InventarioFilters } from '../hooks';
import { EmptyState } from '../shared/EmptyState';
import { cn } from '@/lib/utils';

interface PreselectedItem {
  supplierItemId: number;
  warehouseId: number;
  nombre: string;
  codigo: string;
  unidad: string;
  stockDisponible: number;
}

interface InventarioTabProps {
  onViewItem?: (supplierItemId: number) => void;
  onDispatchItem?: (item: PreselectedItem) => void;
}

/**
 * Tab de Inventario / Disponibilidad
 * Incluye acción rápida para despachar items
 */
export function InventarioTab({ onViewItem, onDispatchItem }: InventarioTabProps) {
  const [filters, setFilters] = useState<InventarioFilters>({});
  const [localSearch, setLocalSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50 });

  const { data: warehouses = [] } = useWarehouses();
  const { data, isLoading, isFetching, refetch } = useInventario({
    filters,
    pagination,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Handlers de filtros
  const handleSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: localSearch }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [localSearch]);

  const handleWarehouseChange = useCallback((value: string) => {
    setFilters((prev) => ({
      ...prev,
      warehouseId: value === 'all' ? undefined : Number(value),
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleBelowReorderToggle = useCallback((checked: boolean) => {
    setFilters((prev) => ({ ...prev, onlyBelowReorder: checked }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleBelowMinimumToggle = useCallback((checked: boolean) => {
    setFilters((prev) => ({ ...prev, onlyBelowMinimum: checked }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar item..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-8 h-9"
          />
        </div>

        <Select
          value={filters.warehouseId?.toString() || 'all'}
          onValueChange={handleWarehouseChange}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Depósito" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los depósitos</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id.toString()}>
                {w.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center space-x-2">
          <Switch
            id="below-reorder"
            checked={filters.onlyBelowReorder || false}
            onCheckedChange={handleBelowReorderToggle}
          />
          <Label htmlFor="below-reorder" className="text-sm">
            Bajo reorden
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="below-minimum"
            checked={filters.onlyBelowMinimum || false}
            onCheckedChange={handleBelowMinimumToggle}
          />
          <Label htmlFor="below-minimum" className="text-sm text-red-600">
            Bajo mínimo
          </Label>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <EmptyState type="inventario" />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead className="text-right">Stock Actual</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Reorden</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any, index: number) => (
                  <TableRow
                    key={`${item.supplierItem?.id}-${item.warehouseId}-${index}`}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      item.isBelowMinimum && 'bg-red-50',
                      item.isBelowReorder && !item.isBelowMinimum && 'bg-yellow-50'
                    )}
                    onClick={() => onViewItem?.(item.supplierItem?.id)}
                  >
                    <TableCell className="font-mono text-sm">
                      {item.supplierItem?.codigoProveedor || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.supplierItem?.nombre || '-'}
                    </TableCell>
                    <TableCell>{item.warehouse?.nombre || '-'}</TableCell>
                    <TableCell className="text-right">
                      {item.stockActual?.toFixed(2) || '0.00'} {item.supplierItem?.unidad}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.stockReservado?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.stockDisponible?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.stockMinimo?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.stockReorden?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell>
                      <StockStatusBadge item={item} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                disabled={!item.stockDisponible || item.stockDisponible <= 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDispatchItem?.({
                                    supplierItemId: item.supplierItemId || item.supplierItem?.id,
                                    warehouseId: item.warehouseId,
                                    nombre: item.supplierItem?.nombre || '',
                                    codigo: item.supplierItem?.codigoProveedor || '',
                                    unidad: item.supplierItem?.unidad || '',
                                    stockDisponible: item.stockDisponible || 0,
                                  });
                                }}
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Despachar (salida rápida)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Mostrando {items.length} de {total} items
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
              >
                Anterior
              </Button>
              <span>
                Página {pagination.page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StockStatusBadge({ item }: { item: any }) {
  if (item.isBelowMinimum) {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Crítico
      </Badge>
    );
  }
  if (item.isBelowReorder) {
    return (
      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
        Reordenar
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
      <Package className="h-3 w-3 mr-1" />
      OK
    </Badge>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-32" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
              <TableCell><Skeleton className="h-8 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
