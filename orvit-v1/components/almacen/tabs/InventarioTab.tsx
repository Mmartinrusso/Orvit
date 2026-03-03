'use client';

import { useState, useCallback, useMemo } from 'react';
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
import { Search, RefreshCw, AlertTriangle, Package, ArrowUpRight, Download, ChevronRight, Building2 } from 'lucide-react';
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

interface SupplyGroup {
  supplyId: number | null;
  supplyName: string;
  unit: string;
  totalStock: number;
  totalReservado: number;
  totalDisponible: number;
  totalMinimo: number;
  totalReorden: number;
  isBelowMinimum: boolean;
  isBelowReorder: boolean;
  items: any[];
}

function groupBySupply(items: any[]): SupplyGroup[] {
  const map = new Map<string, SupplyGroup>();

  for (const item of items) {
    const key = item.supplyId ? `supply-${item.supplyId}` : `si-${item.supplierItemId}`;
    let group = map.get(key);
    if (!group) {
      group = {
        supplyId: item.supplyId || null,
        supplyName: item.supplyName || item.supplierItem?.nombre || '-',
        unit: item.supplierItem?.unidad || '',
        totalStock: 0,
        totalReservado: 0,
        totalDisponible: 0,
        totalMinimo: 0,
        totalReorden: 0,
        isBelowMinimum: false,
        isBelowReorder: false,
        items: [],
      };
      map.set(key, group);
    }
    group.items.push(item);
    group.totalStock += item.stockActual || 0;
    group.totalReservado += item.stockReservado || 0;
    group.totalDisponible += item.stockDisponible || 0;
    group.totalMinimo += item.stockMinimo || 0;
    group.totalReorden += item.stockReorden || 0;
    if (item.isBelowMinimum) group.isBelowMinimum = true;
    if (item.isBelowReorder) group.isBelowReorder = true;
  }

  return Array.from(map.values()).sort((a, b) => a.supplyName.localeCompare(b.supplyName));
}

/**
 * Tab de Inventario / Disponibilidad
 * Agrupado por Supply (insumo interno) con detalle expandible por proveedor
 */
export function InventarioTab({ onViewItem, onDispatchItem }: InventarioTabProps) {
  const [filters, setFilters] = useState<InventarioFilters>({});
  const [localSearch, setLocalSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50 });
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: warehouses = [] } = useWarehouses();
  const { data, isLoading, isFetching, refetch } = useInventario({
    filters,
    pagination,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const groups = useMemo(() => groupBySupply(items), [items]);

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

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
    const headers = ['Insumo', 'Proveedor', 'Depósito', 'Unidad', 'Stock Actual', 'Reservado', 'Disponible', 'Mínimo', 'Reorden', 'Estado'];
    const rows = items.map((item: any) => [
      item.supplyName || item.supplierItem?.nombre || '',
      item.supplierName || '',
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
              placeholder="Buscar insumo..."
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
          <SkeletonTable rows={5} cols={8} />
        ) : items.length === 0 ? (
          <EmptyState type="inventario" />
        ) : (
          <>
            {/* Cards mobile */}
            <div className="space-y-2 md:hidden">
              {groups.map((group) => {
                const groupKey = group.supplyId ? `supply-${group.supplyId}` : `si-${group.items[0]?.supplierItemId}`;
                const isExpanded = expandedGroups.has(groupKey);
                const hasMultiple = group.items.length > 1;

                return (
                  <div key={groupKey} className="space-y-1">
                    <div
                      className={cn(
                        'p-3 rounded-lg border bg-card transition-colors',
                        group.isBelowMinimum && 'border-destructive/40 bg-destructive/5',
                        group.isBelowReorder && !group.isBelowMinimum && 'border-amber-300/50 bg-amber-50/50',
                        hasMultiple && 'cursor-pointer hover:bg-muted/30'
                      )}
                      onClick={() => hasMultiple ? toggleGroup(groupKey) : handleRowClick(group.items[0])}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {hasMultiple && (
                              <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isExpanded && 'rotate-90')} />
                            )}
                            <p className="font-medium text-sm truncate">{group.supplyName}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {group.unit}
                            {hasMultiple && <span className="ml-1.5">({group.items.length} proveedores)</span>}
                          </p>
                        </div>
                        <StockStatusBadge item={group} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                        <div className="p-1.5 rounded bg-muted/40">
                          <p className="text-xs text-muted-foreground">Stock</p>
                          <p className="text-sm font-bold">{formatNumber(group.totalStock, 2)}</p>
                        </div>
                        <div className="p-1.5 rounded bg-muted/40">
                          <p className="text-xs text-muted-foreground">Disponible</p>
                          <p className={cn('text-sm font-bold', group.isBelowMinimum ? 'text-destructive' : '')}>
                            {formatNumber(group.totalDisponible, 2)}
                          </p>
                        </div>
                        <div className="p-1.5 rounded bg-muted/40">
                          <p className="text-xs text-muted-foreground">Reservado</p>
                          <p className="text-sm font-bold text-muted-foreground">{formatNumber(group.totalReservado, 2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Sub-items expanded (mobile) */}
                    {isExpanded && group.items.map((item: any, idx: number) => (
                      <div
                        key={`${item.supplierItemId}-${item.warehouseId}-${idx}`}
                        className="ml-4 p-2.5 rounded-lg border border-dashed bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => handleRowClick(item)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                              {item.supplierName || item.supplierItem?.nombre || '-'}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5 ml-[18px]">
                              {item.warehouse?.nombre || '-'}
                              {item.supplierItem?.codigoProveedor && ` · ${item.supplierItem.codigoProveedor}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold">{formatNumber(item.stockDisponible, 2)}</p>
                            <p className="text-[11px] text-muted-foreground">de {formatNumber(item.stockActual, 2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Tabla desktop */}
            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[32px]"></TableHead>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Depósito</TableHead>
                    <TableHead className="text-right">Stock Actual</TableHead>
                    <TableHead className="text-right">Reservado</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center w-[80px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => {
                    const groupKey = group.supplyId ? `supply-${group.supplyId}` : `si-${group.items[0]?.supplierItemId}`;
                    const isExpanded = expandedGroups.has(groupKey);
                    const hasMultiple = group.items.length > 1;
                    const singleItem = !hasMultiple ? group.items[0] : null;

                    return (
                      <GroupRows
                        key={groupKey}
                        group={group}
                        groupKey={groupKey}
                        isExpanded={isExpanded}
                        hasMultiple={hasMultiple}
                        singleItem={singleItem}
                        onToggle={() => toggleGroup(groupKey)}
                        onRowClick={handleRowClick}
                        onDispatchItem={onDispatchItem}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {groups.length} insumos ({items.length} items) de {total} total
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
                <p className="text-xs text-muted-foreground">
                  {selectedItem.supplierName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {selectedItem.supplierName}
                    </span>
                  )}
                  {selectedItem.supplierItem?.codigoProveedor && (
                    <span className="font-mono mt-0.5 block">{selectedItem.supplierItem.codigoProveedor}</span>
                  )}
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

/** Fila agrupada de supply + sub-filas de proveedores */
function GroupRows({
  group,
  groupKey,
  isExpanded,
  hasMultiple,
  singleItem,
  onToggle,
  onRowClick,
  onDispatchItem,
}: {
  group: SupplyGroup;
  groupKey: string;
  isExpanded: boolean;
  hasMultiple: boolean;
  singleItem: any;
  onToggle: () => void;
  onRowClick: (item: any) => void;
  onDispatchItem?: (item: PreselectedItem) => void;
}) {
  // Si es un solo item, mostrar fila simple (sin expand)
  if (!hasMultiple && singleItem) {
    return (
      <TableRow
        className={cn(
          'cursor-pointer hover:bg-muted/50',
          singleItem.isBelowMinimum && 'bg-destructive/10',
          singleItem.isBelowReorder && !singleItem.isBelowMinimum && 'bg-warning-muted'
        )}
        onClick={() => onRowClick(singleItem)}
      >
        <TableCell className="w-[32px]" />
        <TableCell>
          <p className="font-medium">{group.supplyName}</p>
          {singleItem.supplierName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3" />
              {singleItem.supplierName}
              {singleItem.warehouse?.nombre && ` · ${singleItem.warehouse.nombre}`}
            </p>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">{singleItem.warehouse?.nombre || '-'}</TableCell>
        <TableCell className="text-right">
          {formatNumber(singleItem.stockActual, 2)} {group.unit}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">
          {formatNumber(singleItem.stockReservado, 2)}
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatNumber(singleItem.stockDisponible, 2)}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">
          {formatNumber(singleItem.stockMinimo, 2)}
        </TableCell>
        <TableCell>
          <StockStatusBadge item={singleItem} />
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!singleItem.stockDisponible || singleItem.stockDisponible <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDispatchItem?.({
                      supplierItemId: singleItem.supplierItemId || singleItem.supplierItem?.id,
                      warehouseId: singleItem.warehouseId,
                      nombre: singleItem.supplierItem?.nombre || '',
                      codigo: singleItem.supplierItem?.codigoProveedor || '',
                      unidad: singleItem.supplierItem?.unidad || '',
                      stockDisponible: singleItem.stockDisponible || 0,
                    });
                  }}
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Despacho rápido</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // Grupo con múltiples items: fila resumen expandible
  return (
    <>
      <TableRow
        className={cn(
          'cursor-pointer hover:bg-muted/50',
          group.isBelowMinimum && 'bg-destructive/10',
          group.isBelowReorder && !group.isBelowMinimum && 'bg-warning-muted'
        )}
        onClick={onToggle}
      >
        <TableCell className="w-[32px] px-2">
          <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <p className="font-medium">{group.supplyName}</p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {group.items.length} prov.
            </Badge>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {[...new Set(group.items.map((i: any) => i.warehouse?.nombre).filter(Boolean))].join(', ') || '-'}
        </TableCell>
        <TableCell className="text-right font-semibold">
          {formatNumber(group.totalStock, 2)} {group.unit}
        </TableCell>
        <TableCell className="text-right text-muted-foreground font-semibold">
          {formatNumber(group.totalReservado, 2)}
        </TableCell>
        <TableCell className="text-right font-bold">
          {formatNumber(group.totalDisponible, 2)}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">
          {formatNumber(group.totalMinimo, 2)}
        </TableCell>
        <TableCell>
          <StockStatusBadge item={group} />
        </TableCell>
        <TableCell />
      </TableRow>

      {/* Sub-filas expandidas por proveedor */}
      {isExpanded && group.items.map((item: any, idx: number) => (
        <TableRow
          key={`${groupKey}-${item.supplierItemId}-${item.warehouseId}-${idx}`}
          className="cursor-pointer hover:bg-muted/30 bg-muted/10"
          onClick={() => onRowClick(item)}
        >
          <TableCell className="w-[32px]" />
          <TableCell className="pl-8">
            <p className="text-sm flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {item.supplierName || item.supplierItem?.nombre || '-'}
            </p>
            {item.supplierItem?.codigoProveedor && (
              <p className="text-[11px] text-muted-foreground font-mono ml-5">{item.supplierItem.codigoProveedor}</p>
            )}
          </TableCell>
          <TableCell className="text-muted-foreground text-sm">{item.warehouse?.nombre || '-'}</TableCell>
          <TableCell className="text-right text-sm">
            {formatNumber(item.stockActual, 2)} {item.supplierItem?.unidad}
          </TableCell>
          <TableCell className="text-right text-muted-foreground text-sm">
            {formatNumber(item.stockReservado, 2)}
          </TableCell>
          <TableCell className="text-right font-medium text-sm">
            {formatNumber(item.stockDisponible, 2)}
          </TableCell>
          <TableCell className="text-right text-muted-foreground text-sm">
            {formatNumber(item.stockMinimo, 2)}
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
                    className="h-7 w-7"
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
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Despacho rápido</TooltipContent>
              </Tooltip>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
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
