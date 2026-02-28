'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { usePermission } from '@/hooks/use-permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  MoreVertical,
  Download,
  CheckCircle,
  Wallet,
  XCircle,
  ChevronDown,
  FileSearch,
  ReceiptText,
  TrendingUp,
  Percent,
  BadgeDollarSign,
  User,
  CalendarDays,
  Hash,
  Receipt,
} from 'lucide-react';
import { formatCurrency, cn, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LiquidacionStatusBadge } from '@/components/ventas/liquidacion-status-badge';
import { BarChart, Bar, XAxis, YAxis, Cell as BarCell, Tooltip, ResponsiveContainer } from 'recharts';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#ec4899'];

const INVOICE_ESTADO_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  COBRADA: { bg: '#10b98115', text: '#10b981', label: 'Cobrada' },
  PARCIALMENTE_COBRADA: { bg: '#f59e0b15', text: '#f59e0b', label: 'Parcial' },
  EMITIDA: { bg: '#3b82f615', text: '#3b82f6', label: 'Emitida' },
  ENVIADA: { bg: '#6366f115', text: '#6366f1', label: 'Enviada' },
  VENCIDA: { bg: '#ef444415', text: '#ef4444', label: 'Vencida' },
  ANULADA: { bg: '#94a3b815', text: '#94a3b8', label: 'Anulada' },
  BORRADOR: { bg: '#94a3b815', text: '#94a3b8', label: 'Borrador' },
};

function getCobranzaInfo(invoices: any[]): { label: string; color: string; pct: number; totalFact: number; cobrado: number; saldo: number } {
  const totalFact = invoices.reduce((s, i) => s + Number(i.total), 0);
  const saldoPend = invoices.reduce((s, i) => s + Number(i.saldoPendiente || 0), 0);
  const cobrado = totalFact - saldoPend;
  const pct = totalFact > 0 ? Math.min(100, (cobrado / totalFact) * 100) : 0;

  let label: string;
  let color: string;
  if (invoices.length === 0) {
    label = 'Sin factura'; color = '#94a3b8';
  } else if (pct >= 100) {
    label = 'Cobrada'; color = '#10b981';
  } else if (pct > 0) {
    label = `Parcial ${formatNumber(pct, 0)}%`; color = '#f59e0b';
  } else {
    label = 'Emitida'; color = '#3b82f6';
  }

  return { label, color, pct, totalFact, cobrado, saldo: saldoPend };
}

export default function LiquidacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const { hasPermission: canPayCommission } = usePermission('ventas.comisiones.pay');
  const { hasPermission: canCalculateCommission } = usePermission('ventas.comisiones.calculate');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());
  const [showCostChart, setShowCostChart] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [medioPago, setMedioPago] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ventas/liquidaciones/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error('Error al cargar la liquidación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleAction = async (action: string, extra?: any) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/ventas/liquidaciones/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }
      toast.success(
        action === 'confirmar'
          ? 'Liquidación confirmada'
          : action === 'pagar'
            ? 'Liquidación marcada como pagada'
            : 'Liquidación anulada'
      );
      setPayDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmar = async () => {
    const ok = await confirm({
      title: 'Confirmar liquidación',
      description: 'Una vez confirmada, no se podrá editar. Los montos quedarán fijados.',
      confirmText: 'Confirmar',
    });
    if (ok) handleAction('confirmar');
  };

  const handleAnular = async () => {
    const ok = await confirm({
      title: 'Anular liquidación',
      description: 'Se anulará esta liquidación. Las ventas quedarán disponibles para otra liquidación.',
      confirmText: 'Anular',
      variant: 'destructive',
    });
    if (ok) handleAction('anular');
  };

  const toggleInvoice = (invId: number) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      next.has(invId) ? next.delete(invId) : next.add(invId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-7xl space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p className="text-muted-foreground">Liquidación no encontrada</p>
      </div>
    );
  }

  const itemsIncluidos = (data.items || []).filter((i: any) => i.incluido);

  // Cost composition
  const costMap = new Map<string, number>();
  for (const item of itemsIncluidos) {
    if (!item.sale?.items) continue;
    for (const si of item.sale.items) {
      for (const cb of si.costBreakdown || []) {
        costMap.set(cb.concepto, (costMap.get(cb.concepto) || 0) + Number(cb.monto) * Number(si.cantidad));
      }
    }
  }
  const costComposition = Array.from(costMap.entries())
    .map(([concepto, total]) => ({ concepto, total }))
    .sort((a, b) => b.total - a.total);

  const ajustes = Number(data.ajustes || 0);
  const totalLiquidacion = Number(data.totalLiquidacion);
  const totalComisiones = Number(data.totalComisiones);
  const totalVentas = Number(data.totalVentas);

  const selectedItem = selectedItemId !== null
    ? itemsIncluidos.find((i: any) => i.id === selectedItemId) ?? null
    : null;

  // Mini timeline steps
  const timelineSteps = [
    { label: 'Creada', date: data.createdAt, done: true },
    { label: 'Confirmada', date: data.confirmadoAt, done: ['CONFIRMADA', 'PAGADA'].includes(data.estado) },
    { label: 'Pagada', date: data.pagadoAt, done: data.estado === 'PAGADA' },
  ];
  if (data.estado === 'ANULADA') {
    timelineSteps.push({ label: 'Anulada', date: data.anulatedAt, done: true });
  }

  return (
    <PermissionGuard permission="ventas.liquidaciones.view">
      <div className="container mx-auto py-6 max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold font-mono">{data.numero}</h1>
                <LiquidacionStatusBadge estado={data.estado} />
              </div>
              <p className="text-sm text-muted-foreground">
                {data.seller?.name} · {format(new Date(data.fechaDesde), 'MMMM yyyy', { locale: es })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-10 sm:ml-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/ventas/liquidaciones/${id}/pdf?mode=download`, '_blank')}
            >
              <Download className="w-4 h-4 mr-1.5" />
              PDF
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Acciones <MoreVertical className="w-4 h-4 ml-1.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {data.estado === 'BORRADOR' && canCalculateCommission && (
                  <DropdownMenuItem onClick={handleConfirmar}>
                    <CheckCircle className="w-4 h-4 mr-2 text-blue-500" />
                    Confirmar liquidación
                  </DropdownMenuItem>
                )}
                {data.estado === 'CONFIRMADA' && canPayCommission && (
                  <DropdownMenuItem onClick={() => setPayDialogOpen(true)}>
                    <Wallet className="w-4 h-4 mr-2 text-success" />
                    Registrar pago
                  </DropdownMenuItem>
                )}
                {['BORRADOR', 'CONFIRMADA'].includes(data.estado) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={handleAnular}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Anular
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Ventas</p>
                  <p className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(totalVentas)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{itemsIncluidos.length} incluida{itemsIncluidos.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Comisión ({Number(data.comisionPorcentaje)}%)
                  </p>
                  <p className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(totalComisiones)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{data.seller?.name}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-violet-500/10 flex items-center justify-center">
                  <Percent className="h-4 w-4 text-violet-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Ajustes</p>
                  <p className={cn(
                    'text-xl font-bold mt-1 tabular-nums',
                    ajustes < 0 ? 'text-red-500' : ajustes > 0 ? 'text-success' : ''
                  )}>
                    {ajustes === 0 ? '—' : formatCurrency(ajustes)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(data.fechaDesde), 'dd/MM/yy', { locale: es })} –{' '}
                    {format(new Date(data.fechaHasta), 'dd/MM/yy', { locale: es })}
                  </p>
                </div>
                <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <BadgeDollarSign className="h-4 w-4 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-success/20 shadow-sm bg-success/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">A Pagar</p>
                  <p className="text-2xl font-bold mt-1 text-success-muted-foreground tabular-nums">
                    {formatCurrency(totalLiquidacion)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.estado === 'PAGADA' ? 'Pagada' : 'Pendiente'}
                  </p>
                </div>
                <div className="h-9 w-9 rounded-full bg-success/15 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ──── SPLIT LAYOUT ──── */}
        <div className="flex rounded-xl border overflow-hidden h-[calc(100vh-380px)] min-h-[500px]">

          {/* LEFT PANEL — OV list */}
          <div className="w-72 flex-shrink-0 flex flex-col border-r bg-muted/5">
            {/* Panel header */}
            <div className="px-4 py-3 border-b bg-muted/20 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {itemsIncluidos.length} venta{itemsIncluidos.length !== 1 ? 's' : ''} incluida{itemsIncluidos.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* OV Cards */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {itemsIncluidos.map((item: any) => {
                  const invoices = item.sale?.invoices || [];
                  const cob = getCobranzaInfo(invoices);
                  const isActive = selectedItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-muted/50',
                        isActive
                          ? 'border-l-[3px] border-l-primary bg-primary/5 pl-[9px]'
                          : 'border-l-[3px] border-l-transparent'
                      )}
                      onClick={() => setSelectedItemId(isActive ? null : item.id)}
                    >
                      {/* OV number + cobranza badge */}
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={cn('font-mono text-xs font-semibold truncate', isActive && 'text-primary')}>
                          {item.saleNumero}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                          style={{ backgroundColor: `${cob.color}20`, color: cob.color }}
                        >
                          {cob.label}
                        </span>
                      </div>
                      {/* Client */}
                      <p className="text-xs text-muted-foreground truncate">{item.clienteNombre}</p>
                      {/* Progress bar */}
                      {cob.totalFact > 0 && (
                        <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${cob.pct}%`, backgroundColor: cob.color }}
                          />
                        </div>
                      )}
                      {/* Comisión */}
                      <p className="text-xs text-muted-foreground mt-1">
                        Comisión: <span className="font-medium text-foreground">{formatCurrency(Number(item.comisionMonto))}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Compact timeline */}
            <div className="border-t p-3 flex-shrink-0 bg-muted/10">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Historial</p>
              <div className="space-y-1.5">
                {timelineSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      step.done
                        ? step.label === 'Anulada' ? 'bg-red-500' : 'bg-primary'
                        : 'bg-muted-foreground/30'
                    )} />
                    <span className={cn(
                      'text-xs',
                      step.done
                        ? step.label === 'Anulada' ? 'text-red-500' : 'text-foreground'
                        : 'text-muted-foreground'
                    )}>
                      {step.label}
                    </span>
                    {step.date && step.done && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(step.date), 'dd/MM', { locale: es })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — OV detail */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            {selectedItem === null ? (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <FileSearch className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Seleccioná una venta</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Hacé clic en una OV del panel izquierdo para ver su detalle completo
                  </p>
                </div>
              </div>
            ) : (
              /* OV Detail */
              <ScrollArea className="h-full">
                {(() => {
                  const item = selectedItem;
                  const invoices: any[] = item.sale?.invoices || [];
                  const cob = getCobranzaInfo(invoices);
                  const saleItems: any[] = item.sale?.items || [];

                  return (
                    <>
                      {/* Section 1 — Document header */}
                      <div className="flex items-start justify-between p-6 border-b gap-4">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Orden de Venta</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-2xl font-bold">{item.saleNumero}</span>
                            {item.sale?.estado && (
                              <Badge variant="outline" className="text-xs">
                                {item.sale.estado}
                              </Badge>
                            )}
                          </div>
                          <p className="text-lg font-semibold mt-1 truncate">{item.clienteNombre}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(item.fechaVenta), 'dd MMM yyyy', { locale: es })}
                          </p>
                          <p className="text-3xl font-bold tabular-nums mt-1">
                            {formatCurrency(Number(item.totalVenta))}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Comisión: <span className="font-semibold text-foreground">{formatCurrency(Number(item.comisionMonto))}</span>
                          </p>
                        </div>
                      </div>

                      {/* Section 2 — Cobranza */}
                      <div className="p-6 border-b space-y-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Estado de Cobranza
                        </p>
                        {invoices.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Sin facturas emitidas</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <span
                                className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
                                style={{ backgroundColor: `${cob.color}20`, color: cob.color }}
                              >
                                {cob.label}
                              </span>
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${cob.pct}%`, backgroundColor: cob.color }}
                                />
                              </div>
                              <span className="text-sm font-mono text-muted-foreground flex-shrink-0">
                                {formatNumber(cob.pct, 0)}%
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Facturado</p>
                                <p className="font-semibold tabular-nums text-sm mt-0.5">
                                  {formatCurrency(cob.totalFact)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Cobrado</p>
                                <p className="font-semibold tabular-nums text-sm mt-0.5 text-success-muted-foreground">
                                  {formatCurrency(cob.cobrado)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Saldo</p>
                                <p className={cn(
                                  'font-semibold tabular-nums text-sm mt-0.5',
                                  cob.saldo > 0 ? 'text-amber-600' : 'text-muted-foreground'
                                )}>
                                  {formatCurrency(cob.saldo)}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Section 3 — Facturas chips */}
                      <div className="p-6 border-b space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Facturas{' '}
                          <span className="ml-1 font-semibold text-foreground">{invoices.length}</span>
                        </p>
                        {invoices.length === 0 ? (
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed bg-muted/20 text-muted-foreground text-xs">
                            <ReceiptText className="w-3.5 h-3.5" />
                            Sin facturas emitidas para esta orden
                          </div>
                        ) : (
                          invoices.map((inv: any) => {
                            const colors = INVOICE_ESTADO_COLORS[inv.estado] || INVOICE_ESTADO_COLORS.BORRADOR;
                            const isExpanded = expandedInvoices.has(inv.id);
                            const cobradoInv = Number(inv.total) - Number(inv.saldoPendiente || 0);
                            const isVencida = inv.fechaVencimiento && new Date(inv.fechaVencimiento) < new Date() && Number(inv.saldoPendiente || 0) > 0;
                            return (
                              <div key={inv.id}>
                                <button
                                  onClick={() => toggleInvoice(inv.id)}
                                  className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors"
                                  style={{ borderColor: `${colors.text}40` }}
                                >
                                  <ReceiptText size={14} style={{ color: colors.text }} />
                                  <span className="font-mono text-sm flex-1 truncate">{inv.numeroCompleto}</span>
                                  <span
                                    className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                                    style={{ backgroundColor: colors.bg, color: colors.text }}
                                  >
                                    {colors.label}
                                  </span>
                                  <span className="tabular-nums text-sm font-semibold flex-shrink-0">
                                    {formatCurrency(Number(inv.total))}
                                  </span>
                                  <ChevronDown
                                    className={cn('h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform', isExpanded && 'rotate-180')}
                                  />
                                </button>
                                {isExpanded && (
                                  <div
                                    className="mt-1 ml-4 px-3 py-3 bg-muted/30 rounded-lg border-l-4 text-xs space-y-1"
                                    style={{ borderLeftColor: `${colors.text}60` }}
                                  >
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                      {inv.fechaEmision && (
                                        <>
                                          <span className="text-muted-foreground">Emitida</span>
                                          <span>{format(new Date(inv.fechaEmision), 'dd MMM yyyy', { locale: es })}</span>
                                        </>
                                      )}
                                      {inv.fechaVencimiento && (
                                        <>
                                          <span className="text-muted-foreground">Vencimiento</span>
                                          <span className={cn(isVencida && 'text-red-500 font-medium')}>
                                            {format(new Date(inv.fechaVencimiento), 'dd MMM yyyy', { locale: es })}
                                          </span>
                                        </>
                                      )}
                                      <span className="text-muted-foreground">Total</span>
                                      <span className="tabular-nums">{formatCurrency(Number(inv.total))}</span>
                                      <span className="text-muted-foreground">Cobrado</span>
                                      <span className="tabular-nums text-success-muted-foreground">{formatCurrency(cobradoInv)}</span>
                                      <span className="text-muted-foreground">Saldo</span>
                                      <span className={cn('tabular-nums', Number(inv.saldoPendiente || 0) > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                                        {formatCurrency(Number(inv.saldoPendiente || 0))}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Section 4 — Items / Productos */}
                      <div className="p-6 space-y-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Productos
                        </p>
                        {saleItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Sin detalle de productos</p>
                        ) : (
                          saleItems.map((si: any) => (
                            <div key={si.id} className="space-y-1.5 pb-3 border-b last:border-0 last:pb-0">
                              <div className="flex justify-between items-start gap-3">
                                <span className="font-medium text-sm">{si.descripcion}</span>
                                <span className="text-sm tabular-nums text-muted-foreground flex-shrink-0">
                                  {Number(si.cantidad)} × {formatCurrency(Number(si.precioUnitario))} ={' '}
                                  <strong className="text-foreground">{formatCurrency(Number(si.subtotal))}</strong>
                                </span>
                              </div>
                              {si.costBreakdown?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pl-2">
                                  {si.costBreakdown.map((cb: any, i: number) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                                      style={{
                                        backgroundColor: `${COLORS[i % COLORS.length]}15`,
                                        color: COLORS[i % COLORS.length],
                                      }}
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                      />
                                      {cb.concepto}: {formatCurrency(Number(cb.monto))}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  );
                })()}
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Cost composition — collapsible */}
        {costComposition.length > 0 && (
          <div className="border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowCostChart(!showCostChart)}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform flex-shrink-0', showCostChart && 'rotate-180')} />
              <span>Composición global de costos</span>
              <span className="text-xs ml-1">({costComposition.length} concepto{costComposition.length !== 1 ? 's' : ''})</span>
              <span className="ml-auto text-xs tabular-nums">
                {formatCurrency(costComposition.reduce((s, c) => s + c.total, 0))}
              </span>
            </button>
            {showCostChart && (
              <div className="px-4 pb-4 border-t">
                <div className="flex gap-6 items-center pt-4">
                  <div className="flex-1 h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={costComposition}
                        layout="vertical"
                        margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="concepto"
                          width={90}
                          tick={{ fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-popover border rounded-lg shadow-lg p-2.5 text-sm">
                                <p className="font-medium">{d.concepto}</p>
                                <p className="text-muted-foreground">{formatCurrency(d.total)}</p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={14}>
                          {costComposition.map((_, i) => (
                            <BarCell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-52 space-y-1.5">
                    {costComposition.map((item, idx) => (
                      <div key={item.concepto} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-muted-foreground truncate max-w-[90px]">{item.concepto}</span>
                        </div>
                        <span className="font-medium tabular-nums text-xs">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                    <Separator className="my-1" />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {formatCurrency(costComposition.reduce((s, c) => s + c.total, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Registrar el pago de{' '}
              <span className="font-semibold text-foreground">{formatCurrency(totalLiquidacion)}</span>{' '}
              a {data.seller?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Medio de Pago</Label>
              <Input
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                placeholder="Ej: Transferencia bancaria, Efectivo..."
              />
            </div>
            <div className="space-y-2">
              <Label>Referencia / Comprobante</Label>
              <Input
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                placeholder="Ej: CBU, número de transferencia..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleAction('pagar', { medioPago, referenciaPago })}
              disabled={actionLoading}
            >
              {actionLoading ? 'Procesando...' : 'Confirmar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGuard>
  );
}
