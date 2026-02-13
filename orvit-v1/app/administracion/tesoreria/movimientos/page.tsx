'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCcw,
  Search,
  X,
  Download,
  Filter,
  Calendar,
  Wallet,
  Building2,
  FileCheck2,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TreasuryMovement {
  id: number;
  fecha: string;
  fechaValor: string | null;
  tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA_INTERNA' | 'AJUSTE';
  medio: string;
  monto: number;
  moneda: string;
  accountType: 'CASH' | 'BANK' | 'CHECK_PORTFOLIO';
  descripcion: string | null;
  numeroComprobante: string | null;
  conciliado: boolean;
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'REVERSADO';
  referenceType: string | null;
  referenceId: number | null;
  cashAccount: { id: number; nombre: string } | null;
  bankAccount: { id: number; nombre: string; banco: string } | null;
  cheque: { id: number; numero: string; banco: string; monto: number } | null;
}

interface MovementsResponse {
  data: TreasuryMovement[];
  pagination: { total: number; limit: number; offset: number };
  summary: { ingresos: number; egresos: number; neto: number };
}

async function fetchMovements(
  companyId: number,
  viewMode: string,
  filters: {
    accountType?: string;
    tipo?: string;
    estado?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    limit: number;
    offset: number;
  }
): Promise<MovementsResponse> {
  const params = new URLSearchParams({
    companyId: companyId.toString(),
    viewMode,
    limit: filters.limit.toString(),
    offset: filters.offset.toString(),
  });

  if (filters.accountType) params.append('accountType', filters.accountType);
  if (filters.tipo) params.append('tipo', filters.tipo);
  if (filters.estado) params.append('estado', filters.estado);
  if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
  if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);

  const res = await fetch(`/api/tesoreria/movimientos?${params}`);
  if (!res.ok) throw new Error('Error al obtener movimientos');
  return res.json();
}

const MEDIOS_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE_TERCERO: 'Cheque Tercero',
  CHEQUE_PROPIO: 'Cheque Propio',
  ECHEQ: 'E-Cheq',
  TARJETA_CREDITO: 'Tarjeta Crédito',
  TARJETA_DEBITO: 'Tarjeta Débito',
  DEPOSITO: 'Depósito',
  COMISION: 'Comisión',
  INTERES: 'Interés',
  AJUSTE: 'Ajuste',
};

export default function MovimientosPage() {
  const { viewMode } = useViewMode();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id || 0;

  const [filters, setFilters] = useState({
    accountType: '',
    tipo: '',
    estado: '',
    fechaDesde: '',
    fechaHasta: '',
    limit: 50,
    offset: 0,
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tesoreria', 'movimientos', companyId, viewMode, filters],
    queryFn: () => fetchMovements(companyId, viewMode, filters),
    enabled: !!companyId,
  });

  const clearFilters = () => {
    setFilters({
      accountType: '',
      tipo: '',
      estado: '',
      fechaDesde: '',
      fechaHasta: '',
      limit: 50,
      offset: 0,
    });
  };

  const hasActiveFilters = filters.accountType || filters.tipo || filters.estado || filters.fechaDesde;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <h1 className="text-xl font-semibold text-foreground">Movimientos de Tesorería</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Error al cargar movimientos</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const movements = data?.data || [];
  const summary = data?.summary || { ingresos: 0, egresos: 0, neto: 0 };
  const pagination = data?.pagination || { total: 0, limit: 50, offset: 0 };

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Movimientos de Tesorería</h1>
            <p className="text-sm text-muted-foreground mt-1">Registro unificado de todos los movimientos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                "inline-flex items-center border border-border rounded-md p-0.5 bg-muted/40 h-7",
                "px-2 text-[11px] font-normal gap-1.5",
                "hover:bg-muted disabled:opacity-50",
                isFetching && "bg-background shadow-sm"
              )}
            >
              <RefreshCcw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Actualizar
            </button>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Download className="h-3.5 w-3.5 mr-1" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className="px-4 md:px-6 pt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Ingresos</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(summary.ingresos)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Período filtrado</p>
                </div>
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <ArrowUpCircle className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Egresos</p>
                  <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(summary.egresos)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Período filtrado</p>
                </div>
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <ArrowDownCircle className="h-4 w-4 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Neto</p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    summary.neto >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(summary.neto)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Ingresos - Egresos</p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <FileCheck2 className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Movimientos</p>
                  <p className="text-2xl font-bold mt-1 text-primary">{pagination.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">En el período</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filtros y Lista */}
      <div className="px-4 md:px-6 pt-4 pb-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-sm font-medium">Listado de Movimientos</CardTitle>
                  <CardDescription className="text-xs">Filtrar por tipo, cuenta o fecha</CardDescription>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                    <X className="h-3.5 w-3.5 mr-1" />
                    Limpiar filtros
                  </Button>
                )}
              </div>

              {/* Filters Row */}
              <div className="flex flex-wrap gap-2">
                <Select
                  value={filters.accountType}
                  onValueChange={(value) => setFilters({ ...filters, accountType: value, offset: 0 })}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Tipo cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="CASH">Caja</SelectItem>
                    <SelectItem value="BANK">Banco</SelectItem>
                    <SelectItem value="CHECK_PORTFOLIO">Cheques</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.tipo}
                  onValueChange={(value) => setFilters({ ...filters, tipo: value, offset: 0 })}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Movimiento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="INGRESO">Ingresos</SelectItem>
                    <SelectItem value="EGRESO">Egresos</SelectItem>
                    <SelectItem value="AJUSTE">Ajustes</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.estado}
                  onValueChange={(value) => setFilters({ ...filters, estado: value, offset: 0 })}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="CONFIRMADO">Confirmado</SelectItem>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="REVERSADO">Reversado</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  placeholder="Desde"
                  className="w-[140px] h-8 text-xs"
                  value={filters.fechaDesde}
                  onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value, offset: 0 })}
                />

                <Input
                  type="date"
                  placeholder="Hasta"
                  className="w-[140px] h-8 text-xs"
                  value={filters.fechaHasta}
                  onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value, offset: 0 })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No hay movimientos que coincidan con los filtros seleccionados.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Medio</TableHead>
                      <TableHead className="text-xs">Cuenta</TableHead>
                      <TableHead className="text-xs">Descripción</TableHead>
                      <TableHead className="text-xs text-right">Monto</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((mov) => (
                      <TableRow key={mov.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm">
                          {format(new Date(mov.fecha), 'dd/MM/yy', { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {mov.tipo === 'INGRESO' && <ArrowUpCircle className="h-3.5 w-3.5 text-green-600" />}
                            {mov.tipo === 'EGRESO' && <ArrowDownCircle className="h-3.5 w-3.5 text-red-600" />}
                            {mov.tipo === 'AJUSTE' && <FileCheck2 className="h-3.5 w-3.5 text-yellow-600" />}
                            <span className="text-xs">{mov.tipo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {MEDIOS_LABELS[mov.medio] || mov.medio}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1.5">
                            {mov.accountType === 'CASH' && <Wallet className="h-3 w-3 text-muted-foreground" />}
                            {mov.accountType === 'BANK' && <Building2 className="h-3 w-3 text-muted-foreground" />}
                            <span>
                              {mov.cashAccount?.nombre || mov.bankAccount?.nombre || '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {mov.descripcion || mov.referenceType || '-'}
                        </TableCell>
                        <TableCell className={cn(
                          "text-sm text-right font-mono",
                          mov.tipo === 'INGRESO' ? 'text-green-600' : mov.tipo === 'EGRESO' ? 'text-red-600' : ''
                        )}>
                          {mov.tipo === 'EGRESO' ? '-' : ''}
                          {formatCurrency(mov.monto)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              mov.estado === 'CONFIRMADO' ? 'default' :
                              mov.estado === 'PENDIENTE' ? 'secondary' : 'destructive'
                            }
                            className="text-xs"
                          >
                            {mov.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {pagination.total > filters.limit && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Mostrando {filters.offset + 1}-{Math.min(filters.offset + filters.limit, pagination.total)} de {pagination.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={filters.offset === 0}
                    onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={filters.offset + filters.limit >= pagination.total}
                    onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
