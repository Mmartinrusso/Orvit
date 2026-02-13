'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermission } from '@/hooks/use-permissions';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  Package,
  Calculator,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  RefreshCcw,
  Zap,
  ChevronRight,
  Truck,
  ShoppingBag,
  CreditCard,
  Target,
  Brain,
  Shield,
  Activity,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  BarChart3,
  AlertCircle,
  Info,
} from 'lucide-react';

// Import modals
import { ProductCreateDialog } from '@/components/ventas/product-create-dialog';
import { ClientFormDialog } from '@/components/ventas/client-form-dialog';
import { QuoteQuickModal } from '@/components/ventas/quote-quick-modal';
import dynamic from 'next/dynamic';

// Charts
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

// Dynamic import para modales pesados
const SaleModal = dynamic(() => import('@/components/ventas/sale-modal').then(m => m.SaleModal), {
  ssr: false
});

// Advanced dashboard data types
interface AdvancedDashboardData {
  kpis: {
    ventasMes: number;
    ventasMesAnterior: number;
    ventasCrecimiento: number;
    entregasPendientes: number;
    entregasEnTransito: number;
    cobranzasMes: number;
    cobranzasPendientes: number;
    ordenesActivasCount: number;
    cotizacionesPendientes: number;
    tasaConversion: number;
    cumplimientoEntregas: number;
    alertasRiesgo: number;
  };
  mlInsights: {
    demandForecast: {
      nextMonthTotal: number;
      trend: 'up' | 'down' | 'stable';
      confidence: number;
      topProducts: Array<{
        productId: number;
        productName: string;
        forecast: number;
        trend: string;
      }>;
    };
    creditRisk: {
      clientsAtRisk: number;
      totalExposure: number;
      averageScore: number;
      topRisks: Array<{
        clientId: number;
        clientName: string;
        score: number;
        rating: string;
        exposure: number;
      }>;
    };
    churnPrediction: {
      clientsAtRisk: number;
      valueAtRisk: number;
      topChurnRisks: Array<{
        clientId: number;
        clientName: string;
        churnProbability: number;
        lifetimeValue: number;
      }>;
    };
    anomalyDetection: {
      suspiciousTransactions: number;
      flaggedAmount: number;
      recentAnomalies: Array<{
        type: string;
        description: string;
        severity: string;
        timestamp: Date;
      }>;
    };
  };
  charts: {
    ventasTrend: Array<{
      fecha: string;
      ventas: number;
      forecast?: number;
    }>;
    cobranzasTrend: Array<{
      fecha: string;
      cobrado: number;
      pendiente: number;
    }>;
    entregasStatus: Array<{
      estado: string;
      count: number;
      percentage: number;
    }>;
    topClientes: Array<{
      clientId: number;
      legalName: string;
      totalVentas: number;
      creditScore: number;
      creditRating: string;
      churnRisk: number;
    }>;
  };
  alerts: Array<{
    id: string;
    type: 'urgent' | 'important' | 'info';
    category: 'credit' | 'delivery' | 'sales' | 'churn' | 'anomaly';
    title: string;
    description: string;
    actionUrl?: string;
    timestamp: Date;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'sale' | 'quote' | 'delivery' | 'payment';
    description: string;
    amount?: number;
    timestamp: Date;
    clientName?: string;
  }>;
}

// Hook para obtener datos avanzados del dashboard
function useAdvancedDashboard() {
  return useQuery<AdvancedDashboardData>({
    queryKey: ['ventas', 'dashboard', 'advanced'],
    queryFn: async () => {
      const response = await fetch('/api/ventas/dashboard/advanced');
      if (!response.ok) {
        throw new Error('Error al cargar dashboard avanzado');
      }
      return response.json();
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // Auto-refresh every 2 minutes
  });
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function VentasPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useAdvancedDashboard();

  // Estados para controlar modales
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);

  const { hasPermission: canViewClients } = usePermission('ventas.clientes.view');
  const { hasPermission: canViewProducts } = usePermission('ventas.productos.view');
  const { hasPermission: canViewQuotes } = usePermission('ventas.cotizaciones.view');
  const { hasPermission: canViewSales } = usePermission('ventas.ventas.view');
  const { hasPermission: canCreateProduct } = usePermission('ventas.productos.create');
  const { hasPermission: canCreateQuote } = usePermission('ventas.cotizaciones.create');
  const { hasPermission: canCreateClient } = usePermission('ventas.clientes.create');

  const handleProductCreated = () => {
    setIsProductDialogOpen(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const handleClientCreated = () => {
    setIsClientDialogOpen(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  const handleQuoteCreated = () => {
    setIsQuoteModalOpen(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
  };

  const handleSaleCreated = () => {
    setIsSaleModalOpen(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['sales'] });
  };

  const shortcuts = [
    { label: 'Nueva Cotización', icon: Calculator, action: () => setIsQuoteModalOpen(true), show: canCreateQuote },
    { label: 'Nuevo Producto', icon: Package, action: () => setIsProductDialogOpen(true), show: canCreateProduct },
    { label: 'Nuevo Cliente', icon: Users, action: () => setIsClientDialogOpen(true), show: canCreateClient },
    { label: 'Nueva Venta', icon: ShoppingBag, action: () => setIsSaleModalOpen(true), show: canViewSales },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <PermissionGuard permission="ventas.dashboard.view">
        <div className="space-y-6">
          <div className="border-b border-border pb-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="ventas.dashboard.view">
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              Dashboard de Ventas con IA
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Analytics avanzado con Machine Learning y predicciones en tiempo real
            </p>
          </div>
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
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="ml-insights">
            <Sparkles className="w-4 h-4 mr-2" />
            Insights IA
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <Activity className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          {/* KPI Cards - Grid 1: Main Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ventas del Mes */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Ventas del Mes</p>
                    <p className="text-2xl font-bold mt-1 text-blue-900 dark:text-blue-100">
                      {formatCurrency(data?.kpis.ventasMes || 0)}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {data?.kpis.ventasCrecimiento >= 0 ? (
                        <ArrowUpRight className="w-3 h-3 text-green-600" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-red-600" />
                      )}
                      <span className={cn(
                        "text-xs font-medium",
                        data?.kpis.ventasCrecimiento >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatPercent(data?.kpis.ventasCrecimiento || 0)} vs mes anterior
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-200 dark:bg-blue-800">
                    <DollarSign className="h-4 w-4 text-blue-700 dark:text-blue-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Entregas Pendientes */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/administracion/ventas/entregas')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Entregas Pendientes</p>
                    <p className="text-2xl font-bold mt-1">{data?.kpis.entregasPendientes || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {data?.kpis.entregasEnTransito || 0} en tránsito
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <Truck className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cobranzas del Mes */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/administracion/ventas/cobranzas')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Cobrado este Mes</p>
                    <p className="text-2xl font-bold mt-1 text-green-600">
                      {formatCurrency(data?.kpis.cobranzasMes || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(data?.kpis.cobranzasPendientes || 0)} pendiente
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <CreditCard className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Órdenes de Carga */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/administracion/ventas/ordenes-carga')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Órdenes Activas</p>
                    <p className="text-2xl font-bold mt-1">{data?.kpis.ordenesActivasCount || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">En preparación/tránsito</p>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                    <Package className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KPI Cards - Grid 2: Performance Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cotizaciones Pendientes */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => canViewQuotes && router.push('/administracion/ventas/cotizaciones')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Cotizaciones Pendientes</p>
                    <p className="text-2xl font-bold mt-1">{data?.kpis.cotizacionesPendientes || 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                    <Calculator className="h-4 w-4 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tasa de Conversión */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Tasa de Conversión</p>
                    <p className="text-2xl font-bold mt-1">{data?.kpis.tasaConversion.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Cotiz. → Ventas</p>
                  </div>
                  <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/20">
                    <Target className="h-4 w-4 text-cyan-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cumplimiento Entregas */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Cumplimiento Entregas</p>
                    <p className="text-2xl font-bold mt-1 text-green-600">
                      {data?.kpis.cumplimientoEntregas.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">On-time delivery</p>
                  </div>
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alertas de Riesgo IA */}
            <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('#alerts')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-red-700 dark:text-red-300">Alertas de Riesgo IA</p>
                    <p className="text-2xl font-bold mt-1 text-red-900 dark:text-red-100">
                      {data?.kpis.alertasRiesgo || 0}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">Requieren atención</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-200 dark:bg-red-800">
                    <Shield className="h-4 w-4 text-red-700 dark:text-red-200" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Acciones Rápidas */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Acciones Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex flex-wrap gap-2">
                {shortcuts.filter(s => s.show).map((shortcut, index) => {
                  const Icon = shortcut.icon;
                  return (
                    <Button
                      key={`${shortcut.label}-${index}`}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2"
                      onClick={shortcut.action}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {shortcut.label}
                    </Button>
                  );
                })}
                <div className="h-8 w-px bg-border mx-1" />
                {canViewSales && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => router.push('/administracion/ventas/ventas')}>
                    Ventas <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => router.push('/administracion/ventas/ordenes')}>
                  Órdenes <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => router.push('/administracion/ventas/facturas')}>
                  Facturas <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Alertas Inteligentes */}
          <Card id="alerts">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Alertas Inteligentes (IA)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.alerts && data.alerts.length > 0 ? (
                  data.alerts.slice(0, 5).map((alert) => {
                    const typeConfig = {
                      urgent: {
                        bg: 'bg-red-50 dark:bg-red-900/20',
                        border: 'border-red-200 dark:border-red-800',
                        hover: 'hover:bg-red-100 dark:hover:bg-red-900/30',
                        icon: <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
                        textColor: 'text-red-900 dark:text-red-100',
                      },
                      important: {
                        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
                        border: 'border-yellow-200 dark:border-yellow-800',
                        hover: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
                        icon: <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />,
                        textColor: 'text-yellow-900 dark:text-yellow-100',
                      },
                      info: {
                        bg: 'bg-blue-50 dark:bg-blue-900/20',
                        border: 'border-blue-200 dark:border-blue-800',
                        hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
                        icon: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
                        textColor: 'text-blue-900 dark:text-blue-100',
                      },
                    };

                    const config = typeConfig[alert.type];

                    return (
                      <div
                        key={alert.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                          config.bg,
                          config.border,
                          config.hover
                        )}
                        onClick={() => alert.actionUrl && router.push(alert.actionUrl)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {config.icon}
                          <div>
                            <p className={cn("text-sm font-medium", config.textColor)}>{alert.title}</p>
                            <p className="text-xs text-muted-foreground">{alert.description}</p>
                          </div>
                        </div>
                        {alert.actionUrl && (
                          <Button variant="ghost" size="sm" className="text-xs h-7">
                            Ver
                          </Button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                    <span className="text-sm">Todo en orden - Sin alertas pendientes</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.recentActivity && data.recentActivity.length > 0 ? (
                  data.recentActivity.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-primary/10">
                          <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{activity.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.timestamp).toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                      {activity.amount && (
                        <span className="text-sm font-semibold text-primary">
                          {formatCurrency(activity.amount)}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">Sin actividad reciente</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ML INSIGHTS TAB */}
        <TabsContent value="ml-insights" className="space-y-4">
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <strong>Machine Learning Activado:</strong> Estos insights se generan con modelos de IA entrenados con datos históricos de su empresa.
            </AlertDescription>
          </Alert>

          {/* Demand Forecast */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Pronóstico de Demanda (Próximo Mes)
              </CardTitle>
              <CardDescription>
                Predicción basada en Exponential Smoothing y análisis de tendencias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">Demanda Proyectada Total</p>
                    <p className="text-3xl font-bold text-primary">
                      {data?.mlInsights.demandForecast.nextMonthTotal.toFixed(0)} unidades
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {data?.mlInsights.demandForecast.trend === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : data?.mlInsights.demandForecast.trend === 'down' ? (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      ) : null}
                      <span className="text-sm text-muted-foreground">
                        Tendencia: {data?.mlInsights.demandForecast.trend === 'up' ? 'Creciente' : data?.mlInsights.demandForecast.trend === 'down' ? 'Decreciente' : 'Estable'}
                      </span>
                      <Badge variant="outline">
                        {data?.mlInsights.demandForecast.confidence}% confianza
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Top Productos - Próximo Mes</p>
                    <div className="space-y-2">
                      {data?.mlInsights.demandForecast.topProducts.map((product) => (
                        <div key={product.productId} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{product.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              Tendencia: {product.trend === 'up' ? '📈 Creciente' : product.trend === 'down' ? '📉 Decreciente' : '➡️ Estable'}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {product.forecast.toFixed(0)} un.
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-3">Recomendaciones</p>
                  <div className="space-y-2">
                    {data?.mlInsights.demandForecast.trend === 'up' && (
                      <Alert>
                        <TrendingUp className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Demanda Creciente:</strong> Considerar aumentar stock y capacidad de producción.
                        </AlertDescription>
                      </Alert>
                    )}
                    {data?.mlInsights.demandForecast.trend === 'down' && (
                      <Alert>
                        <TrendingDown className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Demanda Decreciente:</strong> Revisar estrategia comercial y promociones.
                        </AlertDescription>
                      </Alert>
                    )}
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Preparar compras y producción según demanda proyectada para optimizar inventarios.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credit Risk */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-600" />
                Análisis de Riesgo Crediticio
              </CardTitle>
              <CardDescription>
                Scoring basado en Logistic Regression y Decision Trees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-sm text-muted-foreground">Clientes en Riesgo</p>
                  <p className="text-3xl font-bold text-red-600">{data?.mlInsights.creditRisk.clientsAtRisk || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <p className="text-sm text-muted-foreground">Exposición Total</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(data?.mlInsights.creditRisk.totalExposure || 0)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-sm text-muted-foreground">Score Promedio</p>
                  <p className="text-3xl font-bold text-green-600">
                    {data?.mlInsights.creditRisk.averageScore.toFixed(0)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Clientes con Mayor Riesgo</p>
                <div className="space-y-2">
                  {data?.mlInsights.creditRisk.topRisks && data.mlInsights.creditRisk.topRisks.length > 0 ? (
                    data.mlInsights.creditRisk.topRisks.map((risk) => (
                      <div
                        key={risk.clientId}
                        className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer transition-colors"
                        onClick={() => router.push(`/administracion/ventas/clientes/${risk.clientId}`)}
                      >
                        <div>
                          <p className="text-sm font-medium">{risk.clientName}</p>
                          <p className="text-xs text-muted-foreground">
                            Exposición: {formatCurrency(risk.exposure)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={risk.rating === 'D' ? 'destructive' : 'secondary'}>
                            {risk.rating}
                          </Badge>
                          <span className="text-sm font-bold text-red-600">{risk.score}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin clientes de alto riesgo</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Churn Prediction */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Predicción de Abandono de Clientes
              </CardTitle>
              <CardDescription>
                Random Forest ensemble para predecir riesgo de churn
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <p className="text-sm text-muted-foreground">Clientes en Riesgo de Pérdida</p>
                  <p className="text-3xl font-bold text-orange-600">{data?.mlInsights.churnPrediction.clientsAtRisk || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-sm text-muted-foreground">Valor en Riesgo (LTV)</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(data?.mlInsights.churnPrediction.valueAtRisk || 0)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Clientes con Mayor Riesgo de Abandono</p>
                <div className="space-y-2">
                  {data?.mlInsights.churnPrediction.topChurnRisks && data.mlInsights.churnPrediction.topChurnRisks.length > 0 ? (
                    data.mlInsights.churnPrediction.topChurnRisks.map((churn) => (
                      <div
                        key={churn.clientId}
                        className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 cursor-pointer transition-colors"
                        onClick={() => router.push(`/administracion/ventas/clientes/${churn.clientId}`)}
                      >
                        <div>
                          <p className="text-sm font-medium">{churn.clientName}</p>
                          <p className="text-xs text-muted-foreground">
                            Lifetime Value: {formatCurrency(churn.lifetimeValue)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={churn.churnProbability > 80 ? 'destructive' : 'secondary'}>
                            {churn.churnProbability.toFixed(0)}% riesgo
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin clientes en riesgo de abandono</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Anomaly Detection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                Detección de Anomalías
              </CardTitle>
              <CardDescription>
                Isolation Forest para detectar transacciones sospechosas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <p className="text-sm text-muted-foreground">Transacciones Sospechosas</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {data?.mlInsights.anomalyDetection.suspiciousTransactions || 0}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <p className="text-sm text-muted-foreground">Monto Total Marcado</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(data?.mlInsights.anomalyDetection.flaggedAmount || 0)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Anomalías Recientes</p>
                <div className="space-y-2">
                  {data?.mlInsights.anomalyDetection.recentAnomalies && data.mlInsights.anomalyDetection.recentAnomalies.length > 0 ? (
                    data.mlInsights.anomalyDetection.recentAnomalies.map((anomaly, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-900/20"
                      >
                        <div>
                          <p className="text-sm font-medium">{anomaly.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(anomaly.timestamp).toLocaleString('es-AR')}
                          </p>
                        </div>
                        <Badge variant={anomaly.severity === 'high' ? 'destructive' : 'secondary'}>
                          {anomaly.severity}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin anomalías detectadas</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Ventas Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendencia de Ventas (Últimos 30 días)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data?.charts.ventasTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ fontSize: 12 }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    name="Ventas"
                    stroke={COLORS.primary}
                    fill={COLORS.primary}
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Entregas Status Pie Chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estado de Entregas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data?.charts.entregasStatus || []}
                      dataKey="count"
                      nameKey="estado"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => `${entry.estado}: ${entry.count}`}
                    >
                      {data?.charts.entregasStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Clientes Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Clientes con Score IA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {data?.charts.topClientes && data.charts.topClientes.length > 0 ? (
                    data.charts.topClientes.map((client) => (
                      <div
                        key={client.clientId}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/administracion/ventas/clientes/${client.clientId}`)}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{client.legalName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(client.totalVentas)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{client.creditRating}</Badge>
                          <Badge variant={client.churnRisk > 60 ? 'destructive' : 'secondary'}>
                            {client.churnRisk.toFixed(0)}% churn
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin datos de clientes</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modales */}
      <ProductCreateDialog
        open={isProductDialogOpen}
        onOpenChange={setIsProductDialogOpen}
        onProductCreated={handleProductCreated}
      />

      <ClientFormDialog
        open={isClientDialogOpen}
        onOpenChange={setIsClientDialogOpen}
        onClientCreated={handleClientCreated}
      />

      <QuoteQuickModal
        open={isQuoteModalOpen}
        onOpenChange={setIsQuoteModalOpen}
        onQuoteCreated={handleQuoteCreated}
      />

      {isSaleModalOpen && (
        <SaleModal
          open={isSaleModalOpen}
          onOpenChange={setIsSaleModalOpen}
          onSaleCreated={handleSaleCreated}
        />
      )}
    </div>
    </PermissionGuard>
  );
}
