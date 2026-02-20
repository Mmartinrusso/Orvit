'use client';

/**
 * Invoices Analytics Dashboard
 *
 * Visual dashboard with charts and KPIs for invoices
 * - Revenue trends
 * - Collection metrics
 * - Overdue analysis
 * - Client breakdown
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
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
  totalFacturado: number;
  totalCobrado: number;
  saldoPendiente: number;
  facturasVencidas: number;
  montoVencido: number;
  porcentajeCobrado: number;

  // Trends (last 12 months)
  trends: Array<{
    mes: string;
    facturado: number;
    cobrado: number;
    pendiente: number;
  }>;

  // By status
  byStatus: Array<{
    estado: string;
    count: number;
    monto: number;
  }>;

  // By client (top 10)
  topClients: Array<{
    clientName: string;
    totalFacturado: number;
    totalCobrado: number;
    saldoPendiente: number;
  }>;

  // Aging analysis
  aging: {
    vigente: number; // No vencidas
    vencido1_30: number; // 1-30 días
    vencido31_60: number; // 31-60 días
    vencido61_90: number; // 61-90 días
    vencido90Plus: number; // +90 días
  };
}

export function InvoicesDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ventas/facturas/dashboard?period=${period}`);
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
        label: 'Facturado',
        data: data.trends.map((t) => t.facturado),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
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

  const statusChartData = {
    labels: data.byStatus.map((s) => s.estado),
    datasets: [
      {
        label: 'Cantidad',
        data: data.byStatus.map((s) => s.count),
        backgroundColor: [
          'rgba(156, 163, 175, 0.7)', // Borrador
          'rgba(59, 130, 246, 0.7)', // Emitida
          'rgba(251, 191, 36, 0.7)', // Parcial
          'rgba(34, 197, 94, 0.7)', // Cobrada
          'rgba(239, 68, 68, 0.7)', // Anulada
        ],
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

  const topClientsChartData = {
    labels: data.topClients.slice(0, 10).map((c) => c.clientName.substring(0, 20)),
    datasets: [
      {
        label: 'Facturado',
        data: data.topClients.slice(0, 10).map((c) => c.totalFacturado),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
      },
      {
        label: 'Pendiente',
        data: data.topClients.slice(0, 10).map((c) => c.saldoPendiente),
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
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
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Facturado */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalFacturado)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.byStatus.reduce((sum, s) => sum + s.count, 0)} facturas
            </p>
          </CardContent>
        </Card>

        {/* Total Cobrado */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Cobrado</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(data.totalCobrado)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.porcentajeCobrado.toFixed(1)}% del total
            </p>
          </CardContent>
        </Card>

        {/* Saldo Pendiente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Saldo Pendiente</CardTitle>
            <Clock className="w-4 h-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-muted-foreground">
              {formatCurrency(data.saldoPendiente)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(100 - data.porcentajeCobrado).toFixed(1)}% pendiente
            </p>
          </CardContent>
        </Card>

        {/* Facturas Vencidas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Facturas Vencidas</CardTitle>
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
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución Mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Line data={trendChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Bar data={statusChartData} options={chartOptions} />
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
            <CardTitle className="text-base">Top 10 Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Bar data={topClientsChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
