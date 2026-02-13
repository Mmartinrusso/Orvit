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
  Send,
  Check,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDevoluciones, useDevolucionesMutations, type DevolucionesFilters } from '../hooks';
import { AlmacenFilters } from '../shared/AlmacenFilters';
import { DevolucionStatusBadge } from '../shared/StatusBadge';
import { EmptyState } from '../shared/EmptyState';
import { useToast } from '@/hooks/use-toast';

interface DevolucionesTabProps {
  onNew: () => void;
  onView: (id: number) => void;
}

/**
 * Tab de Devoluciones
 */
export function DevolucionesTab({ onNew, onView }: DevolucionesTabProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<DevolucionesFilters>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });

  const { data, isLoading, isFetching, refetch } = useDevoluciones({
    filters,
    pagination,
  });

  const { submit, accept, reject } = useDevolucionesMutations();

  const devoluciones = data?.devoluciones || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Handlers de acciones
  const handleSubmit = async (id: number) => {
    try {
      await submit.mutateAsync(id);
      toast({ title: 'Devolución enviada para revisión' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAccept = async (id: number) => {
    try {
      await accept.mutateAsync({ id, userId: 1 }); // TODO: Get current user
      toast({ title: 'Devolución aceptada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReject = async (id: number) => {
    try {
      await reject.mutateAsync({ id, userId: 1 }); // TODO: Get current user
      toast({ title: 'Devolución rechazada' });
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
          warehouseId={filters.warehouseId}
          onSearchChange={(v) => handleFilterChange('search', v)}
          onEstadoChange={(v) => handleFilterChange('estado', v)}
          onWarehouseChange={(v) => handleFilterChange('warehouseId', v)}
          onClear={handleClearFilters}
          onRefresh={() => refetch()}
          showTipo={false}
          filterType="devoluciones"
          isLoading={isFetching}
        />

        <Button onClick={onNew} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nueva Devolución
        </Button>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <TableSkeleton />
      ) : devoluciones.length === 0 ? (
        <EmptyState
          type="devoluciones"
          action={{ label: 'Nueva Devolución', onClick: onNew }}
        />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Despacho</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devoluciones.map((devolucion: any) => (
                  <TableRow
                    key={devolucion.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onView(devolucion.id)}
                  >
                    <TableCell className="font-medium">{devolucion.numero}</TableCell>
                    <TableCell>
                      <DevolucionStatusBadge status={devolucion.estado} size="sm" />
                    </TableCell>
                    <TableCell>{devolucion.despacho?.numero || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {devolucion.motivo || '-'}
                    </TableCell>
                    <TableCell>{devolucion.solicitante?.name || '-'}</TableCell>
                    <TableCell>{devolucion.items?.length || 0}</TableCell>
                    <TableCell>
                      {format(new Date(devolucion.createdAt), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(devolucion.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>
                          {devolucion.estado === 'BORRADOR' && (
                            <DropdownMenuItem onClick={() => handleSubmit(devolucion.id)}>
                              <Send className="h-4 w-4 mr-2" />
                              Enviar
                            </DropdownMenuItem>
                          )}
                          {devolucion.estado === 'PENDIENTE_REVISION' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAccept(devolucion.id)}>
                                <Check className="h-4 w-4 mr-2" />
                                Aceptar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(devolucion.id)}>
                                <X className="h-4 w-4 mr-2" />
                                Rechazar
                              </DropdownMenuItem>
                            </>
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
              Mostrando {devoluciones.length} de {total} devoluciones
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
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-32" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-12" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-5 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
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
