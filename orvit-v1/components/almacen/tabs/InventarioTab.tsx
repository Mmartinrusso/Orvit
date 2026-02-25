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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, RefreshCw, AlertTriangle, Package, ArrowUpRight, Download } from 'lucide-react';
import { useInventario, useWarehouses, type InventarioFilters } from '../hooks';
import { EmptyState } from '../shared/EmptyState';
import { cn, formatNumber } from '@/lib/utils';
import { downloadCSV } from '@/lib/cargas/utils';
import { format as formatDate } from 'date-fns';

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
 * Incluye acción rápida para despachar items y Sheet de detalle al hacer click
 */
export function InventarioTab({ onViewItem, onDispatchItem }: InventarioTabProps) {
  const [filters, setFilters] = useState<InventarioFilters>({});
  const [localSearch, setLocalSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50 });
  const [selectedItem, setSelectedItem] = useState<any>(null);

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

  const handleExportCSV = useCallback(() => {
    const headers = ['Código', 'Nombre', 'Depósito', 'Unidad', 'Stock Actual', 'Reservado', 'Disponible', 'Mínimo', 'Reorden', 'Estado'];
    const rows = items.map((item: any) => [
      item.supplierItem?.codigoProveedor || '',
      item.supplierItem?.nombre || '',
      item.warehouse?.nombre || '',
      item.supplierItem?.unidad || '',
      item.stockActual ?? 0,
      item.stockReservado ?? 0,
      item.stockDisponible ?? 0,
      item.stockMinimo ?? 0,
      item.stockReorden ?? 0,
      item.isBelowMinimum ? 'Crítico' : item.isBelowReorder ? 'Reordenar' : 'OK',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCSV(csv, `inventario-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`);
  }, [items]);

  const handleRowClick = (item: any) => {
    setSelectedItem(item);
    onViewItem?.(item.supplierItem?.id);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
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
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Depósito" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
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

          <div className="flex items-center gap-1 ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleExportCSV} disabled={items.length === 0} className="h-9 w-9 p-0">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar CSV</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 w-9 p-0"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Contenido */}
        {isLoading ? (
          <SkeletonTable rows={5} cols={10} />
        ) : items.length === 0 ? (
          <EmptyState type="inventario" />
        ) : (
          <>
            {/* Cards mobile */}
            <div className="space-y-2 md:hidden">
              {items.map((item: any, index: number) => (
                <div
                  key={`${item.supplierItem?.id}-${item.warehouseId}-${index}`}
                  className={cn(
                    'p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/30 transition-colors',
                    item.isBelowMinimum && 'border-destructive/40 bg-destructive/5',
                    item.isBelowReorder && !item.isBelowMinimum && 'border-amber-300/50 bg-amber-50/50'
                  )}
                  onClick={() => handleRowClick(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.supplierItem?.nombre || '-'}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {item.supplierItem?.codigoProveedor || '-'} · {item.warehouse?.nombre || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <StockStatusBadge item={item} />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
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
                        <TooltipContent>Despacho rápido</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                    <div className="p-1.5 rounded bg-muted/40">
                      <p className="text-xs text-muted-foreground">Stock</p>
                      <p className="text-sm font-bold">{formatNumber(item.stockActual, 2)}</p>
                    </div>
                    <div className="p-1.5 rounded bg-muted/40">
                      <p className="text-xs text-muted-foreground">Disponible</p>
                      <p className={cn('text-sm font-bold', item.isBelowMinimum ? 'text-destructive' : '')}>
                        {formatNumber(item.stockDisponible, 2)}
                      </p>
                    </div>
                    <div className="p-1.5 rounded bg-muted/40">
                      <p className="text-xs text-muted-foreground">Reservado</p>
                      <p className="text-sm font-bold text-muted-foreground">{formatNumber(item.stockReservado, 2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabla desktop */}
            <div className="hidden md:block rounded-md border overflow-x-auto">
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
                      onClick={() => handleRowClick(item)}
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
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
                {items.length} de {total} items
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
                  {pagination.page} / {totalPages}
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

      {/* Sheet de detalle */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selectedItem && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-base">{selectedItem.supplierItem?.nombre || '-'}</SheetTitle>
                <p className="text-xs font-mono text-muted-foreground">
                  {selectedItem.supplierItem?.codigoProveedor || '-'}
                </p>
              </SheetHeader>

              <div className="space-y-4">
                {/* Estado */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <StockStatusBadge item={selectedItem} />
                </div>

                {/* Depósito */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Depósito</span>
                  <span className="text-sm font-medium">{selectedItem.warehouse?.nombre || '-'}</span>
                </div>

                {/* Unidad */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Unidad</span>
                  <span className="text-sm font-medium">{selectedItem.supplierItem?.unidad || '-'}</span>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Stock</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/40">
                      <p className="text-xs text-muted-foreground">Stock Actual</p>
                      <p className="text-lg font-bold mt-0.5">{formatNumber(selectedItem.stockActual, 2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/40">
                      <p className="text-xs text-muted-foreground">Disponible</p>
                      <p className={cn('text-lg font-bold mt-0.5', selectedItem.isBelowMinimum && 'text-destructive')}>
                        {formatNumber(selectedItem.stockDisponible, 2)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/40">
                      <p className="text-xs text-muted-foreground">Reservado</p>
                      <p className="text-lg font-bold mt-0.5 text-muted-foreground">{formatNumber(selectedItem.stockReservado, 2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/40">
                      <p className="text-xs text-muted-foreground">Mínimo</p>
                      <p className="text-lg font-bold mt-0.5">{formatNumber(selectedItem.stockMinimo, 2)}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Reposición</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Punto de reorden</span>
                    <span className="text-sm font-medium">{formatNumber(selectedItem.stockReorden, 2)}</span>
                  </div>
                  {selectedItem.criticidad && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-muted-foreground">Criticidad</span>
                      <span className="text-sm font-medium">{selectedItem.criticidad}</span>
                    </div>
                  )}
                  {selectedItem.ubicacion && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-muted-foreground">Ubicación en depósito</span>
                      <span className="text-sm font-medium">{selectedItem.ubicacion}</span>
                    </div>
                  )}
                </div>

                {/* Acción rápida */}
                {selectedItem.stockDisponible > 0 && onDispatchItem && (
                  <div className="border-t pt-4">
                    <Button
                      className="w-full"
                      onClick={() => {
                        onDispatchItem({
                          supplierItemId: selectedItem.supplierItemId || selectedItem.supplierItem?.id,
                          warehouseId: selectedItem.warehouseId,
                          nombre: selectedItem.supplierItem?.nombre || '',
                          codigo: selectedItem.supplierItem?.codigoProveedor || '',
                          unidad: selectedItem.supplierItem?.unidad || '',
                          stockDisponible: selectedItem.stockDisponible || 0,
                        });
                        setSelectedItem(null);
                      }}
                    >
                      <ArrowUpRight className="h-4 w-4 mr-2" />
                      Despacho rápido
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
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
