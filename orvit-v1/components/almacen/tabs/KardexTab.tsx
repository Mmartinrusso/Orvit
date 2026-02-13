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
import { Search, RefreshCw, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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

        <Select
          value={filters.tipo || 'all'}
          onValueChange={handleTipoChange}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Tipo de movimiento" />
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
      ) : movimientos.length === 0 ? (
        <EmptyState type="kardex" />
      ) : (
        <>
          <div className="rounded-md border">
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
                          isPositiveMovement(mov.tipo) ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {isPositiveMovement(mov.tipo) ? '+' : '-'}
                        {Math.abs(mov.cantidad).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {mov.stockAnterior?.toFixed(2) || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {mov.stockPosterior?.toFixed(2) || '-'}
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
              Mostrando {movimientos.length} de {total} movimientos
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

function MovementTypeBadge({ tipo }: { tipo: MovementType }) {
  const Icon = getMovementIcon(tipo);
  const colorClass = MovementTypeColors[tipo] || 'bg-gray-100 text-gray-800';

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
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-32" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
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
