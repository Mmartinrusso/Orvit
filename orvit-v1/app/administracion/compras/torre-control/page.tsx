'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  FileText,
  ClipboardList,
  Clock,
  AlertTriangle,
  DollarSign,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer,
  Receipt,
  Truck,
  Target,
  Activity,
  Zap,
  BarChart3,
  Boxes,
  ExternalLink,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';

interface DetalleItem {
  id: number;
  numero: string;
  proveedor: string;
  monto?: number;
  vencimiento?: string;
  fechaEntrega?: string;
  fecha?: string;
  oc?: string;
  items?: number;
  solicitante?: string;
  recepciones?: number;
  motivo?: string;
  nombre?: string;
  codigo?: string;
  stockMinimo?: number;
}

interface TorreControlData {
  recepciones: {
    sinConfirmar: number;
    sinFactura: number;
    porRegularizar: number;
    conDiferencias: number;
    calidadRechazada: number;
  };
  facturas: {
    matchBlocked: number;
    matchPending: number;
    matchWarning: number;
    porVencer7Dias: number;
    vencidas: number;
    duplicadasSospechosas: number;
    sinValidar: number;
    sinIngreso: number;
    matchSinResolver: number;
    montos?: {
      vencidas: number;
      porVencer: number;
    };
  };
  solicitudesNca: {
    nuevas: number;
    enviadas: number;
    esperandoRespuesta: number;
    ncaPorAplicar: number;
    ncaSinAplicar7Dias: number;
  };
  prontoPago: {
    disponibleHoy: number;
    venceEn3Dias: number;
    venceEn7Dias: number;
    vencido: number;
  };
  ordenesCompra: {
    pendienteEntrega: number;
    parcialmenteRecibidas: number;
    atrasadas: number;
    sinRecepcionMas15Dias: number;
    pendientesAprobacion: number;
  };
  pagos: {
    listasParaPagar: number;
    bloqueadas: number;
    programados: number;
    montos?: {
      listasParaPagar: number;
      bloqueadas: number;
    };
  };
  devoluciones: {
    borrador: number;
    pendientesEnvio: number;
    enviadas: number;
    enEvaluacion: number;
    sinNca: number;
    total: number;
  };
  stock: {
    bajoMinimo: number;
    sinExistencia: number;
    sugerenciasReposicion: number;
    ajustesPendientes: number;
    transferenciasEnTransito: number;
  };
  grni: {
    totalPendiente: number;
    cantidadRecepciones: number;
    aging: {
      '0-30': number;
      '31-60': number;
      '61-90': number;
      '90+': number;
    };
    bySupplier: Array<{
      supplierId: number;
      supplierName: string;
      monto: number;
      count: number;
    }>;
    alertas90Dias: number;
  };
  alertas: {
    comprasRapidasFrecuentes: number;
    duplicadosSospechosos: number;
    pagosForzados: number;
  };
  resumen: {
    totalPendientes: number;
    urgente: number;
    requiereAtencion: number;
    montoUrgente?: number;
  };
  detalles?: {
    facturasVencidas: DetalleItem[];
    ocsAtrasadas: DetalleItem[];
    listasParaPagar: DetalleItem[];
    recepcionesSinConfirmar: DetalleItem[];
    recepcionesConDiferencias: DetalleItem[];
    facturasMatchBlocked: DetalleItem[];
    facturasPorVencer: DetalleItem[];
    ocsPendientesAprobacion: DetalleItem[];
    ocsParciales: DetalleItem[];
    pagosBloqueados: DetalleItem[];
    ncaPorAplicar: DetalleItem[];
    stockSinExistencia: DetalleItem[];
  };
  _split?: {
    facturas: {
      vencidas: { t1: number; t2: number };
      listasPagar: { t1: number; t2: number };
    };
  };
}

// Format currency helper
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return formatCurrency(value);
}

// User colors for dynamic theming


// ============ ANIMATED PROGRESS BAR ============
function AnimatedProgress({ value, max, color }: { value: number; max: number; color: string }) {
  const [width, setWidth] = useState(0);
  const percentage = max > 0 ? (value / max) * 100 : 0;

  useEffect(() => {
    const timer = setTimeout(() => setWidth(Math.min(percentage, 100)), 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ============ METRIC MINI CARD ============
function MetricMiniCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  color,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  subValue?: string;
  trend?: 'up' | 'down' | 'stable';
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border transition-all",
        "hover:shadow-md hover:scale-[1.02]",
        onClick && "cursor-pointer"
      )}
      style={{
        backgroundColor: `${color}08`,
        borderColor: `${color}30`,
      }}
    >
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-xl font-bold" style={{ color: value > 0 ? color : undefined }}>{value}</p>
          {trend && (
            <span className={cn(
              "flex items-center text-xs",
              trend === 'up' ? "text-destructive" : trend === 'down' ? "text-success" : "text-muted-foreground"
            )}>
              {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : trend === 'down' ? <ArrowDownRight className="h-3 w-3" /> : null}
            </span>
          )}
        </div>
        {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
      </div>
    </button>
  );
}

export default function TorreControlPage() {
  const [data, setData] = useState<TorreControlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const router = useRouter();
  const { currentCompany } = useCompany();
  const userColors = useUserColors();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch torre-control data and GRNI data in parallel
      const [torreResponse, grniResponse] = await Promise.all([
        fetch('/api/compras/torre-control'),
        fetch('/api/compras/grni?view=stats')
      ]);

      if (!torreResponse.ok) throw new Error('Error al cargar datos');
      const torreResult = await torreResponse.json();

      // Add GRNI data (with fallback if endpoint doesn't exist)
      let grniData = {
        totalPendiente: 0,
        cantidadRecepciones: 0,
        aging: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
        bySupplier: [],
        alertas90Dias: 0,
      };

      if (grniResponse.ok) {
        const grniResult = await grniResponse.json();
        grniData = {
          totalPendiente: grniResult.totalPendiente || 0,
          cantidadRecepciones: grniResult.cantidadRecepciones || 0,
          aging: grniResult.aging || { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
          bySupplier: grniResult.bySupplier || [],
          alertas90Dias: grniResult.alertas90Dias || 0,
        };
      }

      setData({ ...torreResult, grni: grniData });
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh cada 5 minutos
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const navigateTo = (path: string, params?: Record<string, string>) => {
    const searchParams = params ? '?' + new URLSearchParams(params).toString() : '';
    router.push(path + searchParams);
  };

  // Calculate totals for each section
  const sectionTotals = useMemo(() => {
    if (!data) return null;
    return {
      recepciones: data.recepciones.sinConfirmar + data.recepciones.sinFactura +
                   data.recepciones.porRegularizar + data.recepciones.conDiferencias,
      facturas: data.facturas.matchBlocked + data.facturas.matchPending +
                data.facturas.matchWarning + data.facturas.porVencer7Dias +
                data.facturas.vencidas,
      solicitudesNca: data.solicitudesNca.nuevas + data.solicitudesNca.enviadas +
                      data.solicitudesNca.esperandoRespuesta + data.solicitudesNca.ncaPorAplicar,
      ordenesCompra: data.ordenesCompra.pendienteEntrega + data.ordenesCompra.parcialmenteRecibidas +
                     data.ordenesCompra.atrasadas + data.ordenesCompra.sinRecepcionMas15Dias,
      pagos: data.pagos.listasParaPagar + data.pagos.bloqueadas + data.pagos.programados,
      prontoPago: data.prontoPago.disponibleHoy + data.prontoPago.venceEn3Dias +
                  data.prontoPago.venceEn7Dias + data.prontoPago.vencido,
      devoluciones: data.devoluciones.total,
      stock: data.stock.bajoMinimo + data.stock.sinExistencia + data.stock.sugerenciasReposicion,
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Activity className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando torre de control...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${userColors.kpiNegative}15` }}
        >
          <AlertTriangle className="h-8 w-8" style={{ color: userColors.kpiNegative }} />
        </div>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5" style={{ color: userColors.chart1 }} />
                Torre de Control
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {currentCompany?.name || 'Empresa'} - Vista general de pendientes del módulo de compras
              </p>
            </div>
            <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Actualizar
            </Button>
          </div>

          <TabsList className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger value="overview" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Resumen
            </TabsTrigger>
            <TabsTrigger value="recepciones" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Recepciones
              {sectionTotals && sectionTotals.recepciones > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">{sectionTotals.recepciones}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="facturas" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Facturas
              {sectionTotals && sectionTotals.facturas > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">{sectionTotals.facturas}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ordenes" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Órdenes
              {sectionTotals && sectionTotals.ordenesCompra > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">{sectionTotals.ordenesCompra}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pagos" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Pagos
              {sectionTotals && sectionTotals.pagos > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">{sectionTotals.pagos}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="nca" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              NCA
              {sectionTotals && sectionTotals.solicitudesNca > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">{sectionTotals.solicitudesNca}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="devoluciones" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Devoluciones
              {sectionTotals && sectionTotals.devoluciones > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">{sectionTotals.devoluciones}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="grni" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              GRNI
              {data?.grni && data.grni.cantidadRecepciones > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1 bg-warning-muted text-warning-muted-foreground">{data.grni.cantidadRecepciones}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="stock" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Stock
              {sectionTotals && sectionTotals.stock > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">{sectionTotals.stock}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 px-4 md:px-6 pb-6 mt-0">
          {data && (
            <>
              {/* KPI Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Urgente */}
                <Card className="overflow-hidden border" style={{ borderColor: `${userColors.kpiNegative}40` }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">URGENTE</p>
                        <p className="text-3xl font-bold tabular-nums" style={{ color: data.resumen.urgente > 0 ? userColors.kpiNegative : undefined }}>
                          {data.resumen.urgente}
                        </p>
                        {data.resumen.montoUrgente && data.resumen.montoUrgente > 0 ? (
                          <p className="text-xs font-medium mt-1" style={{ color: userColors.kpiNegative }}>
                            {formatCompact(data.resumen.montoUrgente)}
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground mt-1">Acción inmediata</p>
                        )}
                      </div>
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${userColors.kpiNegative}15` }}
                      >
                        <AlertTriangle className="h-6 w-6" style={{ color: userColors.kpiNegative }} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <AnimatedProgress value={data.resumen.urgente} max={data.resumen.totalPendientes || 1} color={userColors.kpiNegative} />
                    </div>
                  </CardContent>
                </Card>

                {/* Requiere Atención */}
                <Card className="overflow-hidden border" style={{ borderColor: `${userColors.chart4}40` }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">ATENCIÓN</p>
                        <p className="text-3xl font-bold tabular-nums" style={{ color: data.resumen.requiereAtencion > 0 ? userColors.chart4 : undefined }}>
                          {data.resumen.requiereAtencion}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Revisar pronto</p>
                      </div>
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${userColors.chart4}15` }}
                      >
                        <Clock className="h-6 w-6" style={{ color: userColors.chart4 }} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <AnimatedProgress value={data.resumen.requiereAtencion} max={data.resumen.totalPendientes || 1} color={userColors.chart4} />
                    </div>
                  </CardContent>
                </Card>

                {/* Total Pendientes */}
                <Card className="overflow-hidden border" style={{ borderColor: `${userColors.chart1}40` }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">PENDIENTES</p>
                        <p className="text-3xl font-bold tabular-nums" style={{ color: data.resumen.totalPendientes > 0 ? userColors.chart1 : undefined }}>
                          {data.resumen.totalPendientes}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">En proceso</p>
                      </div>
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${userColors.chart1}15` }}
                      >
                        <Boxes className="h-6 w-6" style={{ color: userColors.chart1 }} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <AnimatedProgress value={data.resumen.totalPendientes} max={data.resumen.totalPendientes + 10} color={userColors.chart1} />
                    </div>
                  </CardContent>
                </Card>

                {/* Pronto Pago */}
                <Card className="overflow-hidden border" style={{ borderColor: `${userColors.kpiPositive}40` }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">PRONTO PAGO</p>
                        <p className="text-3xl font-bold tabular-nums" style={{ color: data.prontoPago.disponibleHoy > 0 ? userColors.kpiPositive : undefined }}>
                          {data.prontoPago.disponibleHoy}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Disponible hoy</p>
                      </div>
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${userColors.kpiPositive}15` }}
                      >
                        <Zap className="h-6 w-6" style={{ color: userColors.kpiPositive }} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <AnimatedProgress value={data.prontoPago.disponibleHoy} max={(data.prontoPago.disponibleHoy + data.prontoPago.venceEn3Dias + data.prontoPago.venceEn7Dias) || 1} color={userColors.kpiPositive} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Secondary Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                <MetricMiniCard
                  icon={FileText}
                  label="Match Bloqueado"
                  value={data.facturas.matchBlocked}
                  color={userColors.kpiNegative}
                  onClick={() => navigateTo('/administracion/compras/match', { status: 'MATCH_BLOCKED' })}
                />
                <MetricMiniCard
                  icon={ClipboardList}
                  label="OC x Aprobar"
                  value={data.ordenesCompra.pendientesAprobacion || 0}
                  color={userColors.chart4}
                  onClick={() => navigateTo('/administracion/compras/ordenes', { estado: 'PENDIENTE_APROBACION' })}
                />
                <MetricMiniCard
                  icon={ShoppingCart}
                  label="OC Atrasadas"
                  value={data.ordenesCompra.atrasadas}
                  color={userColors.kpiNegative}
                  onClick={() => navigateTo('/administracion/compras/ordenes', { atrasadas: 'true' })}
                />
                <MetricMiniCard
                  icon={DollarSign}
                  label="Listas Pagar"
                  value={data.pagos.listasParaPagar}
                  subValue={data.pagos.montos?.listasParaPagar ? formatCompact(data.pagos.montos.listasParaPagar) : undefined}
                  color={userColors.kpiPositive}
                  onClick={() => navigateTo('/administracion/compras/comprobantes', { listasParaPagar: 'true' })}
                />
                <MetricMiniCard
                  icon={FileText}
                  label="Sin Validar"
                  value={data.facturas.sinValidar || 0}
                  color={userColors.chart4}
                  onClick={() => navigateTo('/administracion/compras/comprobantes', { sinValidar: 'true' })}
                />
                <MetricMiniCard
                  icon={Package}
                  label="Sin Ingreso"
                  value={data.facturas.sinIngreso || 0}
                  color={userColors.chart4}
                  onClick={() => navigateTo('/administracion/compras/comprobantes', { sinIngreso: 'true' })}
                />
                <MetricMiniCard
                  icon={Receipt}
                  label="NCA por Aplicar"
                  value={data.solicitudesNca.ncaPorAplicar}
                  color={userColors.chart6}
                  onClick={() => navigateTo('/administracion/compras/solicitudes-nca', { estado: 'SNCA_NCA_RECIBIDA' })}
                />
                <MetricMiniCard
                  icon={Activity}
                  label="Stock Bajo"
                  value={data.stock.bajoMinimo + data.stock.sinExistencia}
                  color={userColors.chart4}
                  onClick={() => navigateTo('/administracion/compras/stock', { filtro: 'bajo_minimo' })}
                />
              </div>

              {/* Quick Access Grid - ENHANCED */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Recepciones Card */}
                <Card className="transition-colors overflow-hidden">
                                    <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${userColors.chart2}15` }}
                      >
                        <Package className="h-5 w-5" style={{ color: userColors.chart2 }} />
                      </div>
                      <div className="flex-1">
                        <span>Recepciones</span>
                        {sectionTotals && sectionTotals.recepciones > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]" style={{ backgroundColor: `${userColors.chart2}15`, color: userColors.chart2 }}>
                            {sectionTotals.recepciones}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs">Estado de recepciones de mercadería</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <QuickItem
                      label="Sin confirmar"
                      count={data.recepciones.sinConfirmar}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/recepciones', { estado: 'BORRADOR' })}
                    />
                    <QuickItem
                      label="Sin factura vinculada"
                      count={data.recepciones.sinFactura}
                      color={userColors.chart6}
                      onClick={() => navigateTo('/administracion/compras/recepciones', { sinFactura: 'true' })}
                    />
                    <QuickItem
                      label="Compras rápidas a regularizar"
                      count={data.recepciones.porRegularizar}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/recepciones', { pendienteRegularizar: 'true' })}
                    />
                    <QuickItem
                      label="Con diferencias"
                      count={data.recepciones.conDiferencias}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/recepciones', { conDiferencias: 'true' })}
                    />
                    <QuickItem
                      label="Calidad rechazada"
                      count={data.recepciones.calidadRechazada || 0}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/recepciones', { calidad: 'RECHAZADO' })}
                    />
                    <div className="pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between text-xs"
                        onClick={() => setActiveTab('recepciones')}
                      >
                        Ver detalle
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Facturas Card */}
                <Card className="transition-colors overflow-hidden">
                                    <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${userColors.chart1}15` }}
                      >
                        <FileText className="h-5 w-5" style={{ color: userColors.chart1 }} />
                      </div>
                      <div className="flex-1">
                        <span>Facturas</span>
                        {sectionTotals && sectionTotals.facturas > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]" style={{ backgroundColor: `${userColors.chart1}15`, color: userColors.chart1 }}>
                            {sectionTotals.facturas}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs">Control de facturas y vencimientos</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <QuickItem
                      label="Match bloqueado"
                      count={data.facturas.matchBlocked}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/match', { status: 'MATCH_BLOCKED' })}
                    />
                    <QuickItem
                      label="Match pendiente"
                      count={data.facturas.matchPending}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/match', { status: 'MATCH_PENDING' })}
                    />
                    <QuickItem
                      label="Por vencer (7 días)"
                      count={data.facturas.porVencer7Dias}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { porVencer: '7' })}
                    />
                    <QuickItem
                      label="Vencidas"
                      count={data.facturas.vencidas}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { vencidas: 'true' })}
                    />
                    <QuickItem
                      label="Sin validar (+3 días)"
                      count={data.facturas.sinValidar || 0}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { sinValidar: 'true' })}
                    />
                    <QuickItem
                      label="Sin ingreso confirmado"
                      count={data.facturas.sinIngreso || 0}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { sinIngreso: 'true' })}
                    />
                    <QuickItem
                      label="Match sin resolver"
                      count={data.facturas.matchSinResolver || 0}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/match', { sinResolver: 'true' })}
                    />
                    <div className="pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between text-xs"
                        onClick={() => setActiveTab('facturas')}
                      >
                        Ver detalle
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Órdenes de Compra Card */}
                <Card className="transition-colors overflow-hidden">
                                    <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${userColors.chart5}15` }}
                      >
                        <ShoppingCart className="h-5 w-5" style={{ color: userColors.chart5 }} />
                      </div>
                      <div className="flex-1">
                        <span>Órdenes de Compra</span>
                        {sectionTotals && sectionTotals.ordenesCompra > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]" style={{ backgroundColor: `${userColors.chart5}15`, color: userColors.chart5 }}>
                            {sectionTotals.ordenesCompra}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs">Seguimiento de órdenes pendientes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <QuickItem
                      label="Pendientes de aprobación"
                      count={data.ordenesCompra.pendientesAprobacion || 0}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/ordenes', { estado: 'PENDIENTE_APROBACION' })}
                    />
                    <QuickItem
                      label="Pendiente entrega"
                      count={data.ordenesCompra.pendienteEntrega}
                      color={userColors.chart6}
                      onClick={() => navigateTo('/administracion/compras/ordenes', { estado: 'ENVIADA_PROVEEDOR' })}
                    />
                    <QuickItem
                      label="Parcialmente recibidas"
                      count={data.ordenesCompra.parcialmenteRecibidas}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/ordenes', { estado: 'PARCIALMENTE_RECIBIDA' })}
                    />
                    <QuickItem
                      label="Atrasadas"
                      count={data.ordenesCompra.atrasadas}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/ordenes', { atrasadas: 'true' })}
                    />
                    <QuickItem
                      label="Sin recepción +15 días"
                      count={data.ordenesCompra.sinRecepcionMas15Dias}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/ordenes', { sinRecepcion15: 'true' })}
                    />
                    <div className="pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between text-xs"
                        onClick={() => setActiveTab('ordenes')}
                      >
                        Ver detalle
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Pagos Card */}
                <Card className="transition-colors overflow-hidden">
                                    <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${userColors.chart3}15` }}
                      >
                        <DollarSign className="h-5 w-5" style={{ color: userColors.chart3 }} />
                      </div>
                      <div className="flex-1">
                        <span>Pagos</span>
                        {sectionTotals && sectionTotals.pagos > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]" style={{ backgroundColor: `${userColors.chart3}15`, color: userColors.chart3 }}>
                            {sectionTotals.pagos}
                          </Badge>
                        )}
                      </div>
                      {data.pagos.montos?.listasParaPagar ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${userColors.kpiPositive}15`, color: userColors.kpiPositive }}>
                          {formatCompact(data.pagos.montos.listasParaPagar)}
                        </span>
                      ) : null}
                    </CardTitle>
                    <CardDescription className="text-xs">Gestión de pagos a proveedores</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <QuickItemWithAmount
                      label="Listas para pagar"
                      count={data.pagos.listasParaPagar}
                      amount={data.pagos.montos?.listasParaPagar}
                      color={userColors.kpiPositive}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { listasParaPagar: 'true' })}
                    />
                    <QuickItemWithAmount
                      label="Bloqueadas"
                      count={data.pagos.bloqueadas}
                      amount={data.pagos.montos?.bloqueadas}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { bloqueadas: 'true' })}
                    />
                    <QuickItem
                      label="Pagos programados"
                      count={data.pagos.programados}
                      color={userColors.chart6}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { programados: 'true' })}
                    />
                    <div className="pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between text-xs"
                        onClick={() => setActiveTab('pagos')}
                      >
                        Ver detalle
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Solicitudes NCA Card */}
                <Card className="transition-colors overflow-hidden">
                                    <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${userColors.chart6}15` }}
                      >
                        <Receipt className="h-5 w-5" style={{ color: userColors.chart6 }} />
                      </div>
                      <div className="flex-1">
                        <span>Solicitudes NCA</span>
                        {sectionTotals && sectionTotals.solicitudesNca > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]" style={{ backgroundColor: `${userColors.chart6}15`, color: userColors.chart6 }}>
                            {sectionTotals.solicitudesNca}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs">Notas de crédito pendientes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <QuickItem
                      label="Nuevas (sin enviar)"
                      count={data.solicitudesNca.nuevas}
                      color={userColors.chart6}
                      onClick={() => navigateTo('/administracion/compras/solicitudes-nca', { estado: 'SNCA_NUEVA' })}
                    />
                    <QuickItem
                      label="Enviadas"
                      count={data.solicitudesNca.enviadas}
                      color={userColors.chart1}
                      onClick={() => navigateTo('/administracion/compras/solicitudes-nca', { estado: 'SNCA_ENVIADA' })}
                    />
                    <QuickItem
                      label="Esperando respuesta"
                      count={data.solicitudesNca.esperandoRespuesta}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/solicitudes-nca', { estado: 'SNCA_EN_REVISION' })}
                    />
                    <QuickItem
                      label="NCA por aplicar"
                      count={data.solicitudesNca.ncaPorAplicar}
                      color={userColors.kpiPositive}
                      onClick={() => navigateTo('/administracion/compras/solicitudes-nca', { estado: 'SNCA_NCA_RECIBIDA' })}
                    />
                    <QuickItem
                      label="NCA sin aplicar +7 días"
                      count={data.solicitudesNca.ncaSinAplicar7Dias || 0}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/solicitudes-nca', { sinAplicar7Dias: 'true' })}
                    />
                    <div className="pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between text-xs"
                        onClick={() => setActiveTab('nca')}
                      >
                        Ver detalle
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Pronto Pago Card */}
                <Card className="transition-colors overflow-hidden">
                                    <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${userColors.kpiPositive}15` }}
                      >
                        <TrendingUp className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
                      </div>
                      <div className="flex-1">
                        <span>Pronto Pago</span>
                        {sectionTotals && sectionTotals.prontoPago > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]" style={{ backgroundColor: `${userColors.kpiPositive}15`, color: userColors.kpiPositive }}>
                            {sectionTotals.prontoPago}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs">Oportunidades de descuento</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <QuickItem
                      label="Disponible hoy"
                      count={data.prontoPago.disponibleHoy}
                      color={userColors.kpiPositive}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { prontoPago: 'disponible' })}
                    />
                    <QuickItem
                      label="Vence en 3 días"
                      count={data.prontoPago.venceEn3Dias}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { prontoPago: '3dias' })}
                    />
                    <QuickItem
                      label="Vence en 7 días"
                      count={data.prontoPago.venceEn7Dias}
                      color={userColors.chart6}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { prontoPago: '7dias' })}
                    />
                    <QuickItem
                      label="Vencido (no aprovechado)"
                      count={data.prontoPago.vencido}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/comprobantes', { prontoPago: 'vencido' })}
                    />
                  </CardContent>
                </Card>

                {/* Devoluciones Card */}
                <Card className="transition-colors overflow-hidden">
                                    <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${userColors.chart4}15` }}
                      >
                        <Package className="h-5 w-5" style={{ color: userColors.chart4 }} />
                      </div>
                      <div className="flex-1">
                        <span>Devoluciones</span>
                        {data.devoluciones.total > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]" style={{ backgroundColor: `${userColors.chart4}15`, color: userColors.chart4 }}>
                            {data.devoluciones.total}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs">Devoluciones a proveedores</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <QuickItem
                      label="En borrador"
                      count={data.devoluciones.borrador}
                      color={userColors.kpiNeutral}
                      onClick={() => navigateTo('/administracion/compras/devoluciones', { estado: 'BORRADOR' })}
                    />
                    <QuickItem
                      label="Pendientes de envío"
                      count={data.devoluciones.pendientesEnvio}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/devoluciones', { estado: 'PENDIENTE_ENVIO' })}
                    />
                    <QuickItem
                      label="Enviadas (esperando)"
                      count={data.devoluciones.enviadas}
                      color={userColors.chart6}
                      onClick={() => navigateTo('/administracion/compras/devoluciones', { estado: 'ENVIADA' })}
                    />
                    <QuickItem
                      label="En evaluación"
                      count={data.devoluciones.enEvaluacion}
                      color={userColors.chart1}
                      onClick={() => navigateTo('/administracion/compras/devoluciones', { estado: 'EN_EVALUACION' })}
                    />
                    <QuickItem
                      label="Sin NCA asociada"
                      count={data.devoluciones.sinNca}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/devoluciones', { sinNca: 'true' })}
                    />
                  </CardContent>
                </Card>

                {/* GRNI Card */}
                <Card className="transition-colors overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${userColors.chart4}15` }}
                      >
                        <Package className="h-5 w-5" style={{ color: userColors.chart4 }} />
                      </div>
                      <div className="flex-1">
                        <span>GRNI</span>
                        {data.grni && data.grni.cantidadRecepciones > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]" style={{ backgroundColor: `${userColors.chart4}15`, color: userColors.chart4 }}>
                            {data.grni.cantidadRecepciones}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs">Recepciones sin facturar</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-muted-foreground">Total pendiente</span>
                      <span className="font-bold" style={{ color: data.grni?.totalPendiente > 0 ? userColors.chart4 : undefined }}>
                        {formatCompact(data.grni?.totalPendiente || 0)}
                      </span>
                    </div>
                    <QuickItem
                      label="Recepciones sin factura"
                      count={data.grni?.cantidadRecepciones || 0}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/grni')}
                    />
                    <QuickItem
                      label="GRNI > 90 días"
                      count={data.grni?.alertas90Dias || 0}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/grni', { aging: '90' })}
                    />
                    <div className="pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between text-xs"
                        onClick={() => setActiveTab('grni')}
                      >
                        Ver detalle GRNI
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Stock Card */}
                <Card className="transition-colors overflow-hidden">
                                    <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${userColors.chart5}15` }}
                      >
                        <Activity className="h-5 w-5" style={{ color: userColors.chart5 }} />
                      </div>
                      <div className="flex-1">
                        <span>Stock & Reposición</span>
                        {sectionTotals && sectionTotals.stock > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]" style={{ backgroundColor: `${userColors.chart5}15`, color: userColors.chart5 }}>
                            {sectionTotals.stock}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs">Control de inventario</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <QuickItem
                      label="Items bajo mínimo"
                      count={data.stock.bajoMinimo}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/stock', { filtro: 'bajo_minimo' })}
                    />
                    <QuickItem
                      label="Sin existencia"
                      count={data.stock.sinExistencia}
                      color={userColors.kpiNegative}
                      onClick={() => navigateTo('/administracion/compras/stock', { filtro: 'sin_stock' })}
                    />
                    <QuickItem
                      label="Sugerencias de reposición"
                      count={data.stock.sugerenciasReposicion}
                      color={userColors.chart1}
                      onClick={() => navigateTo('/administracion/compras/stock', { tab: 'sugerencias' })}
                    />
                    <QuickItem
                      label="Ajustes pendientes"
                      count={data.stock.ajustesPendientes || 0}
                      color={userColors.chart4}
                      onClick={() => navigateTo('/administracion/compras/stock/ajustes', { estado: 'PENDIENTE' })}
                    />
                    <QuickItem
                      label="Transferencias en tránsito"
                      count={data.stock.transferenciasEnTransito || 0}
                      color={userColors.chart6}
                      onClick={() => navigateTo('/administracion/compras/stock/transferencias', { estado: 'ENVIADA' })}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Alertas Section */}
              {(data.alertas.comprasRapidasFrecuentes > 0 || data.alertas.duplicadosSospechosos > 0 || (data.alertas.pagosForzados || 0) > 0) && (
                <Card style={{ borderColor: `${userColors.kpiNegative}40` }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2" style={{ color: userColors.kpiNegative }}>
                      <AlertTriangle className="h-5 w-5" />
                      Alertas Críticas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.alertas.comprasRapidasFrecuentes > 0 && (
                      <AlertItem
                        icon={<Zap className="h-4 w-4" />}
                        label="Usuarios con compras rápidas frecuentes (7 días)"
                        count={data.alertas.comprasRapidasFrecuentes}
                        color={userColors.chart4}
                      />
                    )}
                    {data.alertas.duplicadosSospechosos > 0 && (
                      <AlertItem
                        icon={<XCircle className="h-4 w-4" />}
                        label="Facturas duplicadas sospechosas"
                        count={data.alertas.duplicadosSospechosos}
                        color={userColors.kpiNegative}
                        onClick={() => navigateTo('/administracion/compras/comprobantes', { duplicadas: 'true' })}
                      />
                    )}
                    {(data.alertas.pagosForzados || 0) > 0 && (
                      <AlertItem
                        icon={<DollarSign className="h-4 w-4" />}
                        label="Pagos forzados sin ingreso (auditoría)"
                        count={data.alertas.pagosForzados || 0}
                        color={userColors.kpiNegative}
                        onClick={() => navigateTo('/administracion/compras/comprobantes', { pagosForzados: 'true' })}
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Recepciones Tab - Enhanced */}
        <TabsContent value="recepciones" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {data && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniKpiCard
                  label="Total Pendientes"
                  value={sectionTotals?.recepciones || 0}
                  icon={Package}
                  color={userColors.chart2}
                />
                <MiniKpiCard
                  label="Críticas"
                  value={data.recepciones.conDiferencias + (data.recepciones.calidadRechazada || 0)}
                  icon={AlertTriangle}
                  color={userColors.kpiNegative}
                />
                <MiniKpiCard
                  label="Requieren Atención"
                  value={data.recepciones.sinConfirmar + data.recepciones.porRegularizar}
                  icon={Clock}
                  color={userColors.chart4}
                />
                <MiniKpiCard
                  label="Informativo"
                  value={data.recepciones.sinFactura}
                  icon={AlertCircle}
                  color={userColors.chart6}
                />
              </div>

              {/* Visual Progress Bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Distribución por estado</span>
                    <span className="text-xs text-muted-foreground">{sectionTotals?.recepciones || 0} total</span>
                  </div>
                  <StackedProgressBar
                    segments={[
                      { value: data.recepciones.conDiferencias + (data.recepciones.calidadRechazada || 0), color: userColors.kpiNegative, label: 'Críticas' },
                      { value: data.recepciones.sinConfirmar + data.recepciones.porRegularizar, color: userColors.chart4, label: 'Atención' },
                      { value: data.recepciones.sinFactura, color: userColors.chart6, label: 'Info' },
                    ]}
                    total={sectionTotals?.recepciones || 1}
                  />
                </CardContent>
              </Card>

              {/* Detailed List */}
              <DetailSection
                title="Recepciones de Mercadería"
                description="Gestión de recepciones pendientes y diferencias"
                icon={<Package className="h-5 w-5" />}
                color={userColors.chart2}
                items={[
                  {
                    label: 'Sin confirmar',
                    description: 'Recepciones en borrador pendientes de confirmación',
                    count: data.recepciones.sinConfirmar,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/recepciones', { estado: 'BORRADOR' }),
                    detailItems: data.detalles?.recepcionesSinConfirmar || [],
                    detailType: 'recepcion',
                  },
                  {
                    label: 'Sin factura vinculada',
                    description: 'Recepciones confirmadas sin factura asociada',
                    count: data.recepciones.sinFactura,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/recepciones', { sinFactura: 'true' }),
                  },
                  {
                    label: 'Compras rápidas a regularizar',
                    description: 'Compras sin OC pendientes de regularización',
                    count: data.recepciones.porRegularizar,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/recepciones', { pendienteRegularizar: 'true' }),
                  },
                  {
                    label: 'Con diferencias',
                    description: 'Recepciones con discrepancias entre lo recibido y facturado',
                    count: data.recepciones.conDiferencias,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/recepciones', { conDiferencias: 'true' }),
                    detailItems: data.detalles?.recepcionesConDiferencias || [],
                    detailType: 'recepcion',
                  },
                  {
                    label: 'Calidad rechazada',
                    description: 'Recepciones con control de calidad rechazado pendientes de acción',
                    count: data.recepciones.calidadRechazada || 0,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/recepciones', { calidad: 'RECHAZADO' }),
                  },
                ]}
              />
            </>
          )}
        </TabsContent>

        {/* Facturas Tab - Enhanced */}
        <TabsContent value="facturas" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {data && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MiniKpiCard
                  label="Total Pendientes"
                  value={sectionTotals?.facturas || 0}
                  icon={FileText}
                  color={userColors.chart1}
                />
                <MiniKpiCard
                  label="Vencidas"
                  value={data.facturas.vencidas}
                  subValue={data.facturas.montos?.vencidas ? formatCompact(data.facturas.montos.vencidas) : undefined}
                  icon={AlertTriangle}
                  color={userColors.kpiNegative}
                />
                <MiniKpiCard
                  label="Match Bloqueado"
                  value={data.facturas.matchBlocked}
                  icon={XCircle}
                  color={userColors.kpiNegative}
                />
                <MiniKpiCard
                  label="Por Vencer"
                  value={data.facturas.porVencer7Dias}
                  subValue={data.facturas.montos?.porVencer ? formatCompact(data.facturas.montos.porVencer) : undefined}
                  icon={Clock}
                  color={userColors.chart4}
                />
                <MiniKpiCard
                  label="Match Pendiente"
                  value={data.facturas.matchPending}
                  icon={Timer}
                  color={userColors.chart4}
                />
              </div>

              {/* Visual Progress Bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Estado del match de facturas</span>
                    <span className="text-xs text-muted-foreground">{data.facturas.matchBlocked + data.facturas.matchPending + data.facturas.matchWarning} con match pendiente</span>
                  </div>
                  <StackedProgressBar
                    segments={[
                      { value: data.facturas.matchBlocked + data.facturas.vencidas + (data.facturas.matchSinResolver || 0), color: userColors.kpiNegative, label: 'Bloqueado/Vencidas' },
                      { value: data.facturas.matchPending + data.facturas.porVencer7Dias + (data.facturas.sinValidar || 0) + (data.facturas.sinIngreso || 0), color: userColors.chart4, label: 'Pendiente/Por vencer' },
                      { value: data.facturas.matchWarning, color: userColors.chart6, label: 'Warning' },
                    ]}
                    total={sectionTotals?.facturas || 1}
                  />
                </CardContent>
              </Card>

              {/* Detailed List */}
              <DetailSection
                title="Facturas de Compra"
                description="Control de facturas, vencimientos y matching"
                icon={<FileText className="h-5 w-5" />}
                color={userColors.chart1}
                items={[
                  {
                    label: 'Match bloqueado',
                    description: 'Facturas con discrepancias que bloquean el pago',
                    count: data.facturas.matchBlocked,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/match', { status: 'MATCH_BLOCKED' }),
                    detailItems: data.detalles?.facturasMatchBlocked || [],
                    detailType: 'factura',
                  },
                  {
                    label: 'Match pendiente',
                    description: 'Facturas sin recepciones vinculadas',
                    count: data.facturas.matchPending,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/match', { status: 'MATCH_PENDING' }),
                  },
                  {
                    label: 'Match con warning',
                    description: 'Facturas con diferencias menores dentro de tolerancia',
                    count: data.facturas.matchWarning,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/match', { status: 'MATCH_WARNING' }),
                  },
                  {
                    label: 'Por vencer (7 días)',
                    description: 'Facturas próximas a vencer',
                    count: data.facturas.porVencer7Dias,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { porVencer: '7' }),
                    detailItems: data.detalles?.facturasPorVencer || [],
                    detailType: 'factura',
                  },
                  {
                    label: 'Vencidas',
                    description: 'Facturas con fecha de vencimiento pasada',
                    count: data.facturas.vencidas,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { vencidas: 'true' }),
                    detailItems: data.detalles?.facturasVencidas || [],
                    detailType: 'factura',
                  },
                  ...(data.facturas.duplicadasSospechosas > 0 ? [{
                    label: 'Duplicadas sospechosas',
                    description: 'Facturas que podrían ser duplicadas',
                    count: data.facturas.duplicadasSospechosas,
                    severity: 'error' as const,
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { duplicadas: 'true' }),
                  }] : []),
                  {
                    label: 'Sin validar (+3 días)',
                    description: 'Facturas cargadas hace más de 3 días sin validar',
                    count: data.facturas.sinValidar || 0,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { sinValidar: 'true' }),
                  },
                  {
                    label: 'Sin ingreso confirmado',
                    description: 'Facturas validadas pero sin confirmación de ingreso de mercadería',
                    count: data.facturas.sinIngreso || 0,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { sinIngreso: 'true' }),
                  },
                  {
                    label: 'Match sin resolver',
                    description: 'Discrepancias de match pendientes de resolución',
                    count: data.facturas.matchSinResolver || 0,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/match', { sinResolver: 'true' }),
                  },
                ]}
              />
            </>
          )}
        </TabsContent>

        {/* Órdenes Tab - Enhanced */}
        <TabsContent value="ordenes" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {data && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniKpiCard
                  label="Total en Proceso"
                  value={sectionTotals?.ordenesCompra || 0}
                  icon={ShoppingCart}
                  color={userColors.chart5}
                />
                <MiniKpiCard
                  label="Atrasadas"
                  value={data.ordenesCompra.atrasadas}
                  icon={AlertTriangle}
                  color={userColors.kpiNegative}
                />
                <MiniKpiCard
                  label="Por Aprobar"
                  value={data.ordenesCompra.pendientesAprobacion || 0}
                  icon={ClipboardList}
                  color={userColors.chart4}
                />
                <MiniKpiCard
                  label="Parciales"
                  value={data.ordenesCompra.parcialmenteRecibidas}
                  icon={Package}
                  color={userColors.chart6}
                />
              </div>

              {/* Visual Progress Bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Estado de órdenes de compra</span>
                    <span className="text-xs text-muted-foreground">{sectionTotals?.ordenesCompra || 0} en proceso</span>
                  </div>
                  <StackedProgressBar
                    segments={[
                      { value: data.ordenesCompra.atrasadas, color: userColors.kpiNegative, label: 'Atrasadas' },
                      { value: (data.ordenesCompra.pendientesAprobacion || 0) + data.ordenesCompra.parcialmenteRecibidas + data.ordenesCompra.sinRecepcionMas15Dias, color: userColors.chart4, label: 'Requieren atención' },
                      { value: data.ordenesCompra.pendienteEntrega, color: userColors.chart6, label: 'En camino' },
                    ]}
                    total={sectionTotals?.ordenesCompra || 1}
                  />
                </CardContent>
              </Card>

              {/* Detailed List */}
              <DetailSection
                title="Órdenes de Compra"
                description="Seguimiento de órdenes enviadas a proveedores"
                icon={<ShoppingCart className="h-5 w-5" />}
                color={userColors.chart5}
                items={[
                  {
                    label: 'Pendientes de aprobación',
                    description: 'Órdenes esperando aprobación para procesar',
                    count: data.ordenesCompra.pendientesAprobacion || 0,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/ordenes', { estado: 'PENDIENTE_APROBACION' }),
                    detailItems: data.detalles?.ocsPendientesAprobacion || [],
                    detailType: 'oc',
                  },
                  {
                    label: 'Pendiente entrega',
                    description: 'Órdenes enviadas esperando recepción',
                    count: data.ordenesCompra.pendienteEntrega,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/ordenes', { estado: 'ENVIADA_PROVEEDOR' }),
                  },
                  {
                    label: 'Parcialmente recibidas',
                    description: 'Órdenes con entregas parciales',
                    count: data.ordenesCompra.parcialmenteRecibidas,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/ordenes', { estado: 'PARCIALMENTE_RECIBIDA' }),
                    detailItems: data.detalles?.ocsParciales || [],
                    detailType: 'oc',
                  },
                  {
                    label: 'Atrasadas',
                    description: 'Órdenes con fecha de entrega estimada pasada',
                    count: data.ordenesCompra.atrasadas,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/ordenes', { atrasadas: 'true' }),
                    detailItems: data.detalles?.ocsAtrasadas || [],
                    detailType: 'oc',
                  },
                  {
                    label: 'Sin recepción +15 días',
                    description: 'Órdenes antiguas sin movimiento',
                    count: data.ordenesCompra.sinRecepcionMas15Dias,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/ordenes', { sinRecepcion15: 'true' }),
                  },
                ]}
              />
            </>
          )}
        </TabsContent>

        {/* Pagos Tab - Enhanced */}
        <TabsContent value="pagos" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {data && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MiniKpiCard
                  label="Listas para Pagar"
                  value={data.pagos.listasParaPagar}
                  subValue={data.pagos.montos?.listasParaPagar ? formatCompact(data.pagos.montos.listasParaPagar) : undefined}
                  icon={CheckCircle2}
                  color={userColors.kpiPositive}
                />
                <MiniKpiCard
                  label="Bloqueadas"
                  value={data.pagos.bloqueadas}
                  subValue={data.pagos.montos?.bloqueadas ? formatCompact(data.pagos.montos.bloqueadas) : undefined}
                  icon={XCircle}
                  color={userColors.kpiNegative}
                />
                <MiniKpiCard
                  label="Programados"
                  value={data.pagos.programados}
                  icon={Clock}
                  color={userColors.chart6}
                />
                <MiniKpiCard
                  label="Pronto Pago Disponible"
                  value={data.prontoPago.disponibleHoy}
                  icon={Zap}
                  color={userColors.kpiPositive}
                />
                <MiniKpiCard
                  label="PP Vence Pronto"
                  value={data.prontoPago.venceEn3Dias}
                  icon={AlertTriangle}
                  color={userColors.chart4}
                />
              </div>

              {/* Visual Progress Bars */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Estado de pagos</span>
                      <span className="text-xs text-muted-foreground">{sectionTotals?.pagos || 0} total</span>
                    </div>
                    <StackedProgressBar
                      segments={[
                        { value: data.pagos.listasParaPagar, color: userColors.kpiPositive, label: 'Listas' },
                        { value: data.pagos.programados, color: userColors.chart6, label: 'Programados' },
                        { value: data.pagos.bloqueadas, color: userColors.kpiNegative, label: 'Bloqueadas' },
                      ]}
                      total={sectionTotals?.pagos || 1}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Oportunidades pronto pago</span>
                      <span className="text-xs text-muted-foreground">{sectionTotals?.prontoPago || 0} total</span>
                    </div>
                    <StackedProgressBar
                      segments={[
                        { value: data.prontoPago.disponibleHoy, color: userColors.kpiPositive, label: 'Disponible' },
                        { value: data.prontoPago.venceEn3Dias, color: userColors.chart4, label: '3 días' },
                        { value: data.prontoPago.venceEn7Dias, color: userColors.chart6, label: '7 días' },
                        { value: data.prontoPago.vencido, color: userColors.kpiNegative, label: 'Vencido' },
                      ]}
                      total={sectionTotals?.prontoPago || 1}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Lists */}
              <DetailSection
                title="Estado de Pagos"
                description="Facturas listas para pago y programación"
                icon={<DollarSign className="h-5 w-5" />}
                color={userColors.chart3}
                items={[
                  {
                    label: 'Listas para pagar',
                    description: 'Facturas validadas y con match OK',
                    count: data.pagos.listasParaPagar,
                    severity: 'success',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { listasParaPagar: 'true' }),
                    detailItems: data.detalles?.listasParaPagar || [],
                    detailType: 'factura',
                  },
                  {
                    label: 'Bloqueadas',
                    description: 'Facturas bloqueadas por discrepancias',
                    count: data.pagos.bloqueadas,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { bloqueadas: 'true' }),
                    detailItems: data.detalles?.pagosBloqueados || [],
                    detailType: 'factura',
                  },
                  {
                    label: 'Pagos programados',
                    description: 'Pagos agendados para fechas futuras',
                    count: data.pagos.programados,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { programados: 'true' }),
                  },
                ]}
              />

              <DetailSection
                title="Oportunidades de Pronto Pago"
                description="Descuentos disponibles por pago anticipado"
                icon={<TrendingUp className="h-5 w-5" />}
                color={userColors.kpiPositive}
                items={[
                  {
                    label: 'Disponible hoy',
                    description: 'Facturas con descuento aplicable ahora',
                    count: data.prontoPago.disponibleHoy,
                    severity: 'success',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { prontoPago: 'disponible' }),
                  },
                  {
                    label: 'Vence en 3 días',
                    description: 'Descuentos próximos a expirar',
                    count: data.prontoPago.venceEn3Dias,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { prontoPago: '3dias' }),
                  },
                  {
                    label: 'Vence en 7 días',
                    description: 'Descuentos disponibles esta semana',
                    count: data.prontoPago.venceEn7Dias,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { prontoPago: '7dias' }),
                  },
                  {
                    label: 'Vencido (no aprovechado)',
                    description: 'Descuentos que ya no están disponibles',
                    count: data.prontoPago.vencido,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/comprobantes', { prontoPago: 'vencido' }),
                  },
                ]}
              />
            </>
          )}
        </TabsContent>

        {/* NCA Tab - Enhanced */}
        <TabsContent value="nca" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {data && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniKpiCard
                  label="Total en Proceso"
                  value={sectionTotals?.solicitudesNca || 0}
                  icon={Receipt}
                  color={userColors.chart6}
                />
                <MiniKpiCard
                  label="NCA por Aplicar"
                  value={data.solicitudesNca.ncaPorAplicar}
                  icon={CheckCircle2}
                  color={userColors.kpiPositive}
                />
                <MiniKpiCard
                  label="Esperando Respuesta"
                  value={data.solicitudesNca.esperandoRespuesta}
                  icon={Clock}
                  color={userColors.chart4}
                />
                <MiniKpiCard
                  label="Sin Aplicar +7d"
                  value={data.solicitudesNca.ncaSinAplicar7Dias || 0}
                  icon={AlertTriangle}
                  color={userColors.kpiNegative}
                />
              </div>

              {/* Visual Progress Bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Ciclo de vida de solicitudes NCA</span>
                    <span className="text-xs text-muted-foreground">{sectionTotals?.solicitudesNca || 0} en proceso</span>
                  </div>
                  <StackedProgressBar
                    segments={[
                      { value: data.solicitudesNca.nuevas, color: userColors.chart6, label: 'Nuevas' },
                      { value: data.solicitudesNca.enviadas, color: userColors.chart1, label: 'Enviadas' },
                      { value: data.solicitudesNca.esperandoRespuesta, color: userColors.chart4, label: 'En revisión' },
                      { value: data.solicitudesNca.ncaPorAplicar, color: userColors.kpiPositive, label: 'Por aplicar' },
                    ]}
                    total={sectionTotals?.solicitudesNca || 1}
                  />
                </CardContent>
              </Card>

              {/* Detailed List */}
              <DetailSection
                title="Solicitudes de Nota de Crédito"
                description="Gestión de reclamos y notas de crédito"
                icon={<Receipt className="h-5 w-5" />}
                color={userColors.chart6}
                items={[
                  {
                    label: 'Nuevas (sin enviar)',
                    description: 'Solicitudes creadas pendientes de envío',
                    count: data.solicitudesNca.nuevas,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/solicitudes-nca', { estado: 'SNCA_NUEVA' }),
                  },
                  {
                    label: 'Enviadas',
                    description: 'Solicitudes enviadas al proveedor',
                    count: data.solicitudesNca.enviadas,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/solicitudes-nca', { estado: 'SNCA_ENVIADA' }),
                  },
                  {
                    label: 'Esperando respuesta',
                    description: 'Solicitudes en revisión por el proveedor',
                    count: data.solicitudesNca.esperandoRespuesta,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/solicitudes-nca', { estado: 'SNCA_EN_REVISION' }),
                  },
                  {
                    label: 'NCA por aplicar',
                    description: 'Notas de crédito recibidas pendientes de aplicación',
                    count: data.solicitudesNca.ncaPorAplicar,
                    severity: 'success',
                    onClick: () => navigateTo('/administracion/compras/solicitudes-nca', { estado: 'SNCA_NCA_RECIBIDA' }),
                    detailItems: data.detalles?.ncaPorAplicar || [],
                    detailType: 'nca',
                  },
                  {
                    label: 'NCA sin aplicar +7 días',
                    description: 'Notas de crédito recibidas hace más de 7 días sin aplicar',
                    count: data.solicitudesNca.ncaSinAplicar7Dias || 0,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/solicitudes-nca', { sinAplicar7Dias: 'true' }),
                  },
                ]}
              />
            </>
          )}
        </TabsContent>

        {/* Devoluciones Tab - Enhanced */}
        <TabsContent value="devoluciones" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {data && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniKpiCard
                  label="Total en Proceso"
                  value={data.devoluciones.total}
                  icon={Package}
                  color={userColors.chart4}
                />
                <MiniKpiCard
                  label="Sin NCA"
                  value={data.devoluciones.sinNca}
                  icon={AlertTriangle}
                  color={userColors.kpiNegative}
                />
                <MiniKpiCard
                  label="En Evaluación"
                  value={data.devoluciones.enEvaluacion}
                  icon={Clock}
                  color={userColors.chart4}
                />
                <MiniKpiCard
                  label="Pendientes Envío"
                  value={data.devoluciones.pendientesEnvio}
                  icon={Truck}
                  color={userColors.chart6}
                />
              </div>

              {/* Visual Progress Bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Ciclo de vida de devoluciones</span>
                    <span className="text-xs text-muted-foreground">{data.devoluciones.total} en proceso</span>
                  </div>
                  <StackedProgressBar
                    segments={[
                      { value: data.devoluciones.borrador, color: userColors.kpiNeutral, label: 'Borrador' },
                      { value: data.devoluciones.pendientesEnvio, color: userColors.chart4, label: 'Por enviar' },
                      { value: data.devoluciones.enviadas, color: userColors.chart6, label: 'Enviadas' },
                      { value: data.devoluciones.enEvaluacion, color: userColors.chart1, label: 'Evaluación' },
                    ]}
                    total={data.devoluciones.total || 1}
                  />
                </CardContent>
              </Card>

              {/* Detailed List */}
              <DetailSection
                title="Devoluciones a Proveedores"
                description="Gestión de devoluciones y NCA asociadas"
                icon={<Package className="h-5 w-5" />}
                color={userColors.chart4}
                items={[
                  {
                    label: 'En borrador',
                    description: 'Devoluciones pendientes de enviar',
                    count: data.devoluciones.borrador,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/devoluciones', { estado: 'BORRADOR' }),
                  },
                  {
                    label: 'Pendientes de envío',
                    description: 'Aprobadas, esperando despacho',
                    count: data.devoluciones.pendientesEnvio,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/devoluciones', { estado: 'PENDIENTE_ENVIO' }),
                  },
                  {
                    label: 'Enviadas',
                    description: 'En camino al proveedor',
                    count: data.devoluciones.enviadas,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/devoluciones', { estado: 'ENVIADA' }),
                  },
                  {
                    label: 'En evaluación',
                    description: 'El proveedor está revisando',
                    count: data.devoluciones.enEvaluacion,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/devoluciones', { estado: 'EN_EVALUACION' }),
                  },
                  {
                    label: 'Sin NCA asociada',
                    description: 'Resueltas sin nota de crédito',
                    count: data.devoluciones.sinNca,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/devoluciones', { sinNca: 'true' }),
                  },
                ]}
              />
            </>
          )}
        </TabsContent>

        {/* GRNI Tab - Goods Received Not Invoiced */}
        <TabsContent value="grni" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {data && data.grni && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MiniKpiCard
                  label="GRNI Total"
                  value={formatCompact(data.grni.totalPendiente || 0)}
                  icon={Package}
                  color={userColors.chart4}
                  numeric={false}
                />
                <MiniKpiCard
                  label="Recepciones"
                  value={data.grni.cantidadRecepciones}
                  icon={FileText}
                  color={userColors.chart1}
                />
                <MiniKpiCard
                  label="0-30 días"
                  value={formatCompact(data.grni.aging?.['0-30'] || 0)}
                  icon={Clock}
                  color={userColors.chart5}
                  numeric={false}
                />
                <MiniKpiCard
                  label="31-90 días"
                  value={formatCompact((data.grni.aging?.['31-60'] || 0) + (data.grni.aging?.['61-90'] || 0))}
                  icon={Timer}
                  color={userColors.chart4}
                  numeric={false}
                />
                <MiniKpiCard
                  label="> 90 días"
                  value={formatCompact(data.grni.aging?.['90+'] || 0)}
                  icon={AlertTriangle}
                  color={userColors.kpiNegative}
                  numeric={false}
                />
              </div>

              {/* Aging Progress Bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Antigüedad del GRNI pendiente</span>
                    <span className="text-xs text-muted-foreground">{formatCurrency(data.grni.totalPendiente || 0)} total</span>
                  </div>
                  <StackedProgressBar
                    segments={[
                      { value: data.grni.aging?.['0-30'] || 0, color: userColors.chart5, label: '0-30 días' },
                      { value: data.grni.aging?.['31-60'] || 0, color: userColors.chart1, label: '31-60 días' },
                      { value: data.grni.aging?.['61-90'] || 0, color: userColors.chart4, label: '61-90 días' },
                      { value: data.grni.aging?.['90+'] || 0, color: userColors.kpiNegative, label: '90+ días' },
                    ]}
                    total={data.grni.totalPendiente || 1}
                  />
                  <div className="flex flex-wrap gap-4 mt-2 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: userColors.chart5 }} />
                      0-30d: {formatCompact(data.grni.aging?.['0-30'] || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: userColors.chart1 }} />
                      31-60d: {formatCompact(data.grni.aging?.['31-60'] || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: userColors.chart4 }} />
                      61-90d: {formatCompact(data.grni.aging?.['61-90'] || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: userColors.kpiNegative }} />
                      90+d: {formatCompact(data.grni.aging?.['90+'] || 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Top Suppliers with GRNI */}
              {data.grni.bySupplier && data.grni.bySupplier.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Truck className="h-4 w-4" style={{ color: userColors.chart4 }} />
                      Top Proveedores con GRNI Pendiente
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Recepciones sin facturar por proveedor
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {data.grni.bySupplier.slice(0, 8).map((supplier, index) => (
                        <button
                          key={supplier.supplierId}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                          onClick={() => navigateTo('/administracion/compras/grni', { supplierId: String(supplier.supplierId) })}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-5">{index + 1}</span>
                            <div className="text-left">
                              <p className="text-sm font-medium truncate max-w-[200px]">{supplier.supplierName}</p>
                              <p className="text-xs text-muted-foreground">{supplier.count} recepciones</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm" style={{ color: userColors.chart4 }}>
                              {formatCompact(supplier.monto)}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-3"
                      onClick={() => navigateTo('/administracion/compras/grni')}
                    >
                      Ver detalle GRNI completo
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* GRNI Actions */}
              <DetailSection
                title="GRNI - Recepciones sin Facturar"
                description="Control de acumulaciones pendientes de factura"
                icon={<Package className="h-5 w-5" />}
                color={userColors.chart4}
                items={[
                  {
                    label: 'Total recepciones sin factura',
                    description: 'Recepciones confirmadas pendientes de vinculación con factura',
                    count: data.grni.cantidadRecepciones,
                    severity: data.grni.cantidadRecepciones > 0 ? 'warning' : 'ok',
                    onClick: () => navigateTo('/administracion/compras/grni'),
                  },
                  {
                    label: 'GRNI > 90 días',
                    description: 'Recepciones antiguas que requieren seguimiento urgente',
                    count: data.grni.alertas90Dias || 0,
                    severity: (data.grni.alertas90Dias || 0) > 0 ? 'error' : 'ok',
                    onClick: () => navigateTo('/administracion/compras/grni', { aging: '90' }),
                  },
                ]}
              />
            </>
          )}
        </TabsContent>

        {/* Stock Tab - Enhanced */}
        <TabsContent value="stock" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {data && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MiniKpiCard
                  label="Alertas Stock"
                  value={sectionTotals?.stock || 0}
                  icon={Activity}
                  color={userColors.chart5}
                />
                <MiniKpiCard
                  label="Sin Existencia"
                  value={data.stock.sinExistencia}
                  icon={AlertTriangle}
                  color={userColors.kpiNegative}
                />
                <MiniKpiCard
                  label="Bajo Mínimo"
                  value={data.stock.bajoMinimo}
                  icon={TrendingDown}
                  color={userColors.chart4}
                />
                <MiniKpiCard
                  label="Sugerencias"
                  value={data.stock.sugerenciasReposicion}
                  icon={ClipboardList}
                  color={userColors.chart1}
                />
                <MiniKpiCard
                  label="En Tránsito"
                  value={data.stock.transferenciasEnTransito || 0}
                  icon={Truck}
                  color={userColors.chart6}
                />
              </div>

              {/* Visual Progress Bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Estado del inventario</span>
                    <span className="text-xs text-muted-foreground">{sectionTotals?.stock || 0} items requieren atención</span>
                  </div>
                  <StackedProgressBar
                    segments={[
                      { value: data.stock.sinExistencia, color: userColors.kpiNegative, label: 'Sin stock' },
                      { value: data.stock.bajoMinimo, color: userColors.chart4, label: 'Bajo mínimo' },
                      { value: data.stock.sugerenciasReposicion, color: userColors.chart1, label: 'Sugerencias' },
                    ]}
                    total={sectionTotals?.stock || 1}
                  />
                </CardContent>
              </Card>

              {/* Detailed List */}
              <DetailSection
                title="Stock & Reposición"
                description="Control de inventario y alertas"
                icon={<Activity className="h-5 w-5" />}
                color={userColors.chart5}
                items={[
                  {
                    label: 'Items bajo mínimo',
                    description: 'Stock por debajo del nivel mínimo configurado',
                    count: data.stock.bajoMinimo,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/stock', { filtro: 'bajo_minimo' }),
                  },
                  {
                    label: 'Sin existencia',
                    description: 'Items con stock en cero',
                    count: data.stock.sinExistencia,
                    severity: 'error',
                    onClick: () => navigateTo('/administracion/compras/stock', { filtro: 'sin_stock' }),
                    detailItems: data.detalles?.stockSinExistencia || [],
                    detailType: 'stock',
                  },
                  {
                    label: 'Sugerencias de reposición',
                    description: 'Items que deberían reponerse pronto',
                    count: data.stock.sugerenciasReposicion,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/stock', { tab: 'sugerencias' }),
                  },
                  {
                    label: 'Ajustes pendientes',
                    description: 'Ajustes de stock pendientes de aprobación',
                    count: data.stock.ajustesPendientes || 0,
                    severity: 'warning',
                    onClick: () => navigateTo('/administracion/compras/stock/ajustes', { estado: 'PENDIENTE' }),
                  },
                  {
                    label: 'Transferencias en tránsito',
                    description: 'Transferencias enviadas pendientes de recepción',
                    count: data.stock.transferenciasEnTransito || 0,
                    severity: 'info',
                    onClick: () => navigateTo('/administracion/compras/stock/transferencias', { estado: 'ENVIADA' }),
                  },
                ]}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Quick Item Component for Overview cards
function QuickItem({
  label,
  count,
  color,
  onClick
}: {
  label: string;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="font-semibold"
          style={{
            backgroundColor: count > 0 ? `${color}15` : undefined,
            color: count > 0 ? color : undefined
          }}
        >
          {count}
        </Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

// Quick Item with Amount Component
function QuickItemWithAmount({
  label,
  count,
  amount,
  color,
  onClick
}: {
  label: string;
  count: number;
  amount?: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div className="flex flex-col items-start">
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
        {amount && amount > 0 && (
          <span className="text-xs font-medium" style={{ color }}>{formatCompact(amount)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="font-semibold"
          style={{
            backgroundColor: count > 0 ? `${color}15` : undefined,
            color: count > 0 ? color : undefined
          }}
        >
          {count}
        </Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

// Alert Item Component
function AlertItem({
  icon,
  label,
  count,
  color,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-lg",
        onClick && "hover:bg-muted/50 transition-colors cursor-pointer"
      )}
      style={{ backgroundColor: `${color}08` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
        <span className="text-sm">{label}</span>
      </div>
      <Badge
        style={{ backgroundColor: `${color}20`, color }}
      >
        {count}
      </Badge>
    </Wrapper>
  );
}

// Detail Section Component for tabs - Enhanced with expandable items
interface DetailItemConfig {
  label: string;
  description: string;
  count: number;
  severity: 'success' | 'info' | 'warning' | 'error';
  onClick: () => void;
  detailItems?: DetalleItem[];
  detailType?: 'factura' | 'oc' | 'recepcion' | 'nca' | 'stock';
}

function DetailSection({
  title,
  description,
  icon,
  color,
  items
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  items: DetailItemConfig[];
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const router = useRouter();

  const severityColors = {
    success: '#10b981',
    info: '#06b6d4',
    warning: '#f59e0b',
    error: '#ef4444',
  };

  const total = items.reduce((sum, item) => sum + item.count, 0);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  };

  const handleDetailClick = (type: string, id: number) => {
    switch (type) {
      case 'factura':
        router.push(`/administracion/compras/comprobantes/${id}`);
        break;
      case 'oc':
        router.push(`/administracion/compras/ordenes/${id}`);
        break;
      case 'recepcion':
        router.push(`/administracion/compras/recepciones/${id}`);
        break;
      case 'nca':
        router.push(`/administracion/compras/solicitudes-nca/${id}`);
        break;
      case 'stock':
        router.push(`/administracion/compras/stock?item=${id}`);
        break;
    }
  };

  const handleRowClick = (item: DetailItemConfig, index: number) => {
    // Si tiene detailType configurado y count > 0, expandir/colapsar
    const canExpand = item.detailType && item.count > 0;
    const isExpanded = expandedIndex === index;

    if (canExpand) {
      setExpandedIndex(isExpanded ? null : index);
    } else {
      // Navegar a la vista filtrada
      item.onClick();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total pendientes</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, index) => {
          const canExpand = item.detailType && item.count > 0;
          const hasDetailData = item.detailItems && item.detailItems.length > 0;
          const isExpanded = expandedIndex === index;

          return (
            <div key={index} className="border rounded-lg overflow-hidden">
              {/* Main row - always clickable */}
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 transition-all hover:bg-muted/50 group text-left"
                onClick={() => handleRowClick(item, index)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${severityColors[item.severity]}15` }}
                  >
                    {item.severity === 'success' && <CheckCircle2 className="h-5 w-5" style={{ color: severityColors.success }} />}
                    {item.severity === 'info' && <AlertCircle className="h-5 w-5" style={{ color: severityColors.info }} />}
                    {item.severity === 'warning' && <Timer className="h-5 w-5" style={{ color: severityColors.warning }} />}
                    {item.severity === 'error' && <XCircle className="h-5 w-5" style={{ color: severityColors.error }} />}
                  </div>
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    className="text-base px-3 py-1"
                    style={{
                      backgroundColor: item.count > 0 ? `${severityColors[item.severity]}15` : undefined,
                      color: item.count > 0 ? severityColors[item.severity] : undefined
                    }}
                  >
                    {item.count}
                  </Badge>
                  {canExpand ? (
                    <ChevronDown className={cn(
                      "h-5 w-5 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )} />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </button>

              {/* Expanded detail list */}
              {isExpanded && canExpand && (
                <div className="bg-muted/30 border-t">
                  {hasDetailData ? (
                    <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                      {item.detailItems!.map((detail, detailIdx) => (
                        <button
                          key={detailIdx}
                          type="button"
                          className="w-full flex items-center justify-between p-3 bg-background rounded-lg hover:bg-muted/50 transition-colors text-left group/item"
                          onClick={() => item.detailType && handleDetailClick(item.detailType, detail.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {detail.numero || detail.nombre || `#${detail.id}`}
                              </span>
                              {detail.oc && (
                                <Badge variant="outline" className="text-[10px]">OC: {detail.oc}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="truncate max-w-[150px]">{detail.proveedor}</span>
                              {detail.vencimiento && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(detail.vencimiento)}
                                </span>
                              )}
                              {detail.fechaEntrega && (
                                <span className="flex items-center gap-1">
                                  <Truck className="h-3 w-3" />
                                  {formatDate(detail.fechaEntrega)}
                                </span>
                              )}
                              {detail.fecha && (
                                <span>{formatDate(detail.fecha)}</span>
                              )}
                              {detail.items !== undefined && (
                                <span>{detail.items} items</span>
                              )}
                              {detail.solicitante && (
                                <span className="truncate max-w-[100px]">{detail.solicitante}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {detail.monto !== undefined && detail.monto > 0 && (
                              <span className="font-semibold text-sm" style={{ color: severityColors[item.severity] }}>
                                {formatCompact(detail.monto)}
                              </span>
                            )}
                            {detail.stockMinimo !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                Mín: {detail.stockMinimo}
                              </span>
                            )}
                            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Cargando detalles...
                    </div>
                  )}
                  {/* Ver todos button */}
                  <div className="p-2 border-t bg-muted/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => item.onClick()}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Ver todos ({item.count})
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {total === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: `${severityColors.success}15` }}
            >
              <Target className="h-6 w-6" style={{ color: severityColors.success }} />
            </div>
            <p className="font-medium" style={{ color: severityColors.success }}>Todo al día</p>
            <p className="text-sm text-muted-foreground">No hay pendientes en esta sección</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Mini KPI Card Component for tab headers
function MiniKpiCard({
  label,
  value,
  subValue,
  icon: Icon,
  color,
  numeric = true,
}: {
  label: string;
  value: number | string;
  subValue?: string;
  icon: React.ElementType;
  color: string;
  numeric?: boolean;
}) {
  const displayValue = numeric && typeof value === 'number' ? value : value;
  const hasValue = numeric && typeof value === 'number' ? value > 0 : !!value;

  return (
    <Card className="border">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl font-bold" style={{ color: hasValue ? color : undefined }}>{displayValue}</p>
              {subValue && (
                <span className="text-xs font-medium" style={{ color }}>{subValue}</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Stacked Progress Bar Component
function StackedProgressBar({
  segments,
  total,
}: {
  segments: { value: number; color: string; label: string }[];
  total: number;
}) {
  const safeTotal = total > 0 ? total : 1;

  return (
    <div className="space-y-2">
      <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
        {segments.map((segment, index) => {
          const width = (segment.value / safeTotal) * 100;
          if (width <= 0) return null;
          return (
            <div
              key={index}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
              style={{ width: `${width}%`, backgroundColor: segment.color }}
              title={`${segment.label}: ${segment.value}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((segment, index) => (
          segment.value > 0 && (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-muted-foreground">{segment.label}:</span>
              <span className="font-medium">{segment.value}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
