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

interface DespachosTabProps {
  onNew: () => void;
  onView: (id: number) => void;
}

/**
 * Tab de Despachos
 */
export function DespachosTab({ onNew, onView }: DespachosTabProps) {
  const { toast } = useToast();
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
      await dispatch.mutateAsync({ id, userId: 1 }); // TODO: Get current user
      toast({ title: 'Despacho realizado' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReceive = async (id: number) => {
    try {
      await receive.mutateAsync({ id, userId: 1 }); // TODO: Get current user
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
          {selectedIds.length > 0 && (
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
          <Button onClick={onNew} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Despacho
          </Button>
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={9} />
      ) : despachos.length === 0 ? (
        <EmptyState
          type="despachos"
          action={{ label: 'Nuevo Despacho', onClick: onNew }}
        />
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
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
                          {despacho.estado === 'BORRADOR' && (
                            <DropdownMenuItem onClick={() => handlePrepare(despacho.id)}>
                              <PackageCheck className="h-4 w-4 mr-2" />
                              Preparar
                            </DropdownMenuItem>
                          )}
                          {despacho.estado === 'EN_PREPARACION' && (
                            <DropdownMenuItem onClick={() => handleMarkReady(despacho.id)}>
                              <PackageCheck className="h-4 w-4 mr-2" />
                              Marcar Listo
                            </DropdownMenuItem>
                          )}
                          {despacho.estado === 'LISTO_DESPACHO' && (
                            <DropdownMenuItem onClick={() => handleDispatch(despacho.id)}>
                              <Truck className="h-4 w-4 mr-2" />
                              Despachar
                            </DropdownMenuItem>
                          )}
                          {despacho.estado === 'DESPACHADO' && (
                            <DropdownMenuItem onClick={() => handleReceive(despacho.id)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Confirmar Recepción
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {!['DESPACHADO', 'RECIBIDO', 'CANCELADO'].includes(despacho.estado) && (
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Mostrando {despachos.length} de {total} despachos
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

