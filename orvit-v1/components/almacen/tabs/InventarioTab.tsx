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
import { SkeletonTable } from '@/components/ui/skeleton-table';
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
import { cn, formatNumber } from '@/lib/utils';

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
          <Label htmlFor="below-minimum" className="text-sm text-destructive">
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
        <SkeletonTable rows={5} cols={10} />
      ) : items.length === 0 ? (
        <EmptyState type="inventario" />
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
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
                      item.isBelowMinimum && 'bg-destructive/10',
                      item.isBelowReorder && !item.isBelowMinimum && 'bg-warning-muted'
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
                      {formatNumber(item.stockActual, 2)} {item.supplierItem?.unidad}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(item.stockReservado, 2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(item.stockDisponible, 2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(item.stockMinimo, 2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(item.stockReorden, 2)}
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
                                className="h-8 w-8 text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted"
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
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Crítico
      </Badge>
    );
  }
  if (item.isBelowReorder) {
    return (
      <Badge variant="outline" className="bg-warning-muted text-warning-muted-foreground border-warning/30">
        Reordenar
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-success-muted text-success border-success/30">
      <Package className="h-3 w-3 mr-1" />
      OK
    </Badge>
  );
}

