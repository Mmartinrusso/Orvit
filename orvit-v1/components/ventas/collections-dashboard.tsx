'use client';

/**
 * Collections Analytics Dashboard
 *
 * Visual dashboard with charts and KPIs for collections/payments:
 * - Collection trends
 * - Payment methods breakdown
 * - Top clients
 * - Aging analysis
 * - DSO and efficiency metrics
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Clock,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardData {
  // KPIs
  totalCobrado: number;
  cantidadPagos: number;
  promedioCobranza: number;
  promedioTiempoCobranza: number;
  totalPendiente: number;
  montoVencido: number;
  facturasVencidas: number;
  eficienciaCobranza: number;
  dso: number;

  // Charts
  trends: Array<{
    mes: string;
    cobrado: number;
    cantidad: number;
  }>;

  porMedio: {
    efectivo: number;
    transferencia: number;
    chequesTerceros: number;
    chequesPropios: number;
    tarjetaCredito: number;
    tarjetaDebito: number;
    otrosMedios: number;
  };

  topClients: Array<{
    clientName: string;
    totalCobrado: number;
    cantidadPagos: number;
  }>;

  aging: {
    vigente: number;
    vencido1_30: number;
    vencido31_60: number;
    vencido61_90: number;
    vencido90Plus: number;
  };

  byStatus: Array<{
    estado: string;
    count: number;
    monto: number;
  }>;

  // Metadata
  period: string;
  startDate: string;
  endDate: string;
}

export function CollectionsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ventas/pagos/analytics?period=${period}`);
      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      } else {
        console.error('Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-muted-foreground">No hay datos disponibles</div>;
  }

  // Prepare chart data
  const trendChartData = {
    labels: data.trends.map((t) => t.mes),
    datasets: [
      {
        label: 'Cobrado',
        data: data.trends.map((t) => t.cobrado),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const paymentMethodsData = {
    labels: [
      'Efectivo',
      'Transferencia',
      'Cheques Terceros',
      'Cheques Propios',
      'Tarjeta Crédito',
      'Tarjeta Débito',
      'Otros',
    ],
    datasets: [
      {
        data: [
          data.porMedio.efectivo,
          data.porMedio.transferencia,
          data.porMedio.chequesTerceros,
          data.porMedio.chequesPropios,
          data.porMedio.tarjetaCredito,
          data.porMedio.tarjetaDebito,
          data.porMedio.otrosMedios,
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.7)', // Efectivo - green
          'rgba(59, 130, 246, 0.7)', // Transferencia - blue
          'rgba(251, 191, 36, 0.7)', // Cheques Terceros - amber
          'rgba(251, 146, 60, 0.7)', // Cheques Propios - orange
          'rgba(168, 85, 247, 0.7)', // TC - purple
          'rgba(236, 72, 153, 0.7)', // TD - pink
          'rgba(156, 163, 175, 0.7)', // Otros - gray
        ],
      },
    ],
  };

  const topClientsChartData = {
    labels: data.topClients.slice(0, 10).map((c) => c.clientName.substring(0, 20)),
    datasets: [
      {
        label: 'Total Cobrado',
        data: data.topClients.slice(0, 10).map((c) => c.totalCobrado),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
      },
    ],
  };

  const agingChartData = {
    labels: ['Vigente', '1-30 días', '31-60 días', '61-90 días', '+90 días'],
    datasets: [
      {
        data: [
          data.aging.vigente,
          data.aging.vencido1_30,
          data.aging.vencido31_60,
          data.aging.vencido61_90,
          data.aging.vencido90Plus,
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.7)',
          'rgba(251, 191, 36, 0.7)',
          'rgba(251, 146, 60, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(127, 29, 29, 0.7)',
        ],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Cobranzas</h2>
          <p className="text-sm text-muted-foreground">
            Análisis de cobranzas y métricas de rendimiento
          </p>
        </div>
        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Seleccionar período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Este mes</SelectItem>
            <SelectItem value="quarter">Este trimestre</SelectItem>
            <SelectItem value="year">Este año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cobrado */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Cobrado</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(data.totalCobrado)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.cantidadPagos} cobros registrados
            </p>
          </CardContent>
        </Card>

        {/* Promedio de Cobranza */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Promedio por Cobro</CardTitle>
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.promedioCobranza)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tiempo promedio: {data.promedioTiempoCobranza} días
            </p>
          </CardContent>
        </Card>

        {/* Pendiente de Cobro */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pendiente de Cobro</CardTitle>
            <Clock className="w-4 h-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-muted-foreground">
              {formatCurrency(data.totalPendiente)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Por cobrar de facturas emitidas
            </p>
          </CardContent>
        </Card>

        {/* Eficiencia */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Eficiencia de Cobranza</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info-muted-foreground">{data.eficienciaCobranza}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Del total facturado en el período
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Row 2 - Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DSO */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">DSO (Days Sales Outstanding)</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.dso} días</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tiempo promedio de cobro de ventas
            </p>
            <div className="mt-2">
              {data.dso <= 30 && (
                <Badge className="bg-success-muted text-success">Excelente</Badge>
              )}
              {data.dso > 30 && data.dso <= 60 && (
                <Badge className="bg-warning-muted text-warning-muted-foreground">Bueno</Badge>
              )}
              {data.dso > 60 && (
                <Badge className="bg-destructive/10 text-destructive">Necesita atención</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vencido */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Monto Vencido</CardTitle>
            <AlertCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(data.montoVencido)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.facturasVencidas} facturas vencidas
            </p>
          </CardContent>
        </Card>

        {/* Tasa de Cobranza */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Tasa de Cobranza</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {data.totalCobrado > 0 && data.totalPendiente + data.totalCobrado > 0
                ? formatNumber(
                    (data.totalCobrado / (data.totalCobrado + data.totalPendiente)) *
                    100, 1)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Del total a cobrar (facturado + pendiente)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución de Cobranzas</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Line data={trendChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cobranzas por Medio de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Doughnut data={paymentMethodsData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Aging Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Análisis de Antigüedad (Aging)</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Doughnut data={agingChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Clientes por Cobranza</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Bar data={topClientsChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribución por Estado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.byStatus.map((status) => (
              <div
                key={status.estado}
                className="flex items-center justify-between p-3 border rounded-md"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{status.estado}</div>
                    <div className="text-sm text-muted-foreground">{status.count} cobros</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(status.monto)}</div>
                  <div className="text-xs text-muted-foreground">
                    {data.totalCobrado > 0
                      ? formatNumber((status.monto / data.totalCobrado) * 100, 1)
                      : 0}
                    % del total
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
