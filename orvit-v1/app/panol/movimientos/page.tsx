'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/date-utils';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw, Calendar,
  User, Package, Download, X, ArrowLeftRight, Wrench, RotateCcw,
  Box, Cog, History, Loader2, Minus, Share2,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import MovementDialog from '@/components/panol/MovementDialog';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';

interface Movement {
  id: number;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'LOAN' | 'RETURN';
  quantity: number;
  reason: string;
  description: string | null;
  createdAt: string;
  userId: number;
  tool: { id: number; name: string; itemType: string };
  user?: { id: number; name: string };
}

const MOVEMENT_TYPES: Record<string, { label: string; icon: React.ElementType; color: string; shortLabel: string; isOut?: boolean }> = {
  IN: { label: 'Entrada', icon: ArrowUpCircle, color: 'text-success', shortLabel: 'Entr.' },
  OUT: { label: 'Salida', icon: ArrowDownCircle, color: 'text-destructive', shortLabel: 'Sal.', isOut: true },
  TRANSFER: { label: 'Transferencia', icon: ArrowLeftRight, color: 'text-info-muted-foreground', shortLabel: 'Transf.' },
  ADJUSTMENT: { label: 'Ajuste', icon: Minus, color: 'text-warning-muted-foreground', shortLabel: 'Ajuste' },
  LOAN: { label: 'Préstamo', icon: Share2, color: 'text-destructive', shortLabel: 'Prést.', isOut: true },
  RETURN: { label: 'Devolución', icon: RotateCcw, color: 'text-accent-purple-muted-foreground', shortLabel: 'Dev.' },
};

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  TOOL: Wrench, SUPPLY: Box, SPARE_PART: Cog, HAND_TOOL: Wrench,
};

async function fetchMovements(
  companyId: number,
  limit: number,
  dateFrom?: string,
  dateTo?: string
): Promise<Movement[]> {
  const params = new URLSearchParams({ companyId: String(companyId), limit: String(limit) });
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const res = await fetch(`/api/tools/movements?${params}`);
  if (!res.ok) throw new Error('Error al cargar movimientos');
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.movements || data?.items || []);
}

export default function MovimientosPage() {
  const { currentCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(50);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);

  const { data: movements = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['panol-movements', currentCompany?.id, limit, dateFrom, dateTo],
    queryFn: () => fetchMovements(currentCompany!.id, limit, dateFrom || undefined, dateTo || undefined),
    enabled: !!currentCompany?.id,
    staleTime: 1000 * 60 * 2,
  });

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchesSearch =
        m.tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || m.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [movements, searchTerm, selectedType]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMovements = movements.filter((m) => new Date(m.createdAt) >= today);
    return {
      total: movements.length,
      today: todayMovements.length,
      entries: movements.filter((m) => m.type === 'IN' || m.type === 'RETURN').length,
      exits: movements.filter((m) => m.type === 'OUT').length,
    };
  }, [movements]);

  const handleExportCSV = () => {
    if (filteredMovements.length === 0) { toast.error('No hay movimientos para exportar'); return; }
    const headers = ['Fecha', 'Tipo', 'Item', 'Cantidad', 'Razón', 'Usuario'];
    const rows = filteredMovements.map((m) => [
      formatDateTime(m.createdAt),
      MOVEMENT_TYPES[m.type]?.label || m.type,
      m.tool.name,
      MOVEMENT_TYPES[m.type]?.isOut ? `-${m.quantity}` : `+${m.quantity}`,
      m.reason,
      m.user?.name || '-',
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `movimientos_panol_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success('Archivo CSV descargado');
  };

  const clearFilters = () => { setSearchTerm(''); setSelectedType('all'); setDateFrom(''); setDateTo(''); };
  const hasFilters = searchTerm || selectedType !== 'all' || dateFrom || dateTo;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-full p-0">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Movimientos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Historial de entradas, salidas y transferencias
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Actualizar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 hidden sm:flex" onClick={handleExportCSV}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar CSV</TooltipContent>
              </Tooltip>
              <Button size="sm" className="h-9" onClick={() => setMovementDialogOpen(true)}>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nuevo</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold mt-1">{stats.total}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted"><History className="h-4 w-4 text-muted-foreground" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Hoy</p>
                    <p className="text-2xl font-bold mt-1">{stats.today}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted"><Calendar className="h-4 w-4 text-muted-foreground" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Entradas</p>
                    <p className="text-2xl font-bold mt-1 text-success">{stats.entries}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted"><ArrowUpCircle className="h-4 w-4 text-muted-foreground" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Salidas</p>
                    <p className="text-2xl font-bold mt-1 text-destructive">{stats.exits}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted"><ArrowDownCircle className="h-4 w-4 text-muted-foreground" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por item, razón..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-9 bg-background" />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-40 h-9 bg-background"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="IN">Entradas</SelectItem>
                <SelectItem value="OUT">Salidas</SelectItem>
                <SelectItem value="TRANSFER">Transferencias</SelectItem>
                <SelectItem value="ADJUSTMENT">Ajustes</SelectItem>
                <SelectItem value="LOAN">Préstamos</SelectItem>
                <SelectItem value="RETURN">Devoluciones</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden sm:flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-36 bg-background text-sm"
                placeholder="Desde"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-36 bg-background text-sm"
                placeholder="Hasta"
              />
            </div>
            <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
              <SelectTrigger className="hidden sm:flex w-32 h-9 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4 mr-1" />Limpiar
              </Button>
            )}
          </div>

          {/* Empty state */}
          {filteredMovements.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No hay movimientos</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {movements.length === 0 ? 'No hay movimientos registrados aún' : 'Probá ajustando los filtros'}
              </p>
              {movements.length === 0 && (
                <Button size="sm" onClick={() => setMovementDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />Registrar primer movimiento
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE: Cards */}
              <div className="sm:hidden space-y-2">
                {filteredMovements.map((movement) => {
                  const typeConfig = MOVEMENT_TYPES[movement.type] || MOVEMENT_TYPES.IN;
                  const TypeIcon = typeConfig.icon;
                  return (
                    <Card key={movement.id} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <TypeIcon className={cn('h-5 w-5 shrink-0', typeConfig.color)} />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{movement.tool.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{movement.reason}</p>
                            </div>
                          </div>
                          <span className={cn('text-sm font-bold shrink-0', MOVEMENT_TYPES[movement.type]?.isOut ? 'text-destructive' : 'text-success')}>
                            {MOVEMENT_TYPES[movement.type]?.isOut ? '-' : '+'}{movement.quantity}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(movement.createdAt), { addSuffix: true, locale: es })}</span>
                          {movement.user && <span>{movement.user.name}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* DESKTOP: Table */}
              <div className="hidden sm:block rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-medium">Fecha</TableHead>
                      <TableHead className="text-xs font-medium">Tipo</TableHead>
                      <TableHead className="text-xs font-medium">Item</TableHead>
                      <TableHead className="text-xs font-medium text-center">Cantidad</TableHead>
                      <TableHead className="text-xs font-medium">Razón</TableHead>
                      <TableHead className="text-xs font-medium">Usuario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements.map((movement) => {
                      const typeConfig = MOVEMENT_TYPES[movement.type] || MOVEMENT_TYPES.IN;
                      const TypeIcon = typeConfig.icon;
                      const ItemIcon = ITEM_TYPE_ICONS[movement.tool.itemType] || Package;
                      return (
                        <TableRow key={movement.id} className="hover:bg-muted/20">
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-muted-foreground cursor-default">
                                  {formatDistanceToNow(new Date(movement.createdAt), { addSuffix: true, locale: es })}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{formatDateTime(movement.createdAt)}</TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
                              <Badge variant="secondary" className="text-xs font-normal">{typeConfig.label}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                                <ItemIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <span className="text-sm font-medium">{movement.tool.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={cn('text-sm font-bold', MOVEMENT_TYPES[movement.type]?.isOut ? 'text-destructive' : 'text-success')}>
                              {MOVEMENT_TYPES[movement.type]?.isOut ? '-' : '+'}{movement.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{movement.reason}</TableCell>
                          <TableCell>
                            {movement.user ? (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <User className="h-3.5 w-3.5" />{movement.user.name}
                              </div>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {filteredMovements.length >= limit && (
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={() => setLimit((prev) => prev + 50)}>Cargar más</Button>
            </div>
          )}
        </div>

        <MovementDialog
          isOpen={movementDialogOpen}
          onClose={() => setMovementDialogOpen(false)}
          onSave={() => { toast.success('Movimiento registrado'); refetch(); }}
        />
      </div>
    </TooltipProvider>
  );
}
