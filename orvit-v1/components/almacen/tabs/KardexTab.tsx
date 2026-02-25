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
import { Search, RefreshCw, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, X, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMovimientos, useWarehouses, type MovimientosFilters } from '../hooks';
import {
  MovementTypes,
  MovementTypeLabels,
  MovementTypeColors,
  type MovementType,
} from '@/lib/almacen/types';
import { EmptyState } from '../shared/EmptyState';
import { cn, formatNumber } from '@/lib/utils';
import { downloadCSV } from '@/lib/cargas/utils';

interface KardexTabProps {
  initialSupplierItemId?: number;
}

/**
 * Tab de Kardex / Movimientos de Stock
 */
export function KardexTab({ initialSupplierItemId }: KardexTabProps) {
  const [filters, setFilters] = useState<MovimientosFilters>({
    supplierItemId: initialSupplierItemId,
  });
  const [localSearch, setLocalSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50 });

  const { data: warehouses = [] } = useWarehouses();
  const { data, isLoading, isFetching, refetch } = useMovimientos({
    filters,
    pagination,
  });

  const movimientos = data?.movimientos || [];
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

  const handleTipoChange = useCallback((value: string) => {
    setFilters((prev) => ({
      ...prev,
      tipo: value === 'all' ? undefined : value,
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleDateFrom = useCallback((value: string) => {
    setDateFrom(value);
    setFilters((prev) => ({ ...prev, dateFrom: value || undefined }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleDateTo = useCallback((value: string) => {
    setDateTo(value);
    setFilters((prev) => ({ ...prev, dateTo: value || undefined }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleClearDates = useCallback(() => {
    setDateFrom('');
    setDateTo('');
    setFilters((prev) => ({ ...prev, dateFrom: undefined, dateTo: undefined }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const hasDateFilter = !!dateFrom || !!dateTo;

  const handleExportCSV = useCallback(() => {
    const headers = ['Fecha', 'Tipo', 'Código', 'Item', 'Depósito', 'Cantidad', 'Stock Anterior', 'Stock Posterior', 'Referencia', 'Usuario'];
    const rows = movimientos.map((mov: any) => [
      format(new Date(mov.fecha), 'dd/MM/yyyy HH:mm', { locale: es }),
      MovementTypeLabels[mov.tipo as MovementType] || mov.tipo,
      mov.supplierItem?.codigoProveedor || '',
      mov.supplierItem?.nombre || '',
      mov.warehouse?.nombre || '',
      (isPositiveMovement(mov.tipo) ? '+' : '-') + formatNumber(Math.abs(mov.cantidad), 2),
      mov.stockAnterior != null ? formatNumber(mov.stockAnterior, 2) : '',
      mov.stockPosterior != null ? formatNumber(mov.stockPosterior, 2) : '',
      mov.referencia || '',
      mov.usuario?.name || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCSV(csv, `kardex-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  }, [movimientos]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
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
          <SelectTrigger className="w-[150px] h-9">
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

        <Select
          value={filters.tipo || 'all'}
          onValueChange={handleTipoChange}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {MovementTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {MovementTypeLabels[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateFrom(e.target.value)}
            className="h-9 w-[140px] text-sm"
            placeholder="Desde"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateTo(e.target.value)}
            className="h-9 w-[140px] text-sm"
            placeholder="Hasta"
          />
          {hasDateFilter && (
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleClearDates}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportCSV}
            disabled={movimientos.length === 0}
            className="h-9 w-9 p-0"
            title="Exportar CSV"
          >
            <Download className="h-4 w-4" />
          </Button>
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
        <TableSkeleton />
      ) : movimientos.length === 0 ? (
        <EmptyState type="kardex" />
      ) : (
        <>
          {/* Cards mobile */}
          <div className="space-y-2 md:hidden">
            {movimientos.map((mov: any) => {
              const isPositive = isPositiveMovement(mov.tipo);
              return (
                <div key={mov.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{mov.supplierItem?.nombre || '-'}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {mov.supplierItem?.codigoProveedor || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('text-sm font-bold', isPositive ? 'text-green-600' : 'text-destructive')}>
                        {isPositive ? '+' : '-'}{formatNumber(Math.abs(mov.cantidad), 2)}
                      </span>
                      <MovementTypeBadge tipo={mov.tipo} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>{mov.warehouse?.nombre || '-'}</span>
                    <span>{format(new Date(mov.fecha), 'dd/MM/yy HH:mm', { locale: es })}</span>
                  </div>
                  {(mov.stockAnterior != null || mov.stockPosterior != null) && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <span>Stock:</span>
                      <span>{mov.stockAnterior != null ? formatNumber(mov.stockAnterior, 2) : '-'}</span>
                      <ArrowRightIcon />
                      <span className="font-medium text-foreground">{mov.stockPosterior != null ? formatNumber(mov.stockPosterior, 2) : '-'}</span>
                      {mov.usuario?.name && <span className="ml-auto">· {mov.usuario.name}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tabla desktop */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Stock Anterior</TableHead>
                  <TableHead className="text-right">Stock Posterior</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.map((mov: any) => (
                  <TableRow key={mov.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(mov.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <MovementTypeBadge tipo={mov.tipo} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">
                          {mov.supplierItem?.codigoProveedor}
                        </span>
                        <br />
                        <span className="font-medium">{mov.supplierItem?.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell>{mov.warehouse?.nombre || '-'}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          'font-medium',
                          isPositiveMovement(mov.tipo) ? 'text-success' : 'text-destructive'
                        )}
                      >
                        {isPositiveMovement(mov.tipo) ? '+' : '-'}
                        {formatNumber(Math.abs(mov.cantidad), 2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {mov.stockAnterior != null ? formatNumber(mov.stockAnterior, 2) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {mov.stockPosterior != null ? formatNumber(mov.stockPosterior, 2) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[150px] truncate">
                      {mov.referencia || '-'}
                    </TableCell>
                    <TableCell>{mov.usuario?.name || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {movimientos.length} de {total} movimientos
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
  );
}

function ArrowRightIcon() {
  return <span className="mx-0.5">→</span>;
}

function MovementTypeBadge({ tipo }: { tipo: MovementType }) {
  const Icon = getMovementIcon(tipo);
  const colorClass = MovementTypeColors[tipo] || 'bg-muted text-foreground';

  return (
    <Badge variant="outline" className={cn('gap-1', colorClass)}>
      <Icon className="h-3 w-3" />
      {MovementTypeLabels[tipo] || tipo}
    </Badge>
  );
}

function getMovementIcon(tipo: MovementType) {
  if (tipo.includes('ENTRADA') || tipo.includes('POSITIVO')) return ArrowUpCircle;
  if (tipo.includes('SALIDA') || tipo.includes('NEGATIVO') || tipo.includes('CONSUMO')) return ArrowDownCircle;
  return ArrowLeftRight;
}

function isPositiveMovement(tipo: string): boolean {
  return (
    tipo === 'ENTRADA' ||
    tipo === 'AJUSTE_POSITIVO' ||
    tipo === 'TRANSFERENCIA_ENTRADA' ||
    tipo === 'LIBERACION_RESERVA'
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {[24, 20, 32, 24, 16, 16, 16, 24, 24].map((w, i) => (
              <TableHead key={i}><Skeleton className={`h-4 w-${w}`} /></TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
              <TableCell><Skeleton className="h-8 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
