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
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAjustes, useAjustesMutations, type AjustesFilters } from '../hooks';
import { AlmacenFilters } from '../shared/AlmacenFilters';
import { AjusteStatusBadge } from '../shared/StatusBadge';
import { EmptyState } from '../shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { downloadCSV } from '@/lib/cargas/utils';
import { AdjustmentTypeLabels, type AdjustmentType } from '@/lib/almacen/types';

interface AjustesTabProps {
  onNew: () => void;
  onView: (id: number) => void;
}

/**
 * Tab de Ajustes de Stock
 */
export function AjustesTab({ onNew, onView }: AjustesTabProps) {
  const { toast } = useToast();

  const [filters, setFilters] = useState<AjustesFilters>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });

  const { data, isLoading, isFetching, refetch } = useAjustes({
    filters,
    pagination,
  });

  const { confirm, approve, reject } = useAjustesMutations();

  const ajustes = data?.data || [];
  const total = data?.pagination?.total || 0;
  const totalPages = data?.pagination?.totalPages || 1;

  // Handlers de acciones
  const handleConfirm = async (id: number) => {
    try {
      await confirm.mutateAsync(id);
      toast({ title: 'Ajuste confirmado' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approve.mutateAsync(id);
      toast({ title: 'Ajuste aprobado' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReject = async (id: number) => {
    try {
      await reject.mutateAsync(id);
      toast({ title: 'Ajuste rechazado' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleExportCSV = useCallback(() => {
    const headers = ['Numero', 'Tipo', 'Estado', 'Deposito', 'Items', 'Motivo', 'Creador', 'Fecha'];
    const rows = ajustes.map((a: any) => [
      a.numero || '',
      a.tipo ? (AdjustmentTypeLabels[a.tipo as AdjustmentType] || a.tipo) : '',
      a.estado || '',
      a.warehouse?.nombre || '',
      a._count?.items ?? 0,
      a.motivo || '',
      a.createdByUser?.name || '',
      a.createdAt ? format(new Date(a.createdAt), 'dd/MM/yyyy', { locale: es }) : '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCSV(csv, `ajustes-${format(new Date(), 'yyyy-MM-dd', { locale: es })}.csv`);
  }, [ajustes]);

  // Handlers de filtros
  const handleFilterChange = useCallback((key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setPagination({ page: 1, pageSize: 20 });
  }, []);

  const ActionsMenu = ({ ajuste }: { ajuste: any }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(ajuste.id)}>
          <Eye className="h-4 w-4 mr-2" />
          Ver detalle
        </DropdownMenuItem>
        {ajuste.estado === 'BORRADOR' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleConfirm(ajuste.id)}>
              <Check className="h-4 w-4 mr-2" />
              Confirmar
            </DropdownMenuItem>
          </>
        )}
        {ajuste.estado === 'PENDIENTE_APROBACION' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleApprove(ajuste.id)}>
              <Check className="h-4 w-4 mr-2" />
              Aprobar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleReject(ajuste.id)}
              className="text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Rechazar
            </DropdownMenuItem>
          </>
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
          showTipo={true}
          filterType="ajustes"
          isLoading={isFetching}
        />

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleExportCSV} disabled={ajustes.length === 0} title="Exportar CSV">
            <Download className="h-4 w-4" />
          </Button>
          <Button onClick={onNew} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Nuevo Ajuste</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={9} />
      ) : ajustes.length === 0 ? (
        <EmptyState
          type="generic"
          title="No hay ajustes"
          description="No se encontraron ajustes de stock. Crea un nuevo ajuste para comenzar."
          action={{ label: 'Nuevo Ajuste', onClick: onNew }}
        />
      ) : (
        <>
          {/* Cards mobile */}
          <div className="space-y-2 md:hidden">
            {ajustes.map((ajuste: any) => (
              <div
                key={ajuste.id}
                className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => onView(ajuste.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{ajuste.numero}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <AjusteStatusBadge status={ajuste.estado} size="sm" />
                    <div onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu ajuste={ajuste} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {AdjustmentTypeLabels[ajuste.tipo as AdjustmentType] || ajuste.tipo}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {ajuste.warehouse?.nombre || '-'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ajuste._count?.items || 0} item{(ajuste._count?.items || 0) !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(ajuste.createdAt), 'dd/MM/yy', { locale: es })}
                  </span>
                </div>
                {ajuste.motivo && (
                  <p className="text-xs text-muted-foreground max-w-full truncate mt-1">
                    {ajuste.motivo}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Tabla desktop */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Deposito</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Creador</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ajustes.map((ajuste: any) => (
                  <TableRow
                    key={ajuste.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onView(ajuste.id)}
                  >
                    <TableCell className="font-medium">{ajuste.numero}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {AdjustmentTypeLabels[ajuste.tipo as AdjustmentType] || ajuste.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AjusteStatusBadge status={ajuste.estado} size="sm" />
                    </TableCell>
                    <TableCell>{ajuste.warehouse?.nombre || '-'}</TableCell>
                    <TableCell>{ajuste._count?.items || 0}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {ajuste.motivo || '-'}
                    </TableCell>
                    <TableCell>{ajuste.createdByUser?.name || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(ajuste.createdAt), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu ajuste={ajuste} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginacion */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {ajustes.length} de {total} ajustes
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
