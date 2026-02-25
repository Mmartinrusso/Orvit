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
  Send,
  PackageCheck,
  X,
  Trash2,
  Download,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTransferencias, useTransferenciasMutations, type TransferenciasFilters } from '../hooks';
import { AlmacenFilters } from '../shared/AlmacenFilters';
import { TransferenciaStatusBadge } from '../shared/StatusBadge';
import { EmptyState } from '../shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { downloadCSV } from '@/lib/cargas/utils';

interface TransferenciasTabProps {
  onNew: () => void;
  onView: (id: number) => void;
}

/**
 * Tab de Transferencias de Stock
 */
export function TransferenciasTab({ onNew, onView }: TransferenciasTabProps) {
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<TransferenciasFilters>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });

  const { data, isLoading, isFetching, refetch } = useTransferencias({
    filters,
    pagination,
  });

  const { send, receive, cancel } = useTransferenciasMutations();

  const transferencias = data?.data || [];
  const total = data?.pagination?.total || 0;
  const totalPages = data?.pagination?.totalPages || 1;

  // Handlers de selección
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === transferencias.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transferencias.map((t: any) => t.id));
    }
  }, [selectedIds.length, transferencias]);

  // Handlers de acciones
  const handleSend = async (id: number) => {
    try {
      await send.mutateAsync(id);
      toast({ title: 'Transferencia enviada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReceive = async (id: number) => {
    try {
      await receive.mutateAsync({ id });
      toast({ title: 'Transferencia recibida' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancel.mutateAsync(id);
      toast({ title: 'Transferencia cancelada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleExportCSV = useCallback(() => {
    const headers = ['Número', 'Estado', 'Origen', 'Destino', 'Items', 'Motivo', 'Creador', 'Fecha'];
    const rows = transferencias.map((t: any) => [
      t.numero || '',
      t.estado || '',
      t.warehouseOrigen?.nombre || '',
      t.warehouseDestino?.nombre || '',
      t._count?.items ?? 0,
      t.motivo || '',
      t.createdByUser?.name || '',
      t.createdAt ? format(new Date(t.createdAt), 'dd/MM/yyyy', { locale: es }) : '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCSV(csv, `transferencias-${format(new Date(), 'yyyy-MM-dd', { locale: es })}.csv`);
  }, [transferencias]);

  // Handlers de filtros
  const handleFilterChange = useCallback((key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setPagination({ page: 1, pageSize: 20 });
  }, []);

  const ActionsMenu = ({ transfer }: { transfer: any }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(transfer.id)}>
          <Eye className="h-4 w-4 mr-2" />
          Ver detalle
        </DropdownMenuItem>
        {transfer.estado === 'BORRADOR' && (
          <DropdownMenuItem onClick={() => handleSend(transfer.id)}>
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </DropdownMenuItem>
        )}
        {transfer.estado === 'EN_TRANSITO' && (
          <DropdownMenuItem onClick={() => handleReceive(transfer.id)}>
            <PackageCheck className="h-4 w-4 mr-2" />
            Recibir
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {['BORRADOR', 'SOLICITADO'].includes(transfer.estado) && (
          <DropdownMenuItem
            onClick={() => handleCancel(transfer.id)}
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
          warehouseId={filters.warehouseId}
          onSearchChange={(v) => handleFilterChange('search', v)}
          onEstadoChange={(v) => handleFilterChange('estado', v)}
          onWarehouseChange={(v) => handleFilterChange('warehouseId', v)}
          onClear={handleClearFilters}
          onRefresh={() => refetch()}
          showTipo={false}
          filterType="transferencias"
          isLoading={isFetching}
        />

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleExportCSV} disabled={transferencias.length === 0} title="Exportar CSV">
            <Download className="h-4 w-4" />
          </Button>
          <Button onClick={onNew} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Nueva Transferencia</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={9} />
      ) : transferencias.length === 0 ? (
        <EmptyState
          type="transferencias"
          action={{ label: 'Nueva Transferencia', onClick: onNew }}
        />
      ) : (
        <>
          {/* Cards mobile */}
          <div className="space-y-2 md:hidden">
            {transferencias.map((transfer: any) => (
              <div
                key={transfer.id}
                className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => onView(transfer.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{transfer.numero}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <TransferenciaStatusBadge status={transfer.estado} size="sm" />
                    <div onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu transfer={transfer} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground truncate">
                    {transfer.warehouseOrigen?.nombre || '-'}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {transfer.warehouseDestino?.nombre || '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">
                    {transfer._count?.items || 0} item{(transfer._count?.items || 0) !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {transfer.createdByUser?.name || '-'}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(transfer.createdAt), 'dd/MM/yy', { locale: es })}
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
                      checked={selectedIds.length === transferencias.length && transferencias.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Creador</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferencias.map((transfer: any) => (
                  <TableRow
                    key={transfer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onView(transfer.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(transfer.id)}
                        onCheckedChange={() => toggleSelect(transfer.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{transfer.numero}</TableCell>
                    <TableCell>
                      <TransferenciaStatusBadge status={transfer.estado} size="sm" />
                    </TableCell>
                    <TableCell>{transfer.warehouseOrigen?.nombre || '-'}</TableCell>
                    <TableCell>{transfer.warehouseDestino?.nombre || '-'}</TableCell>
                    <TableCell>{transfer._count?.items || 0}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {transfer.motivo || '-'}
                    </TableCell>
                    <TableCell>{transfer.createdByUser?.name || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(transfer.createdAt), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu transfer={transfer} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {transferencias.length} de {total} transferencias
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
