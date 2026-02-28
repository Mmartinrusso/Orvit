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
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSolicitudes, useSolicitudesMutations, type SolicitudesFilters } from '../hooks';
import { AlmacenFilters } from '../shared/AlmacenFilters';
import { SolicitudStatusBadge, PriorityBadge } from '../shared/StatusBadge';
import { EmptyState } from '../shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { downloadCSV } from '@/lib/cargas/utils';

interface SolicitudesTabProps {
  onNew: () => void;
  onView: (id: number) => void;
}

/**
 * Tab de Solicitudes de Material
 */
export function SolicitudesTab({ onNew, onView }: SolicitudesTabProps) {
  const { toast } = useToast();
  const { user, hasPermission } = useAuth();
  const currentUserId = parseInt(user?.id ?? '0');

  // Permission flags
  const canEdit = hasPermission('almacen.request.edit');
  const canApprove = hasPermission('almacen.request.approve');
  const canReject = hasPermission('almacen.request.reject');
  const canCancel = hasPermission('almacen.request.cancel');

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
        userId: currentUserId,
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

  const handleExportCSV = useCallback(() => {
    const headers = ['Número', 'Tipo', 'Estado', 'Urgencia', 'Solicitante', 'Items', 'Fecha'];
    const rows = requests.map((r: any) => [
      r.numero || '',
      r.tipo || '',
      r.estado || '',
      r.urgencia || '',
      r.solicitante?.name || '',
      r.items?.length ?? 0,
      r.createdAt ? format(new Date(r.createdAt), 'dd/MM/yyyy', { locale: es }) : '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCSV(csv, `solicitudes-${format(new Date(), 'yyyy-MM-dd', { locale: es })}.csv`);
  }, [requests]);

  // Handlers de filtros
  const handleFilterChange = useCallback((key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setPagination({ page: 1, pageSize: 20 });
  }, []);

  const ActionsMenu = ({ request }: { request: any }) => (
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
        {canEdit && request.estado === 'BORRADOR' && (
          <DropdownMenuItem onClick={() => handleSubmit(request.id)}>
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </DropdownMenuItem>
        )}
        {request.estado === 'PENDIENTE_APROBACION' && (
          <>
            {canApprove && (
              <DropdownMenuItem onClick={() => handleApprove(request.id, currentUserId)}>
                <Check className="h-4 w-4 mr-2" />
                Aprobar
              </DropdownMenuItem>
            )}
            {canReject && (
              <DropdownMenuItem onClick={() => handleReject(request.id, currentUserId)}>
                <X className="h-4 w-4 mr-2" />
                Rechazar
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        {canCancel && request.estado !== 'DESPACHADA' && request.estado !== 'CANCELADA' && (
          <DropdownMenuItem
            onClick={() => handleCancel(request.id)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Cancelar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
          {canApprove && selectedIds.length > 0 && (
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
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleExportCSV} disabled={requests.length === 0} title="Exportar CSV">
            <Download className="h-4 w-4" />
          </Button>
          {canEdit && (
            <Button onClick={onNew} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nueva Solicitud</span>
              <span className="sm:hidden">Nueva</span>
            </Button>
          )}
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={9} />
      ) : requests.length === 0 ? (
        <EmptyState
          type="solicitudes"
          action={{ label: 'Nueva Solicitud', onClick: onNew }}
        />
      ) : (
        <>
          {/* Cards mobile */}
          <div className="space-y-2 md:hidden">
            {requests.map((request: any) => (
              <div
                key={request.id}
                className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => onView(request.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{request.numero}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {request.solicitante?.name || '-'} · {format(new Date(request.createdAt), 'dd/MM/yy', { locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <SolicitudStatusBadge status={request.estado} size="sm" />
                    <div onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu request={request} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <PriorityBadge priority={request.urgencia} size="sm" />
                  <span className="text-xs text-muted-foreground">{request.tipo}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {request.items?.length || 0} item{(request.items?.length || 0) !== 1 ? 's' : ''}
                  </span>
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
                      <ActionsMenu request={request} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {requests.length} de {total} solicitudes
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
