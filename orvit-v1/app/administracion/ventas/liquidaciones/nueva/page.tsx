'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  User,
  Calendar,
  Send,
  ShoppingCart,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  AlertTriangle,
  Receipt,
  ReceiptText,
  TrendingUp,
  Percent,
  BadgeDollarSign,
  Wallet,
  Mail,
  Truck,
  MapPin,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  FileCheck,
  Building2,
  Hash,
  Clock,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BREAKDOWN_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#ec4899'];

const INVOICE_ESTADO_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  COBRADA: { bg: '#10b98115', text: '#10b981', label: 'Cobrada' },
  PARCIALMENTE_COBRADA: { bg: '#f59e0b15', text: '#f59e0b', label: 'Parcial' },
  EMITIDA: { bg: '#3b82f615', text: '#3b82f6', label: 'Emitida' },
  ENVIADA: { bg: '#6366f115', text: '#6366f1', label: 'Enviada' },
  VENCIDA: { bg: '#ef444415', text: '#ef4444', label: 'Vencida' },
  ANULADA: { bg: '#94a3b815', text: '#94a3b8', label: 'Anulada' },
  BORRADOR: { bg: '#94a3b815', text: '#94a3b8', label: 'Borrador' },
};

const OV_ESTADO_COLOR: Record<string, string> = {
  BORRADOR: '#94a3b8',
  PENDIENTE: '#3b82f6',
  CONFIRMADA: '#6366f1',
  EN_PROCESO: '#f59e0b',
  COMPLETADA: '#10b981',
  CANCELADA: '#ef4444',
  EMITIDA: '#3b82f6',
  ENTREGADA: '#10b981',
};

type SortOption = 'fecha_asc' | 'fecha_desc' | 'monto_desc' | 'monto_asc' | 'cliente' | 'cobranza';

const SORT_LABELS: Record<SortOption, string> = {
  fecha_asc: 'Fecha (más antigua)',
  fecha_desc: 'Fecha (más reciente)',
  monto_desc: 'Monto (mayor a menor)',
  monto_asc: 'Monto (menor a mayor)',
  cliente: 'Cliente A-Z',
  cobranza: 'Cobranza (% cobrado)',
};

interface Vendedor {
  id: number;
  nombre: string;
  email: string;
  comision: number;
}

interface ChequeRef {
  id: number;
  tipo: string;
  numero: string;
  banco: string | null;
  titular: string | null;
  importe: number;
  fechaVencimiento: string | null;
  estado: string;
}

interface PaymentAllocationRef {
  id: number;
  montoAplicado: number;
  fechaAplicacion: string;
  payment: {
    id: number;
    numero: string;
    fechaPago: string;
    estado: string;
    efectivo: number;
    transferencia: number;
    chequesTerceros: number;
    chequesPropios: number;
    tarjetaCredito: number;
    tarjetaDebito: number;
    bancoOrigen: string | null;
    numeroOperacion: string | null;
    notas: string | null;
    cheques: ChequeRef[];
  };
}

interface InvoiceRef {
  id: string;
  numeroCompleto: string | null;
  estado: string;
  total: number;
  saldoPendiente: number | null;
  fechaEmision?: string | null;
  fechaVencimiento?: string | null;
  netoGravado?: number | null;
  iva21?: number | null;
  iva105?: number | null;
  condicionesPago?: string | null;
  paymentAllocations?: PaymentAllocationRef[];
}

interface VentaDisponible {
  id: number;
  numero: string;
  estado: string;
  fechaEmision: string;
  total: number;
  baseComision: number;
  disponible: boolean;
  liquidacionExistente: { id: number; numero: string } | null;
  client: { id: string; legalName: string };
  quote: { fechaEnvio?: string | null } | null;
  fechaEntregaEstimada?: string | null;
  fechaEntregaReal?: string | null;
  condicionesPago?: string | null;
  diasPlazo?: number | null;
  lugarEntrega?: string | null;
  notas?: string | null;
  items: Array<{
    id: number;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    aplicaComision: boolean;
    costBreakdown: Array<{ concepto: string; monto: number }>;
  }>;
  invoices: InvoiceRef[];
  cobranza: {
    totalFacturado: number;
    cobrado: number;
    saldoPendiente: number;
    porcentajeCobrado: number;
  };
}

function getCobranzaBadge(cobranza: VentaDisponible['cobranza'], invoices: InvoiceRef[]): { label: string; color: string } {
  if (invoices.length === 0) return { label: 'Sin factura', color: '#94a3b8' };
  const pct = cobranza.porcentajeCobrado;
  if (pct >= 100) return { label: 'Cobrada', color: '#10b981' };
  if (pct > 0) return { label: `Parcial ${Math.round(pct)}%`, color: '#f59e0b' };
  return { label: 'Emitida', color: '#3b82f6' };
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Vendedor y Periodo' },
    { num: 2, label: 'Seleccionar Ventas' },
    { num: 3, label: 'Resumen' },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors',
                currentStep >= step.num
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'bg-background border-muted-foreground/30 text-muted-foreground'
              )}
            >
              {currentStep > step.num ? <CheckCircle className="w-4 h-4" /> : step.num}
            </div>
            <span className={cn(
              'text-xs mt-1',
              currentStep >= step.num ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-20 mx-2 mb-5',
                currentStep > step.num ? 'bg-primary' : 'bg-muted-foreground/20'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function NuevaLiquidacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSellerId = searchParams.get('sellerId') || '';

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [sellerId, setSellerId] = useState(initialSellerId);
  const [fechaDesde, setFechaDesde] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().slice(0, 10));
  const [comision, setComision] = useState('');

  // Step 2
  const [ventas, setVentas] = useState<VentaDisponible[]>([]);
  const [selectedSales, setSelectedSales] = useState<Set<number>>(new Set());
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [currentVentaIndex, setCurrentVentaIndex] = useState<number>(0);
  const [clienteFilter, setClienteFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('fecha_asc');
  const [filterCobranza, setFilterCobranza] = useState<'all' | 'cobrada' | 'parcial' | 'sin_cobrar'>('all');
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  // Step 3
  const [notas, setNotas] = useState('');
  const [ajustes, setAjustes] = useState('0');

  // Load vendedores
  useEffect(() => {
    fetch('/api/ventas/vendedores', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setVendedores(d.data || []);
        if (initialSellerId) {
          const v = (d.data || []).find((v: Vendedor) => v.id === parseInt(initialSellerId));
          if (v) setComision(String(v.comision));
        }
      })
      .catch(() => toast.error('Error al cargar vendedores'));
  }, []);

  const handleSellerChange = (val: string) => {
    setSellerId(val);
    const v = vendedores.find((v) => v.id === parseInt(val));
    if (v) setComision(String(v.comision));
  };

  const setDateRange = (preset: '30d' | '90d' | 'year') => {
    const today = new Date();
    const hasta = today.toISOString().slice(0, 10);
    let desde: string;
    if (preset === '30d') {
      desde = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else if (preset === '90d') {
      desde = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else {
      desde = `${today.getFullYear()}-01-01`;
    }
    setFechaDesde(desde);
    setFechaHasta(hasta);
  };

  const loadVentas = async () => {
    if (!sellerId || !fechaDesde || !fechaHasta) return;
    try {
      setLoadingVentas(true);
      const params = new URLSearchParams({ sellerId, fechaDesde, fechaHasta });
      const res = await fetch(`/api/ventas/liquidaciones/ventas-disponibles?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVentas(data.ventas || []);
      setCurrentVentaIndex(0);
      setClienteFilter('');
      setSortBy('fecha_asc');
      setExpandedInvoices(new Set());
      const avail = (data.ventas || []).filter((v: VentaDisponible) => v.disponible);
      setSelectedSales(new Set(avail.map((v: VentaDisponible) => v.id)));
    } catch {
      toast.error('Error al cargar ventas');
    } finally {
      setLoadingVentas(false);
    }
  };

  const goToStep2 = () => {
    if (!sellerId) {
      toast.error('Seleccioná un vendedor');
      return;
    }
    setStep(2);
    loadVentas();
  };

  const toggleSale = (id: number) => {
    setSelectedSales((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllSales = () => {
    const available = ventas.filter((v) => v.disponible);
    if (selectedSales.size === available.length) {
      setSelectedSales(new Set());
    } else {
      setSelectedSales(new Set(available.map((v) => v.id)));
    }
  };

  const toggleInvoice = (invId: string) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      next.has(invId) ? next.delete(invId) : next.add(invId);
      return next;
    });
  };

  // Computed
  const selectedVentas = ventas.filter((v) => selectedSales.has(v.id));
  const totalVentas = selectedVentas.reduce((sum, v) => sum + v.total, 0);
  const baseComisionTotal = selectedVentas.reduce((sum, v) => sum + (v.baseComision ?? v.total), 0);
  const hayItemsSinComision = baseComisionTotal < totalVentas;
  const comisionPct = parseFloat(comision) || 0;
  const totalComisiones = baseComisionTotal * (comisionPct / 100);
  const ajustesMonto = parseFloat(ajustes) || 0;
  const totalLiquidacion = totalComisiones + ajustesMonto;
  const available = ventas.filter(v => v.disponible);
  const ventasConSaldoPendiente = selectedVentas.filter((v) => v.cobranza.saldoPendiente > 0);
  const currentVenta = ventas[currentVentaIndex] ?? null;

  // Cobranza global (Step 3)
  const cobranzaGlobal = useMemo(() => {
    const totalFacturado = selectedVentas.reduce((s, v) => s + v.cobranza.totalFacturado, 0);
    const cobrado = selectedVentas.reduce((s, v) => s + v.cobranza.cobrado, 0);
    const saldoPendiente = selectedVentas.reduce((s, v) => s + v.cobranza.saldoPendiente, 0);
    const pct = totalFacturado > 0 ? Math.min(100, (cobrado / totalFacturado) * 100) : 0;
    return { totalFacturado, cobrado, saldoPendiente, pct };
  }, [selectedVentas]);

  // Sorted + filtered ventas (Step 2)
  const sortedVentas = useMemo(() => {
    let filtered = clienteFilter.trim()
      ? ventas.filter(v => v.client.legalName.toLowerCase().includes(clienteFilter.toLowerCase()))
      : ventas;
    if (filterCobranza !== 'all') {
      filtered = filtered.filter(v => {
        const pct = v.cobranza.porcentajeCobrado;
        if (filterCobranza === 'cobrada') return pct >= 100;
        if (filterCobranza === 'parcial') return pct > 0 && pct < 100;
        if (filterCobranza === 'sin_cobrar') return pct === 0;
        return true;
      });
    }
    const arr = [...filtered];
    switch (sortBy) {
      case 'fecha_asc': return arr.sort((a, b) => new Date(a.fechaEmision).getTime() - new Date(b.fechaEmision).getTime());
      case 'fecha_desc': return arr.sort((a, b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime());
      case 'monto_desc': return arr.sort((a, b) => b.total - a.total);
      case 'monto_asc': return arr.sort((a, b) => a.total - b.total);
      case 'cliente': return arr.sort((a, b) => a.client.legalName.localeCompare(b.client.legalName));
      case 'cobranza': return arr.sort((a, b) => b.cobranza.porcentajeCobrado - a.cobranza.porcentajeCobrado);
      default: return arr;
    }
  }, [ventas, clienteFilter, sortBy, filterCobranza]);

  const handleSave = async (confirmar: boolean) => {
    try {
      setSaving(true);
      const items = ventas.map((v) => ({
        saleId: v.id,
        incluido: selectedSales.has(v.id),
        motivoExclusion: !selectedSales.has(v.id) ? 'Excluida manualmente' : undefined,
      }));

      const body = {
        sellerId: parseInt(sellerId),
        fechaDesde,
        fechaHasta,
        comisionPorcentaje: comisionPct,
        ajustes: ajustesMonto,
        notas: notas || undefined,
        items,
      };

      const res = await fetch('/api/ventas/liquidaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }

      const liq = await res.json();

      if (confirmar) {
        await fetch(`/api/ventas/liquidaciones/${liq.id}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'confirmar' }),
        });
        toast.success('Liquidación creada y confirmada');
      } else {
        toast.success('Liquidación guardada como borrador');
      }

      router.push(`/administracion/ventas/liquidaciones/${liq.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Error al crear la liquidación');
    } finally {
      setSaving(false);
    }
  };

  const selectedVendedor = vendedores.find((v) => v.id === parseInt(sellerId));

  return (
    <div className={cn("container mx-auto py-6 space-y-6", step === 2 ? "max-w-none" : "max-w-3xl")}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nueva Liquidación</h1>
          <p className="text-sm text-muted-foreground">Paso {step} de 3</p>
        </div>
      </div>

      <StepIndicator currentStep={step} />

      {/* ──── STEP 1: Vendedor y Periodo ──── */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Vendedor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={sellerId} onValueChange={handleSellerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vendedor..." />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.nombre} ({v.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Mini-profile card cuando hay vendedor seleccionado */}
              {selectedVendedor && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {selectedVendedor.nombre.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{selectedVendedor.nombre}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{selectedVendedor.email}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Comisión base</p>
                    <p className="text-lg font-bold text-violet-600">{selectedVendedor.comision}%</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Periodo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Atajos de rango */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setDateRange('30d')}>
                  Último mes
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setDateRange('90d')}>
                  Últimos 3 meses
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setDateRange('year')}>
                  Este año
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Desde *</Label>
                  <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Hasta *</Label>
                  <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                </div>
              </div>

              {fechaDesde && fechaHasta && (
                <p className="text-xs text-muted-foreground">
                  Período de{' '}
                  <span className="font-medium text-foreground">
                    {format(new Date(fechaDesde), "dd 'de' MMM", { locale: es })}
                  </span>
                  {' '}al{' '}
                  <span className="font-medium text-foreground">
                    {format(new Date(fechaHasta), "dd 'de' MMMM yyyy", { locale: es })}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Comisión
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  step="0.1"
                  value={comision}
                  onChange={(e) => setComision(e.target.value)}
                  placeholder="0.0"
                  className="w-32 text-center text-lg font-bold"
                />
                <span className="text-muted-foreground text-lg">%</span>
                {selectedVendedor && comision !== String(selectedVendedor.comision) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setComision(String(selectedVendedor.comision))}
                  >
                    Restaurar ({selectedVendedor.comision}%)
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Se pre-carga del perfil del vendedor. Podés ajustar manualmente.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={goToStep2} disabled={!sellerId}>
              Siguiente
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ──── STEP 2: Seleccionar Ventas ──── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Subheader */}
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">Seleccionar Ventas</h2>
                {selectedVendedor && (
                  <Badge variant="secondary">{selectedVendedor.nombre}</Badge>
                )}
                {comisionPct > 0 && (
                  <Badge variant="outline" className="text-violet-600 border-violet-200">
                    Comisión {comisionPct}%
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(fechaDesde), 'dd/MM/yyyy', { locale: es })} al{' '}
                {format(new Date(fechaHasta), 'dd/MM/yyyy', { locale: es })} · {available.length} disponibles · {ventas.length} totales
              </p>
            </div>
          </div>

          <div>
            {loadingVentas ? (
              <div className="flex rounded-xl border overflow-hidden h-[calc(100vh-340px)] min-h-[480px]">
                <div className="w-80 flex-shrink-0 border-r p-4 space-y-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
                <div className="flex-1 p-6">
                  <Skeleton className="h-full w-full rounded-lg" />
                </div>
              </div>
            ) : ventas.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border text-center h-[calc(100vh-340px)] min-h-[480px]">
                <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <ShoppingCart className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Sin ventas en el periodo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No se encontraron ventas para este vendedor en el rango seleccionado
                </p>
              </div>
            ) : (
              <div className="flex rounded-xl border overflow-hidden h-[calc(100vh-340px)] min-h-[480px]">

                {/* ─── PANEL IZQUIERDO: Lista OVs (w-1/5) ─── */}
                <div className="w-1/5 flex-shrink-0 flex flex-col border-r">
                  {/* Búsqueda + Sort */}
                  <div className="p-2 border-b space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        className="pl-7 h-8 text-xs"
                        placeholder="Buscar cliente..."
                        value={clienteFilter}
                        onChange={(e) => setClienteFilter(e.target.value)}
                      />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-between text-xs h-7">
                          <div className="flex items-center gap-1">
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[90px]">{SORT_LABELS[sortBy]}</span>
                          </div>
                          <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                          <DropdownMenuItem
                            key={opt}
                            onClick={() => setSortBy(opt)}
                            className={cn('text-xs', sortBy === opt && 'font-medium text-primary')}
                          >
                            {sortBy === opt && <span className="mr-2">✓</span>}
                            {SORT_LABELS[opt]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* Filtro cobranza */}
                    <div className="flex rounded-md border overflow-hidden text-xs h-7">
                      {([
                        { key: 'all', label: 'Todas' },
                        { key: 'cobrada', label: '✓ Cob.' },
                        { key: 'parcial', label: 'Parcial' },
                        { key: 'sin_cobrar', label: 'Sin cob.' },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setFilterCobranza(key)}
                          className={cn(
                            'flex-1 px-1 text-center transition-colors border-r last:border-r-0',
                            filterCobranza === key
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'hover:bg-muted text-muted-foreground'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stats: Incluidas | Total */}
                  <div className="grid grid-cols-2 divide-x border-b bg-muted/20">
                    <div className="px-2 py-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Incluidas</p>
                      <p className="text-sm font-bold tabular-nums">
                        {selectedSales.size}
                        <span className="text-xs font-normal text-muted-foreground">/{available.length}</span>
                      </p>
                    </div>
                    <div className="px-2 py-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Total</p>
                      <p className="text-xs font-bold tabular-nums text-success-muted-foreground truncate">{formatCurrency(totalVentas)}</p>
                    </div>
                  </div>

                  {/* Lista OVs */}
                  <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                    {sortedVentas.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-8">Sin resultados</p>
                    ) : (
                      sortedVentas.map((venta) => {
                        const actualIdx = ventas.indexOf(venta);
                        const isActive = currentVentaIndex === actualIdx;
                        const cob = getCobranzaBadge(venta.cobranza, venta.invoices);
                        const estadoColor = OV_ESTADO_COLOR[venta.estado] || '#94a3b8';
                        return (
                          <div
                            key={venta.id}
                            className={cn(
                              'px-2 py-2 cursor-pointer hover:bg-muted/40 transition-colors flex gap-2 items-start',
                              isActive ? 'bg-primary/5 border-l-[3px] border-primary pl-1.5' : 'border-l-[3px] border-transparent',
                              !venta.disponible && 'opacity-60'
                            )}
                            onClick={() => setCurrentVentaIndex(actualIdx)}
                          >
                            <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0 mt-0.5">
                              <Checkbox
                                checked={selectedSales.has(venta.id)}
                                disabled={!venta.disponible}
                                onCheckedChange={() => toggleSale(venta.id)}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center gap-1">
                                <span className={cn("font-mono text-xs font-semibold truncate", isActive && "text-primary")}>
                                  {venta.numero}
                                </span>
                                <span className="text-[9px] text-muted-foreground flex-shrink-0">
                                  {format(new Date(venta.fechaEmision), 'dd/MM/yy', { locale: es })}
                                </span>
                              </div>
                              <p className="text-xs truncate text-muted-foreground">{venta.client.legalName}</p>
                              <div className="flex items-center justify-between mt-0.5 gap-1">
                                <span className="text-xs tabular-nums font-bold truncate">{formatCurrency(venta.total)}</span>
                                <span
                                  className="text-[8px] px-1 py-0.5 rounded-full font-semibold flex-shrink-0"
                                  style={{ backgroundColor: `${estadoColor}20`, color: estadoColor }}
                                >
                                  {venta.estado}
                                </span>
                              </div>
                              {venta.baseComision !== undefined && venta.baseComision < venta.total && (
                                <p className="text-[9px] text-amber-600 dark:text-amber-400 tabular-nums">
                                  Base com.: {formatCurrency(venta.baseComision)}
                                </p>
                              )}
                              {venta.invoices.length > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{ width: `${Math.min(100, venta.cobranza.porcentajeCobrado)}%`, backgroundColor: cob.color }}
                                    />
                                  </div>
                                  <span className="text-[9px] text-muted-foreground flex-shrink-0 flex items-center gap-0.5">
                                    {venta.invoices.length} fac
                                    {venta.cobranza.saldoPendiente > 0 && (
                                      <AlertTriangle className="inline w-2.5 h-2.5 text-amber-500" />
                                    )}
                                  </span>
                                </div>
                              )}
                              {!venta.disponible && (
                                <span className="text-[9px] text-muted-foreground/60">· Liq.</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Resumen sticky */}
                  <div className="border-t bg-muted/30 px-3 py-2 flex-shrink-0 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">OVs incluidas</span>
                      <span className="font-bold tabular-nums">{selectedSales.size}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-bold tabular-nums text-success-muted-foreground">{formatCurrency(totalVentas)}</span>
                    </div>
                    {hayItemsSinComision && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-amber-600 dark:text-amber-400">Base comisión</span>
                        <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(baseComisionTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Comisión ({comisionPct}%)</span>
                      <span className="font-bold tabular-nums text-violet-600">{formatCurrency(totalComisiones)}</span>
                    </div>
                  </div>

                  {/* Incluir/quitar todas */}
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={toggleAllSales}>
                      {selectedSales.size === available.length ? 'Quitar todas' : 'Incluir todas'}
                    </Button>
                  </div>
                </div>

                {/* ─── PANEL CENTRAL: Documento OV (flex-1) ─── */}
                <div className="flex-1 overflow-y-auto bg-muted/20">
                  {currentVenta ? (
                    <div className="p-4 space-y-3">

                      {/* Documento OV estilo presupuesto */}
                      <div className="bg-card shadow-sm border rounded-lg overflow-hidden">
                        {/* Strip de color */}
                        <div className="h-1.5 w-full" style={{ backgroundColor: OV_ESTADO_COLOR[currentVenta.estado] || '#6366f1' }} />

                        <div className="p-6">
                          {/* Header del documento */}
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <ShoppingCart className="h-10 w-10 text-muted-foreground/20" />
                            </div>
                            <div className="text-right">
                              <h1 className="text-xl font-black uppercase tracking-wide">Orden de Venta</h1>
                              <p className="text-xs text-muted-foreground font-mono mt-1">{currentVenta.numero}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Fecha: {format(new Date(currentVenta.fechaEmision), 'dd/MM/yyyy', { locale: es })}
                              </p>
                              {currentVenta.fechaEntregaEstimada && (
                                <p className="text-xs text-muted-foreground">
                                  Entrega est.: {format(new Date(currentVenta.fechaEntregaEstimada), 'dd/MM/yyyy', { locale: es })}
                                </p>
                              )}
                              {currentVenta.fechaEntregaReal && (
                                <p className="text-xs text-success-muted-foreground font-medium">
                                  Entregada: {format(new Date(currentVenta.fechaEntregaReal), 'dd/MM/yyyy', { locale: es })}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Cliente */}
                          <div className="border-t-2 border-b-2 border-foreground/80 py-3 my-4">
                            <p className="font-semibold text-lg text-center">{currentVenta.client.legalName}</p>
                            {currentVenta.condicionesPago && (
                              <p className="text-xs text-muted-foreground text-center mt-0.5">{currentVenta.condicionesPago}</p>
                            )}
                            {currentVenta.lugarEntrega && (
                              <p className="text-xs text-muted-foreground text-center mt-0.5">
                                <MapPin className="inline w-3 h-3 mr-0.5" />{currentVenta.lugarEntrega}
                              </p>
                            )}
                          </div>

                          {/* Tabla de items */}
                          <table className="w-full text-sm mb-6">
                            <thead>
                              <tr className="border-b-2 border-foreground/80">
                                <th className="text-left pb-2 font-bold uppercase text-xs">Descripción</th>
                                <th className="text-right pb-2 font-bold uppercase text-xs w-16">Cant.</th>
                                <th className="text-right pb-2 font-bold uppercase text-xs w-28">Unitario</th>
                                <th className="text-right pb-2 font-bold uppercase text-xs w-28">Importe</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentVenta.items.map((item, i) => (
                                <tr key={item.id} className={cn('border-b border-muted/60', i % 2 !== 0 && 'bg-muted/20')}>
                                  <td className="py-2 align-top">
                                    <p className="font-medium">{item.descripcion}</p>
                                    {item.costBreakdown && item.costBreakdown.length > 0 && (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                        {item.costBreakdown.map(cb => (
                                          <span key={cb.id} className="text-xs text-muted-foreground">
                                            {cb.concepto}: <span className="tabular-nums font-medium">{formatCurrency(Number(cb.monto))}</span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 text-right tabular-nums align-top">{Number(item.cantidad)}</td>
                                  <td className="py-2 text-right tabular-nums align-top">{formatCurrency(Number(item.precioUnitario))}</td>
                                  <td className="py-2 text-right tabular-nums font-semibold align-top">{formatCurrency(Number(item.subtotal))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Footer: observaciones + totales */}
                          <div className="flex gap-8 border-t-2 border-foreground/80 pt-4">
                            <div className="flex-1">
                              {currentVenta.notas ? (
                                <>
                                  <p className="text-xs font-bold uppercase mb-1">Observaciones:</p>
                                  <p className="text-xs text-muted-foreground">{currentVenta.notas}</p>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">Sin observaciones</p>
                              )}
                            </div>
                            <div className="text-right space-y-1 min-w-[200px]">
                              <div className="flex justify-between text-sm gap-6">
                                <span className="font-semibold uppercase text-xs">Subtotal:</span>
                                <span className="tabular-nums">{formatCurrency(currentVenta.total)}</span>
                              </div>
                              <div className="flex justify-between text-sm gap-6">
                                <span className="font-semibold uppercase text-xs">I.V.A.:</span>
                                <span className="tabular-nums">$ 0,00</span>
                              </div>
                              <div className="flex justify-between font-black text-base border-t border-foreground/80 pt-1 gap-6">
                                <span className="uppercase text-sm">Total:</span>
                                <span className="tabular-nums">{formatCurrency(currentVenta.total)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Facturas */}
                      {currentVenta.invoices.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                            Facturas ({currentVenta.invoices.length})
                          </p>
                          {currentVenta.invoices.map((inv) => {
                            const colors = INVOICE_ESTADO_COLORS[inv.estado] || INVOICE_ESTADO_COLORS.BORRADOR;
                            const isExpanded = expandedInvoices.has(inv.id);
                            const cobradoInv = Number(inv.total) - Number(inv.saldoPendiente || 0);
                            const pctInv = Number(inv.total) > 0 ? Math.min(100, (cobradoInv / Number(inv.total)) * 100) : 0;
                            const isVencida = inv.fechaVencimiento && new Date(inv.fechaVencimiento) < new Date() && Number(inv.saldoPendiente || 0) > 0;
                            return (
                              <div key={inv.id} className="rounded-lg overflow-hidden border shadow-sm">

                                {/* ── HEADER CLICKEABLE ── */}
                                <button
                                  className="w-full text-left transition-opacity hover:opacity-90"
                                  onClick={() => toggleInvoice(inv.id)}
                                >
                                  {/* Franja superior de color */}
                                  <div className="h-1" style={{ backgroundColor: colors.text }} />

                                  {/* Cuerpo del header con fondo tintado */}
                                  <div className="px-4 pt-3 pb-2" style={{ backgroundColor: colors.bg }}>
                                    <div className="flex items-start justify-between gap-3">
                                      {/* Izquierda: número + fecha */}
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <ReceiptText size={12} style={{ color: colors.text }} className="flex-shrink-0" />
                                          <span className="font-mono text-[13px] font-black tracking-tight" style={{ color: colors.text }}>
                                            {inv.numeroCompleto || `Factura #${inv.id}`}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          {inv.fechaEmision && (
                                            <span className="flex items-center gap-1">
                                              <Calendar className="w-2.5 h-2.5" />
                                              {format(new Date(inv.fechaEmision), 'dd MMM yyyy', { locale: es })}
                                            </span>
                                          )}
                                          {isVencida && (
                                            <span className="text-red-500 font-bold">· VENCIDA</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Derecha: total + estado + chevron */}
                                      <div className="text-right flex-shrink-0">
                                        <p className="text-base font-black tabular-nums leading-tight" style={{ color: colors.text }}>
                                          {formatCurrency(Number(inv.total))}
                                        </p>
                                        <div className="flex items-center gap-1 justify-end mt-0.5">
                                          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: colors.text }}>
                                            {colors.label}
                                          </span>
                                          <ChevronDown
                                            className={cn('w-3 h-3 flex-shrink-0 transition-transform duration-200', isExpanded && 'rotate-180')}
                                            style={{ color: colors.text }}
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Barra de progreso de cobranza — siempre visible en el header */}
                                    <div className="mt-2.5">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] text-muted-foreground">{pctInv < 100 ? `${Math.round(pctInv)}% cobrado` : 'Totalmente cobrada'}</span>
                                        {Number(inv.saldoPendiente || 0) > 0 && (
                                          <span className="text-[9px] font-medium text-amber-600">Saldo {formatCurrency(Number(inv.saldoPendiente))}</span>
                                        )}
                                      </div>
                                      <div className="h-2 w-full bg-black/10 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctInv}%`, backgroundColor: colors.text }} />
                                      </div>
                                    </div>
                                  </div>
                                </button>

                                {/* Detalle expandible */}
                                {isExpanded && (
                                  <div className="bg-card">
                                    {/* ── LAYOUT 2 COLUMNAS: info | cobranza ── */}
                                    <div className="flex divide-x border-b">
                                      {/* Columna izq: datos de la factura */}
                                      <div className="flex-1 px-4 py-3 space-y-2">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Datos</p>
                                        <div className="space-y-1.5">
                                          {inv.fechaEmision && (
                                            <div className="flex items-center gap-2 text-xs">
                                              <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                              <span className="text-muted-foreground w-16 flex-shrink-0">Emitida</span>
                                              <span className="font-medium">{format(new Date(inv.fechaEmision), 'dd MMM yyyy', { locale: es })}</span>
                                            </div>
                                          )}
                                          {inv.fechaVencimiento && (
                                            <div className="flex items-center gap-2 text-xs">
                                              <Clock className="w-3 h-3 flex-shrink-0" style={{ color: isVencida ? '#ef4444' : undefined }} />
                                              <span className={cn('w-16 flex-shrink-0', isVencida ? 'text-red-500 font-bold' : 'text-muted-foreground')}>Vence</span>
                                              <span className={cn('font-medium', isVencida && 'text-red-500')}>{format(new Date(inv.fechaVencimiento), 'dd MMM yyyy', { locale: es })}</span>
                                            </div>
                                          )}
                                          {inv.condicionesPago && (
                                            <div className="flex items-center gap-2 text-xs">
                                              <CreditCard className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                              <span className="text-muted-foreground w-16 flex-shrink-0">Condición</span>
                                              <span className="font-medium truncate">{inv.condicionesPago}</span>
                                            </div>
                                          )}
                                        </div>
                                        {/* IVA breakdown */}
                                        {inv.netoGravado && Number(inv.netoGravado) > 0 && (
                                          <div className="pt-2 border-t space-y-1">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Impuestos</p>
                                            <div className="flex items-center justify-between text-xs">
                                              <span className="text-muted-foreground">Neto gravado</span>
                                              <span className="font-medium tabular-nums">{formatCurrency(Number(inv.netoGravado))}</span>
                                            </div>
                                            {inv.iva21 && Number(inv.iva21) > 0 && (
                                              <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">IVA 21%</span>
                                                <span className="font-medium tabular-nums">{formatCurrency(Number(inv.iva21))}</span>
                                              </div>
                                            )}
                                            {inv.iva105 && Number(inv.iva105) > 0 && (
                                              <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">IVA 10.5%</span>
                                                <span className="font-medium tabular-nums">{formatCurrency(Number(inv.iva105))}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Columna der: estado de cobranza */}
                                      <div className="w-36 flex-shrink-0 px-3 py-3 flex flex-col items-center justify-center text-center" style={{ backgroundColor: `${colors.text}08` }}>
                                        <div className="text-2xl font-black tabular-nums leading-none mb-0.5" style={{ color: colors.text }}>
                                          {Math.round(pctInv)}%
                                        </div>
                                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-3">cobrado</p>
                                        <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden mb-3">
                                          <div className="h-full rounded-full" style={{ width: `${pctInv}%`, backgroundColor: colors.text }} />
                                        </div>
                                        <div className="w-full space-y-1 text-left">
                                          <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Total</span>
                                            <span className="font-bold tabular-nums">{formatCurrency(Number(inv.total))}</span>
                                          </div>
                                          <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Cobrado</span>
                                            <span className="font-bold tabular-nums" style={{ color: colors.text }}>{formatCurrency(cobradoInv)}</span>
                                          </div>
                                          {Number(inv.saldoPendiente || 0) > 0 && (
                                            <div className="flex justify-between text-xs">
                                              <span className="text-amber-600">Saldo</span>
                                              <span className="font-bold tabular-nums text-amber-600">{formatCurrency(Number(inv.saldoPendiente))}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Historial de pagos */}
                                    {/* ── TIMELINE DE PAGOS ── */}
                                    <div className="border-t">
                                      <div className="px-4 py-2.5 flex items-center justify-between border-b bg-muted/20">
                                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pagos</span>
                                        {inv.paymentAllocations && inv.paymentAllocations.length > 0 && (
                                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${colors.text}15`, color: colors.text }}>
                                            {inv.paymentAllocations.length} {inv.paymentAllocations.length === 1 ? 'cobro' : 'cobros'}
                                          </span>
                                        )}
                                      </div>

                                      {inv.paymentAllocations && inv.paymentAllocations.length > 0 ? (
                                        <div className="px-4 py-3">
                                          {/* Línea de timeline */}
                                          <div className="relative">
                                            {/* Línea vertical conectora */}
                                            {inv.paymentAllocations.length > 1 && (
                                              <div className="absolute left-[7px] top-4 bottom-4 w-px bg-muted" />
                                            )}
                                            <div className="space-y-4">
                                              {inv.paymentAllocations.map((alloc) => {
                                                const p = alloc.payment;
                                                const PAGO_ESTADO_COLOR: Record<string, string> = {
                                                  CONFIRMADO: '#10b981', PENDIENTE: '#f59e0b', RECHAZADO: '#ef4444', ANULADO: '#94a3b8',
                                                };
                                                const estadoColor = PAGO_ESTADO_COLOR[p.estado] || '#94a3b8';
                                                const CHEQUE_COLOR: Record<string, string> = {
                                                  COBRADO: '#10b981', DEPOSITADO: '#3b82f6', CARTERA: '#f59e0b',
                                                  RECHAZADO: '#ef4444', ENDOSADO: '#8b5cf6', ANULADO: '#94a3b8',
                                                };

                                                // Construir línea de descripción de medios
                                                const medioParts: string[] = [];
                                                if (Number(p.efectivo) > 0) medioParts.push(`Efectivo ${formatCurrency(Number(p.efectivo))}`);
                                                if (Number(p.transferencia) > 0) {
                                                  let t = `Transf. ${formatCurrency(Number(p.transferencia))}`;
                                                  if (p.bancoOrigen) t += ` · ${p.bancoOrigen}`;
                                                  if (p.numeroOperacion) t += ` · ${p.numeroOperacion}`;
                                                  medioParts.push(t);
                                                }
                                                if (Number(p.tarjetaCredito) > 0) medioParts.push(`Tarjeta cred. ${formatCurrency(Number(p.tarjetaCredito))}`);
                                                if (Number(p.tarjetaDebito) > 0) medioParts.push(`Tarjeta déb. ${formatCurrency(Number(p.tarjetaDebito))}`);
                                                if (p.cheques && p.cheques.length > 0) {
                                                  p.cheques.forEach(ch => {
                                                    medioParts.push(`${ch.tipo === 'PROPIO' ? 'Ch. propio' : 'Ch. 3ro'} ${formatCurrency(Number(ch.importe))}`);
                                                  });
                                                }

                                                return (
                                                  <div key={alloc.id} className="flex gap-3">
                                                    {/* Dot del timeline */}
                                                    <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 border-white mt-0.5 relative z-10 shadow-sm"
                                                         style={{ backgroundColor: estadoColor }} />

                                                    {/* Contenido del evento */}
                                                    <div className="flex-1 min-w-0 -mt-0.5">
                                                      {/* Fila principal: fecha · número · monto */}
                                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className="text-xs text-muted-foreground tabular-nums">
                                                          {format(new Date(p.fechaPago), 'dd MMM yyyy', { locale: es })}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground/50">·</span>
                                                        <span className="text-xs font-mono text-muted-foreground">{p.numero}</span>
                                                        <span className="ml-auto text-xs font-black tabular-nums flex-shrink-0" style={{ color: estadoColor }}>
                                                          {formatCurrency(Number(alloc.montoAplicado))}
                                                        </span>
                                                      </div>

                                                      {/* Medios en texto compacto */}
                                                      {medioParts.length > 0 && (
                                                        <p className="text-xs text-foreground font-medium leading-relaxed">
                                                          {medioParts.join('  ·  ')}
                                                        </p>
                                                      )}

                                                      {/* Cheques expandidos (solo si hay) */}
                                                      {p.cheques && p.cheques.length > 0 && (
                                                        <div className="mt-1.5 space-y-1">
                                                          {p.cheques.map(ch => {
                                                            const chColor = CHEQUE_COLOR[ch.estado] || '#94a3b8';
                                                            return (
                                                              <div key={ch.id} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 border text-xs" style={{ backgroundColor: `${chColor}06`, borderColor: `${chColor}30` }}>
                                                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: chColor }} />
                                                                <span className="font-bold font-mono" style={{ color: chColor }}>#{ch.numero}</span>
                                                                <span className="text-muted-foreground">{ch.banco}</span>
                                                                {ch.titular && <span className="text-muted-foreground">· {ch.titular}</span>}
                                                                <span className="ml-auto font-bold tabular-nums flex-shrink-0">{formatCurrency(Number(ch.importe))}</span>
                                                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${chColor}20`, color: chColor }}>{ch.estado}</span>
                                                              </div>
                                                            );
                                                          })}
                                                        </div>
                                                      )}

                                                      {/* Notas */}
                                                      {p.notas && (
                                                        <p className="text-xs text-muted-foreground italic mt-1">{p.notas}</p>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
                                          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                          {cobradoInv > 0
                                            ? `Cobrado ${formatCurrency(cobradoInv)} · sin detalle de imputaciones`
                                            : 'Sin pagos registrados'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      <div className="text-center">
                        <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p>Seleccioná una OV de la lista</p>
                      </div>
                    </div>
                  )}
                </div>


              </div>
            )}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>
            <Button onClick={() => setStep(3)} disabled={selectedSales.size === 0}>
              Siguiente
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ──── STEP 3: Resumen ──── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Vendedor + periodo info */}
          <div className="flex items-center gap-3 px-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">{selectedVendedor?.nombre.charAt(0)}</span>
            </div>
            <div>
              <span className="font-medium">{selectedVendedor?.nombre}</span>
              <span className="text-muted-foreground mx-2">·</span>
              <span className="text-sm text-muted-foreground">
                {format(new Date(fechaDesde), 'dd/MM', { locale: es })} – {format(new Date(fechaHasta), 'dd/MM/yyyy', { locale: es })}
              </span>
            </div>
          </div>

          {/* ZONA 1 — KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Ventas</p>
                    <p className="text-xl font-bold tabular-nums mt-1">{formatCurrency(totalVentas)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedSales.size} venta{selectedSales.size !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Comisión ({comisionPct}%)</p>
                    <p className="text-xl font-bold tabular-nums mt-1 text-violet-600">{formatCurrency(totalComisiones)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hayItemsSinComision
                        ? `Sobre ${formatCurrency(baseComisionTotal)} base`
                        : selectedVendedor?.nombre}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <Percent className="h-4 w-4 text-violet-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Ajustes</p>
                    <Input
                      type="number"
                      value={ajustes}
                      onChange={(e) => setAjustes(e.target.value)}
                      className="h-8 mt-1 text-base font-bold px-2 border-0 bg-transparent focus-visible:ring-0 p-0 w-full tabular-nums"
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ajustesMonto !== 0
                        ? ajustesMonto > 0 ? '+ Bonus' : '− Descuento'
                        : 'Sin ajuste'}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 ml-2">
                    <BadgeDollarSign className="h-4 w-4 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-success/20 bg-success/5 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">A Pagar</p>
                    <p className="text-2xl font-bold tabular-nums mt-1 text-success-muted-foreground">
                      {formatCurrency(totalLiquidacion)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">comisión + ajustes</p>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                    <Wallet className="h-4 w-4 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ZONA 2 — Cobranza global */}
          {cobranzaGlobal.totalFacturado > 0 && (
            <Card className="border shadow-sm">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Cobranza Global de Ventas Incluidas
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${cobranzaGlobal.pct}%`,
                        backgroundColor: cobranzaGlobal.pct >= 100 ? '#10b981' : cobranzaGlobal.pct > 0 ? '#f59e0b' : '#3b82f6',
                      }}
                    />
                  </div>
                  <span className="text-sm font-mono text-muted-foreground flex-shrink-0">
                    {Math.round(cobranzaGlobal.pct)}% cobrado
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Facturado</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(cobranzaGlobal.totalFacturado)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cobrado</p>
                    <p className="font-semibold tabular-nums text-success-muted-foreground">{formatCurrency(cobranzaGlobal.cobrado)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                    <p className={cn('font-semibold tabular-nums', cobranzaGlobal.saldoPendiente > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                      {formatCurrency(cobranzaGlobal.saldoPendiente)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ZONA 3 — Tabla de ventas incluidas */}
          <Card className="border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
              <p className="text-sm font-medium">Ventas incluidas en la liquidación</p>
              <Badge variant="secondary" className="font-mono">{selectedVentas.length}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">N° Orden</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Base com.</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead>Cobranza</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedVentas.map(v => {
                  const cob = getCobranzaBadge(v.cobranza, v.invoices);
                  const baseVenta = v.baseComision ?? v.total;
                  const comisionVenta = baseVenta * comisionPct / 100;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="pl-4">
                        <span className="font-mono text-xs font-medium">{v.numero}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                        {v.client.legalName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(v.fechaEmision), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(v.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {baseVenta < v.total ? (
                          <span className="tabular-nums text-xs font-medium text-amber-600 dark:text-amber-400">
                            {formatCurrency(baseVenta)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">= total</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="tabular-nums text-sm font-semibold text-violet-600">
                          {formatCurrency(comisionVenta)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${cob.color}20`, color: cob.color }}
                        >
                          {cob.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {/* Footer totales */}
            <div className="flex justify-end gap-6 px-4 py-3 border-t bg-muted/20 text-sm flex-wrap">
              <div className="flex gap-2">
                <span className="text-muted-foreground">Total ventas:</span>
                <span className="font-semibold tabular-nums">{formatCurrency(totalVentas)}</span>
              </div>
              {hayItemsSinComision && (
                <>
                  <Separator orientation="vertical" className="h-5" />
                  <div className="flex gap-2">
                    <span className="text-amber-600 dark:text-amber-400">Base comisión:</span>
                    <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(baseComisionTotal)}</span>
                  </div>
                </>
              )}
              <Separator orientation="vertical" className="h-5" />
              <div className="flex gap-2">
                <span className="text-muted-foreground">Comisión total:</span>
                <span className="font-semibold tabular-nums text-violet-600">{formatCurrency(totalComisiones)}</span>
              </div>
            </div>
          </Card>

          {/* ZONA 4 — Alerta de saldo pendiente (detallada) */}
          {ventasConSaldoPendiente.length > 0 && (
            <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {ventasConSaldoPendiente.length} venta{ventasConSaldoPendiente.length !== 1 ? 's' : ''} con cobranza incompleta
                </span>
                <span className="ml-auto text-xs tabular-nums text-amber-600 font-semibold">
                  {formatCurrency(ventasConSaldoPendiente.reduce((s, v) => s + v.cobranza.saldoPendiente, 0))} total pendiente
                </span>
              </div>
              <div className="divide-y divide-amber-100 dark:divide-amber-900">
                {ventasConSaldoPendiente.map(v => (
                  <div key={v.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400 flex-shrink-0">
                      {v.numero}
                    </span>
                    <span className="text-muted-foreground flex-1 truncate">{v.client.legalName}</span>
                    <span className="tabular-nums text-amber-600 font-medium flex-shrink-0">
                      Saldo: {formatCurrency(v.cobranza.saldoPendiente)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ZONA 5 — Notas + Acciones */}
          <Card>
            <CardContent className="pt-6">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas adicionales sobre la liquidación..."
                className="mt-2"
                rows={3}
              />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Borrador'}
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving}>
                {saving ? 'Guardando...' : 'Confirmar y Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NuevaLiquidacionPage() {
  return (
    <PermissionGuard permission="ventas.liquidaciones.create">
      <Suspense fallback={<div className="container mx-auto py-6"><Skeleton className="h-96 w-full" /></div>}>
        <NuevaLiquidacionContent />
      </Suspense>
    </PermissionGuard>
  );
}
