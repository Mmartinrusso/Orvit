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
import { SkeletonTable } from '@/components/ui/skeleton-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreHorizontal,
  Eye,
  PackageCheck,
  Truck,
  CheckCircle,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDespachos, useDespachosMutations, type DespachosFilters } from '../hooks';
import { AlmacenFilters } from '../shared/AlmacenFilters';
import { DespachoStatusBadge } from '../shared/StatusBadge';
import { EmptyState } from '../shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface DespachosTabProps {
  onNew: () => void;
  onView: (id: number) => void;
}

/**
 * Tab de Despachos
 */
export function DespachosTab({ onNew, onView }: DespachosTabProps) {
  const { toast } = useToast();
  const { user, hasPermission } = useAuth();
  const currentUserId = parseInt(user?.id ?? '0');

  // Permission flags
  const canCreate = hasPermission('almacen.dispatch.create');
  const canProcess = hasPermission('almacen.dispatch.process');
  const canConfirm = hasPermission('almacen.dispatch.confirm');
  const canReceive = hasPermission('almacen.dispatch.receive');
  const canCancel = hasPermission('almacen.dispatch.cancel');

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<DespachosFilters>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });

  const { data, isLoading, isFetching, refetch } = useDespachos({
    filters,
    pagination,
  });

  const { prepare, markReady, dispatch, receive, cancel, batchAction } = useDespachosMutations();

  const despachos = data?.despachos || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Handlers de selección
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === despachos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(despachos.map((d: any) => d.id));
    }
  }, [selectedIds.length, despachos]);

  // Handlers de acciones
  const handlePrepare = async (id: number) => {
    try {
      await prepare.mutateAsync(id);
      toast({ title: 'Despacho en preparación' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleMarkReady = async (id: number) => {
    try {
      await markReady.mutateAsync(id);
      toast({ title: 'Despacho listo para entregar' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDispatch = async (id: number) => {
    try {
      await dispatch.mutateAsync({ id, userId: currentUserId });
      toast({ title: 'Despacho realizado' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReceive = async (id: number) => {
    try {
      await receive.mutateAsync({ id, userId: currentUserId });
      toast({ title: 'Recepción confirmada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancel.mutateAsync({ id });
      toast({ title: 'Despacho cancelado' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBatchReady = async () => {
    if (selectedIds.length === 0) return;
    try {
      const result = await batchAction.mutateAsync({
        ids: selectedIds,
        action: 'ready',
      });
      toast({
        title: 'Acción completada',
        description: `${result.success} despachos marcados como listos`,
      });
      setSelectedIds([]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Handlers de filtros
  const handleFilterChange = useCallback((key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setPagination({ page: 1, pageSize: 20 });
  }, []);

  const ActionsMenu = ({ despacho }: { despacho: any }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(despacho.id)}>
          <Eye className="h-4 w-4 mr-2" />
          Ver detalle
        </DropdownMenuItem>
        {canProcess && despacho.estado === 'BORRADOR' && (
          <DropdownMenuItem onClick={() => handlePrepare(despacho.id)}>
            <PackageCheck className="h-4 w-4 mr-2" />
            Preparar
          </DropdownMenuItem>
        )}
        {canProcess && despacho.estado === 'EN_PREPARACION' && (
          <DropdownMenuItem onClick={() => handleMarkReady(despacho.id)}>
            <PackageCheck className="h-4 w-4 mr-2" />
            Marcar Listo
          </DropdownMenuItem>
        )}
        {canConfirm && despacho.estado === 'LISTO_DESPACHO' && (
          <DropdownMenuItem onClick={() => handleDispatch(despacho.id)}>
            <Truck className="h-4 w-4 mr-2" />
            Despachar
          </DropdownMenuItem>
        )}
        {canReceive && despacho.estado === 'DESPACHADO' && (
          <DropdownMenuItem onClick={() => handleReceive(despacho.id)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar Recepción
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {canCancel && !['DESPACHADO', 'RECIBIDO', 'CANCELADO'].includes(despacho.estado) && (
          <DropdownMenuItem
            onClick={() => handleCancel(despacho.id)}
            className="text-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Botón de acción principal según estado (para mobile)
  const PrimaryAction = ({ despacho }: { despacho: any }) => {
    if (canProcess && despacho.estado === 'BORRADOR')
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handlePrepare(despacho.id); }}>
          <PackageCheck className="h-3 w-3 mr-1" /> Preparar
        </Button>
      );
    if (canProcess && despacho.estado === 'EN_PREPARACION')
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleMarkReady(despacho.id); }}>
          <PackageCheck className="h-3 w-3 mr-1" /> Marcar Listo
        </Button>
      );
    if (canConfirm && despacho.estado === 'LISTO_DESPACHO')
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleDispatch(despacho.id); }}>
          <Truck className="h-3 w-3 mr-1" /> Despachar
        </Button>
      );
    if (canReceive && despacho.estado === 'DESPACHADO')
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleReceive(despacho.id); }}>
          <CheckCircle className="h-3 w-3 mr-1" /> Recibido
        </Button>
      );
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header con filtros y acciones */}
      <div className="flex items-center justify-between">
        <AlmacenFilters
          search={filters.search}
          estado={filters.estado || 'all'}
          tipo={filters.tipo || 'all'}
          warehouseId={filters.warehouseId}
          onSearchChange={(v) => handleFilterChange('search', v)}
          onEstadoChange={(v) => handleFilterChange('estado', v)}
          onTipoChange={(v) => handleFilterChange('tipo', v)}
          onWarehouseChange={(v) => handleFilterChange('warehouseId', v)}
          onClear={handleClearFilters}
          onRefresh={() => refetch()}
          showTipo
          filterType="despachos"
          isLoading={isFetching}
        />

        <div className="flex items-center gap-2">
          {canProcess && selectedIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchReady}
              disabled={batchAction.isPending}
            >
              <PackageCheck className="h-4 w-4 mr-1" />
              Marcar Listos ({selectedIds.length})
            </Button>
          )}
          {canCreate && (
            <Button onClick={onNew} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nuevo Despacho</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          )}
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={9} />
      ) : despachos.length === 0 ? (
        <EmptyState
          type="despachos"
          action={{ label: 'Nuevo Despacho', onClick: onNew }}
        />
      ) : (
        <>
          {/* Cards mobile */}
          <div className="space-y-2 md:hidden">
            {despachos.map((despacho: any) => (
              <div
                key={despacho.id}
                className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => onView(despacho.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{despacho.numero}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {despacho.warehouse?.nombre || '-'} · {format(new Date(despacho.createdAt), 'dd/MM/yy', { locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <DespachoStatusBadge status={despacho.estado} size="sm" />
                    <div onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu despacho={despacho} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">{despacho.tipo}</span>
                  {despacho.materialRequest?.numero && (
                    <span className="text-xs text-muted-foreground">· Sol. {despacho.materialRequest.numero}</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {despacho.items?.length || 0} item{(despacho.items?.length || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <PrimaryAction despacho={despacho} />
                </div>
              </div>
            ))}
          </div>

          {/* Tabla desktop */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === despachos.length && despachos.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Solicitud</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despachos.map((despacho: any) => (
                  <TableRow
                    key={despacho.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onView(despacho.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(despacho.id)}
                        onCheckedChange={() => toggleSelect(despacho.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{despacho.numero}</TableCell>
                    <TableCell>{despacho.tipo}</TableCell>
                    <TableCell>
                      <DespachoStatusBadge status={despacho.estado} size="sm" />
                    </TableCell>
                    <TableCell>{despacho.materialRequest?.numero || '-'}</TableCell>
                    <TableCell>{despacho.warehouse?.nombre || '-'}</TableCell>
                    <TableCell>{despacho.items?.length || 0}</TableCell>
                    <TableCell>
                      {format(new Date(despacho.createdAt), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu despacho={despacho} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {despachos.length} de {total} despachos
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
