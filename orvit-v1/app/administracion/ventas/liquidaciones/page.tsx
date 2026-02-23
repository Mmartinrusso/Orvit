'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  Plus,
  Search,
  Wallet,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  ArrowUpRight,
  User,
  Calendar,
  ReceiptText,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LiquidacionStatusBadge } from '@/components/ventas/liquidacion-status-badge';

interface LiquidacionRow {
  id: number;
  numero: string;
  estado: string;
  fechaDesde: string;
  fechaHasta: string;
  totalVentas: number;
  totalComisiones: number;
  totalLiquidacion: number;
  seller: { id: number; name: string; email: string };
  createdAt: string;
  _count: { items: number };
}

interface Stats {
  pendientePago: { total: number; cantidad: number };
  confirmadas: { cantidad: number };
  pagadoEsteMes: { total: number; cantidad: number; variacion: number };
  totalAcumulado: { total: number; cantidad: number };
}

export default function LiquidacionesPage() {
  const router = useRouter();
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('all');

  const loadData = useCallback(async (currentPage: number, currentSearch: string, currentEstado: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
      if (currentSearch) params.set('search', currentSearch);
      if (currentEstado !== 'all') params.set('estado', currentEstado);

      const [liqRes, statsRes] = await Promise.all([
        fetch(`/api/ventas/liquidaciones?${params}`, { credentials: 'include' }),
        fetch('/api/ventas/liquidaciones/stats', { credentials: 'include' }),
      ]);

      if (liqRes.ok) {
        const liqData = await liqRes.json();
        setLiquidaciones(liqData.data || []);
        setTotalPages(liqData.pagination?.totalPages || 1);
        setTotalCount(liqData.pagination?.total || 0);
      }

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch {
      toast.error('Error al cargar liquidaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(page, search, estadoFilter);
  }, [page, estadoFilter]);

  const handleSearch = () => {
    setPage(1);
    loadData(1, search, estadoFilter);
  };

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    loadData(1, '', estadoFilter);
  };

  const kpiCards = stats ? [
    {
      label: 'Pendiente de Cobro',
      value: formatCurrency(stats.pendientePago.total),
      sub: `${stats.pendientePago.cantidad} liquidación${stats.pendientePago.cantidad !== 1 ? 'es' : ''}`,
      icon: Wallet,
      colorVar: '#f59e0b',
    },
    {
      label: 'Confirmadas',
      value: String(stats.confirmadas.cantidad),
      sub: 'esperando pago',
      icon: CheckCircle2,
      colorVar: '#3b82f6',
    },
    {
      label: 'Pagado este Mes',
      value: formatCurrency(stats.pagadoEsteMes.total),
      sub: `${stats.pagadoEsteMes.cantidad} pago${stats.pagadoEsteMes.cantidad !== 1 ? 's' : ''}`,
      icon: DollarSign,
      colorVar: '#10b981',
    },
    {
      label: 'Total Acumulado',
      value: formatCurrency(stats.totalAcumulado.total),
      sub: `${stats.totalAcumulado.cantidad} total`,
      icon: TrendingUp,
      colorVar: '#8b5cf6',
    },
  ] : [];

  const ESTADO_LABELS: Record<string, string> = {
    BORRADOR: 'Borrador',
    CONFIRMADA: 'Confirmada',
    PAGADA: 'Pagada',
    ANULADA: 'Anulada',
  };

  return (
    <PermissionGuard permission="ventas.liquidaciones.view">
      <div className="w-full p-0">

        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Liquidaciones</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Comisiones y pagos a vendedores
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => router.push('/administracion/ventas/liquidaciones/nueva')}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Liquidación
              </Button>
            </div>
          </div>
        </div>

        {/* Content with padding */}
        <div className="px-4 md:px-6 pt-4 space-y-4">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading && !stats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))
          ) : (
            kpiCards.map((card) => (
              <Card key={card.label} className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">
                        {card.label}
                      </p>
                      <p className="text-xl font-bold mt-1 tabular-nums">{card.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: `${card.colorVar}15` }}
                    >
                      <card.icon className="h-5 w-5" style={{ color: card.colorVar }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Filters toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número o vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 pr-10"
            />
            {search && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted"
                onClick={handleClearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Select
            value={estadoFilter}
            onValueChange={(v) => {
              setEstadoFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(ESTADO_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || estadoFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setSearch('');
                setEstadoFilter('all');
                setPage(1);
                loadData(1, '', 'all');
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Table */}
        <Card className="border shadow-sm overflow-hidden">
          {/* Table header row with count */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ReceiptText className="h-4 w-4" />
              {loading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <span>
                  {totalCount > 0
                    ? `${totalCount} liquidación${totalCount !== 1 ? 'es' : ''}`
                    : 'Sin resultados'}
                </span>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 w-[140px]">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    N° Liquidación
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Vendedor
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Periodo
                  </div>
                </TableHead>
                <TableHead className="text-center">Ventas</TableHead>
                <TableHead className="text-right">Total Ventas</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-8 pr-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className={cn('h-4', j === 0 ? 'w-28' : j === 1 ? 'w-24' : 'w-full')} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : liquidaciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <ReceiptText className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">No hay liquidaciones</p>
                        <p className="text-sm text-muted-foreground">
                          {search || estadoFilter !== 'all'
                            ? 'Probá ajustando los filtros'
                            : 'Creá la primera para comenzar'}
                        </p>
                      </div>
                      {!search && estadoFilter === 'all' && (
                        <Button
                          size="sm"
                          onClick={() => router.push('/administracion/ventas/liquidaciones/nueva')}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Nueva Liquidación
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                liquidaciones.map((liq) => (
                  <HoverCard key={liq.id} openDelay={400} closeDelay={150}>
                    <HoverCardTrigger asChild>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/40 group"
                        onClick={() => router.push(`/administracion/ventas/liquidaciones/${liq.id}`)}
                      >
                        <TableCell className="pl-4">
                          <span className="font-mono text-sm font-medium">{liq.numero}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-xs font-medium">
                              {liq.seller.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm">{liq.seller.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(liq.fechaDesde), 'dd MMM', { locale: es })}
                            {' – '}
                            {format(new Date(liq.fechaHasta), 'dd MMM yy', { locale: es })}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {liq._count.items}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCurrency(Number(liq.totalVentas))}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="tabular-nums text-sm font-semibold">
                            {formatCurrency(Number(liq.totalLiquidacion))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <LiquidacionStatusBadge estado={liq.estado} />
                        </TableCell>
                        <TableCell className="pr-4">
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </TableCell>
                      </TableRow>
                    </HoverCardTrigger>
                    <HoverCardContent side="right" align="start" className="w-72 p-0 overflow-hidden">
                      <div className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-sm font-semibold">{liq.numero}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{liq.seller.name}</p>
                          </div>
                          <LiquidacionStatusBadge estado={liq.estado} />
                        </div>
                        {/* Periodo */}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(liq.fechaDesde), "dd 'de' MMM", { locale: es })}
                          {' – '}
                          {format(new Date(liq.fechaHasta), "dd 'de' MMM yy", { locale: es })}
                        </p>
                        <Separator />
                        {/* A Pagar */}
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">A Pagar</p>
                          <p className="text-2xl font-bold tabular-nums text-success-muted-foreground">
                            {formatCurrency(Number(liq.totalLiquidacion))}
                          </p>
                        </div>
                        {/* Stats */}
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total ventas</span>
                            <span className="tabular-nums">{formatCurrency(Number(liq.totalVentas))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Comisión</span>
                            <span className="tabular-nums">{formatCurrency(Number(liq.totalComisiones))}</span>
                          </div>
                        </div>
                        <Separator />
                        {/* Footer */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {liq._count.items} venta{liq._count.items !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            Ver detalle <ArrowUpRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        </div>{/* end content with padding */}
      </div>
    </PermissionGuard>
  );
}
