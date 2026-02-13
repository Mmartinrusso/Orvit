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
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Unlock,
  RefreshCw,
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
import { cn } from '@/lib/utils';

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

      {/* Tabla */}
      {isLoading ? (
        <TableSkeleton />
      ) : reservations.length === 0 ? (
        <EmptyState type="reservas" />
      ) : (
        <div className="rounded-md border">
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
                      expiringSoon && 'bg-yellow-50',
                      reserva.estado === 'EXPIRADA' && 'bg-red-50'
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
                      {reserva.cantidad?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {reserva.cantidadConsumida?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {reserva.cantidadPendiente?.toFixed(2) || (reserva.cantidad - (reserva.cantidadConsumida || 0)).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[150px] truncate">
                      {reserva.materialRequest?.numero ||
                        reserva.productionOrder?.orderNumber ||
                        reserva.workOrder?.orderNumber ||
                        '-'}
                    </TableCell>
                    <TableCell className={cn(expiringSoon && 'text-yellow-600 font-medium')}>
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
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"><Skeleton className="h-4 w-4" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-32" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
              <TableCell><Skeleton className="h-8 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-8 w-8" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
