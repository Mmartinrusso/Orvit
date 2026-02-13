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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreHorizontal,
  Eye,
  Check,
  X,
  Send,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSolicitudes, useSolicitudesMutations, type SolicitudesFilters } from '../hooks';
import { AlmacenFilters } from '../shared/AlmacenFilters';
import { SolicitudStatusBadge, PriorityBadge } from '../shared/StatusBadge';
import { EmptyState } from '../shared/EmptyState';
import { useToast } from '@/hooks/use-toast';

interface SolicitudesTabProps {
  onNew: () => void;
  onView: (id: number) => void;
}

/**
 * Tab de Solicitudes de Material
 */
export function SolicitudesTab({ onNew, onView }: SolicitudesTabProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<SolicitudesFilters>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });

  const { data, isLoading, isFetching, refetch } = useSolicitudes({
    filters,
    pagination,
  });

  const { submit, approve, reject, cancel, batchAction } = useSolicitudesMutations();

  const requests = data?.requests || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Handlers de selección
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === requests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(requests.map((r: any) => r.id));
    }
  }, [selectedIds.length, requests]);

  // Handlers de acciones
  const handleSubmit = async (id: number) => {
    try {
      await submit.mutateAsync(id);
      toast({ title: 'Solicitud enviada correctamente' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleApprove = async (id: number, userId: number) => {
    try {
      await approve.mutateAsync({ id, userId });
      toast({ title: 'Solicitud aprobada correctamente' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReject = async (id: number, userId: number) => {
    try {
      await reject.mutateAsync({ id, userId });
      toast({ title: 'Solicitud rechazada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancel.mutateAsync({ id });
      toast({ title: 'Solicitud cancelada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      const result = await batchAction.mutateAsync({
        ids: selectedIds,
        action: 'approve',
        userId: 1, // TODO: Get current user
      });
      toast({
        title: 'Acción completada',
        description: `${result.success} solicitudes aprobadas`,
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
          filterType="solicitudes"
          isLoading={isFetching}
        />

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchApprove}
              disabled={batchAction.isPending}
            >
              <Check className="h-4 w-4 mr-1" />
              Aprobar ({selectedIds.length})
            </Button>
          )}
          <Button onClick={onNew} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nueva Solicitud
          </Button>
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <TableSkeleton />
      ) : requests.length === 0 ? (
        <EmptyState
          type="solicitudes"
          action={{ label: 'Nueva Solicitud', onClick: onNew }}
        />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === requests.length && requests.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Urgencia</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request: any) => (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onView(request.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(request.id)}
                        onCheckedChange={() => toggleSelect(request.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{request.numero}</TableCell>
                    <TableCell>{request.tipo}</TableCell>
                    <TableCell>
                      <SolicitudStatusBadge status={request.estado} size="sm" />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={request.urgencia} size="sm" />
                    </TableCell>
                    <TableCell>{request.solicitante?.name || '-'}</TableCell>
                    <TableCell>{request.items?.length || 0}</TableCell>
                    <TableCell>
                      {format(new Date(request.createdAt), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(request.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>
                          {request.estado === 'BORRADOR' && (
                            <DropdownMenuItem onClick={() => handleSubmit(request.id)}>
                              <Send className="h-4 w-4 mr-2" />
                              Enviar
                            </DropdownMenuItem>
                          )}
                          {request.estado === 'PENDIENTE_APROBACION' && (
                            <>
                              <DropdownMenuItem onClick={() => handleApprove(request.id, 1)}>
                                <Check className="h-4 w-4 mr-2" />
                                Aprobar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(request.id, 1)}>
                                <X className="h-4 w-4 mr-2" />
                                Rechazar
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          {request.estado !== 'DESPACHADA' && request.estado !== 'CANCELADA' && (
                            <DropdownMenuItem
                              onClick={() => handleCancel(request.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
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
              Mostrando {requests.length} de {total} solicitudes
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

function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"><Skeleton className="h-4 w-4" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-12" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-5 w-24" /></TableCell>
              <TableCell><Skeleton className="h-5 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-8 w-8" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
