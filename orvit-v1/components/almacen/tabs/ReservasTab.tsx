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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Unlock,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useReservas, useReservasMutations, type ReservasFilters } from '../hooks';
import { AlmacenFilters } from '../shared/AlmacenFilters';
import { ReservaStatusBadge } from '../shared/StatusBadge';
import { EmptyState } from '../shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import {
  ReservaTypeLabels,
  type ReservaType,
} from '@/lib/almacen/types';
import { cn, formatNumber } from '@/lib/utils';

interface ReservasTabProps {
  onViewItem?: (supplierItemId: number) => void;
}

/**
 * Tab de Reservas de Stock
 */
export function ReservasTab({ onViewItem }: ReservasTabProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<ReservasFilters>({});

  const { data, isLoading, isFetching, refetch } = useReservas({ filters });

  const { release, batchAction } = useReservasMutations();

  const reservations = data?.reservations || [];

  // Handlers de selección
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    const activeReservations = reservations.filter(
      (r: any) => r.estado === 'ACTIVA' || r.estado === 'CONSUMIDA_PARCIAL'
    );
    if (selectedIds.length === activeReservations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(activeReservations.map((r: any) => r.id));
    }
  }, [selectedIds.length, reservations]);

  // Handlers de acciones
  const handleRelease = async (id: number) => {
    try {
      await release.mutateAsync({ id, motivo: 'Liberación manual' });
      toast({ title: 'Reserva liberada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBatchRelease = async () => {
    if (selectedIds.length === 0) return;
    try {
      const result = await batchAction.mutateAsync({
        ids: selectedIds,
        action: 'release',
        motivo: 'Liberación masiva',
      });
      toast({
        title: 'Acción completada',
        description: `${result.success} reservas liberadas`,
      });
      setSelectedIds([]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Handlers de filtros
  const handleFilterChange = useCallback((key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Calcular si una reserva está próxima a vencer
  const isExpiringSoon = (fechaExpiracion: string | null) => {
    if (!fechaExpiracion) return false;
    const exp = new Date(fechaExpiracion);
    const now = new Date();
    const daysUntilExpiration = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiration <= 7 && daysUntilExpiration > 0;
  };

  return (
    <div className="space-y-4">
      {/* Header con filtros y acciones */}
      <div className="flex items-center justify-between">
        <AlmacenFilters
          search={filters.search}
          estado={filters.estado || 'all'}
          warehouseId={filters.warehouseId}
          onSearchChange={(v) => handleFilterChange('search', v)}
          onEstadoChange={(v) => handleFilterChange('estado', v)}
          onWarehouseChange={(v) => handleFilterChange('warehouseId', v)}
          onClear={handleClearFilters}
          onRefresh={() => refetch()}
          showTipo={false}
          filterType="reservas"
          isLoading={isFetching}
        />

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchRelease}
              disabled={batchAction.isPending}
            >
              <Unlock className="h-4 w-4 mr-1" />
              Liberar ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={11} />
      ) : reservations.length === 0 ? (
        <EmptyState type="reservas" />
      ) : (
        <>
          {/* Cards mobile */}
          <div className="space-y-2 md:hidden">
            {reservations.map((reserva: any) => {
              const canRelease = reserva.estado === 'ACTIVA' || reserva.estado === 'CONSUMIDA_PARCIAL';
              const expiringSoon = isExpiringSoon(reserva.fechaExpiracion);
              const pendiente = reserva.cantidadPendiente ?? (reserva.cantidad - (reserva.cantidadConsumida || 0));

              return (
                <div
                  key={reserva.id}
                  className={cn(
                    'p-3 rounded-lg border bg-card',
                    expiringSoon && 'border-amber-300/60 bg-amber-50/50',
                    reserva.estado === 'EXPIRADA' && 'border-destructive/30 bg-destructive/5'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium text-sm truncate cursor-pointer hover:underline"
                        onClick={() => onViewItem?.(reserva.supplierItem?.id)}
                      >
                        {reserva.supplierItem?.nombre || '-'}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {reserva.supplierItem?.codigoProveedor || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {expiringSoon && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                      <ReservaStatusBadge status={reserva.estado} size="sm" />
                      {canRelease && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRelease(reserva.id)}>
                              <Unlock className="h-4 w-4 mr-2" />
                              Liberar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{ReservaTypeLabels[reserva.tipo as ReservaType] || reserva.tipo}</span>
                    <span>· {reserva.warehouse?.nombre || '-'}</span>
                    {(reserva.materialRequest?.numero || reserva.workOrder?.orderNumber) && (
                      <span className="truncate">· {reserva.materialRequest?.numero || reserva.workOrder?.orderNumber}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                    <div className="p-1.5 rounded bg-muted/40">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-sm font-bold">{formatNumber(reserva.cantidad, 2)}</p>
                    </div>
                    <div className="p-1.5 rounded bg-muted/40">
                      <p className="text-xs text-muted-foreground">Consumida</p>
                      <p className="text-sm font-bold text-muted-foreground">{formatNumber(reserva.cantidadConsumida, 2)}</p>
                    </div>
                    <div className="p-1.5 rounded bg-muted/40">
                      <p className="text-xs text-muted-foreground">Pendiente</p>
                      <p className="text-sm font-bold">{formatNumber(pendiente, 2)}</p>
                    </div>
                  </div>

                  {reserva.fechaExpiracion && (
                    <div className={cn('flex items-center gap-1 mt-2 text-xs', expiringSoon ? 'text-amber-600 font-medium' : 'text-muted-foreground')}>
                      <span>Vence: {format(new Date(reserva.fechaExpiracion), 'dd/MM/yyyy', { locale: es })}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tabla desktop */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        selectedIds.length > 0 &&
                        selectedIds.length ===
                          reservations.filter(
                            (r: any) => r.estado === 'ACTIVA' || r.estado === 'CONSUMIDA_PARCIAL'
                          ).length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Consumida</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((reserva: any) => {
                  const canRelease = reserva.estado === 'ACTIVA' || reserva.estado === 'CONSUMIDA_PARCIAL';
                  const expiringSoon = isExpiringSoon(reserva.fechaExpiracion);

                  return (
                    <TableRow
                      key={reserva.id}
                      className={cn(
                        expiringSoon && 'bg-warning-muted',
                        reserva.estado === 'EXPIRADA' && 'bg-destructive/10'
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(reserva.id)}
                          onCheckedChange={() => toggleSelect(reserva.id)}
                          disabled={!canRelease}
                        />
                      </TableCell>
                      <TableCell>
                        {ReservaTypeLabels[reserva.tipo as ReservaType] || reserva.tipo}
                      </TableCell>
                      <TableCell>
                        <ReservaStatusBadge status={reserva.estado} size="sm" />
                      </TableCell>
                      <TableCell
                        className="cursor-pointer hover:underline"
                        onClick={() => onViewItem?.(reserva.supplierItem?.id)}
                      >
                        <div>
                          <span className="font-mono text-xs text-muted-foreground">
                            {reserva.supplierItem?.codigoProveedor}
                          </span>
                          <br />
                          <span className="font-medium">{reserva.supplierItem?.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell>{reserva.warehouse?.nombre || '-'}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(reserva.cantidad, 2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(reserva.cantidadConsumida, 2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {reserva.cantidadPendiente != null ? formatNumber(reserva.cantidadPendiente, 2) : formatNumber(reserva.cantidad - (reserva.cantidadConsumida || 0), 2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">
                        {reserva.materialRequest?.numero ||
                          reserva.productionOrder?.orderNumber ||
                          reserva.workOrder?.orderNumber ||
                          '-'}
                      </TableCell>
                      <TableCell className={cn(expiringSoon && 'text-warning-muted-foreground font-medium')}>
                        {reserva.fechaExpiracion
                          ? format(new Date(reserva.fechaExpiracion), 'dd/MM/yyyy', { locale: es })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {canRelease && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleRelease(reserva.id)}>
                                <Unlock className="h-4 w-4 mr-2" />
                                Liberar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
