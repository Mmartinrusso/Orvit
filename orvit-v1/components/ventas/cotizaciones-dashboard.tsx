'use client';

import { useState, useEffect, useMemo } from 'react';
import { DEFAULT_COLORS } from '@/lib/colors';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Clock,
  AlertTriangle,
  Users,
  UserCheck,
  Loader2,
  RefreshCw,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Trend value from API
interface TrendValue {
  valor: number;
  variacion: number;
  tendencia: 'up' | 'down' | 'stable';
}

interface DashboardStats {
  periodo: {
    desde: string;
    hasta: string;
  };
  totales: {
    cantidad: TrendValue;
    montoTotal: TrendValue;
    promedioMonto: TrendValue;
  };
  porEstado: {
    BORRADOR: number;
    ENVIADA: number;
    EN_NEGOCIACION: number;
    ACEPTADA: number;
    CONVERTIDA: number;
    PERDIDA: number;
    VENCIDA: number;
  };
  conversion: {
    enviadas: TrendValue;
    aceptadas: TrendValue;
    convertidas: number;
    perdidas: number;
    tasaAceptacion: TrendValue;
    tasaConversion: number;
    tasaPerdida: number;
  };
  tiempos: {
    promedioEnvio: number | null;
    promedioCierre: number | null;
    promedioConversion: number | null;
  };
  topClientes: Array<{
    id: string;
    nombre: string;
    cotizaciones: number;
    aceptadas: number;
    montoTotal: number;
  }>;
  topVendedores: Array<{
    id: number;
    nombre: string;
    cotizaciones: number;
    aceptadas: number;
    tasaAceptacion: number;
    montoTotal: number;
  }>;
  porVencer: {
    cantidad: number;
    items: Array<{
      id: number;
      numero: string;
      cliente: string;
      fechaValidez: string;
      diasRestantes: number;
      total: number;
    }>;
  };
  evolucionMensual: Array<{
    mes: string;
    enviadas: number;
    aceptadas: number;
    perdidas: number;
    montoTotal: number;
  }>;
}

interface GraficoTemporalData {
  data: Array<{
    mes: string;
    cotizaciones: number;
    cotizacionesMonto: number;
    ventas: number;
    ventasMonto: number;
    cobranzas: number;
    cobranzasMonto: number;
  }>;
}

// Colores dinámicos - DEFAULT_COLORS del sistema


const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: '#9ca3af',
  ENVIADA: DEFAULT_COLORS.chart1,
  EN_NEGOCIACION: DEFAULT_COLORS.chart4,
  ACEPTADA: DEFAULT_COLORS.chart5,
  CONVERTIDA: DEFAULT_COLORS.chart2,
  PERDIDA: DEFAULT_COLORS.kpiNegative,
  VENCIDA: '#d1d5db',
};

const estadoLabels: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  EN_NEGOCIACION: 'Negociación',
  ACEPTADA: 'Aceptada',
  CONVERTIDA: 'Convertida',
  PERDIDA: 'Perdida',
  VENCIDA: 'Vencida',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatCurrencyCompact(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return formatCurrency(amount);
}

// Componente indicador de tendencia
function TrendIndicator({ trend }: { trend: TrendValue }) {
  if (trend.tendencia === 'stable') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: DEFAULT_COLORS.kpiNeutral }}>
        <Minus className="w-3 h-3" />
        <span>{trend.variacion > 0 ? '+' : ''}{trend.variacion.toFixed(1)}%</span>
      </span>
    );
  }

  if (trend.tendencia === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: DEFAULT_COLORS.kpiPositive }}>
        <TrendingUp className="w-3 h-3" />
        <span>+{trend.variacion.toFixed(1)}%</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: DEFAULT_COLORS.kpiNegative }}>
      <TrendingDown className="w-3 h-3" />
      <span>{trend.variacion.toFixed(1)}%</span>
    </span>
  );
}

export function CotizacionesDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [graficoTemporal, setGraficoTemporal] = useState<GraficoTemporalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingGrafico, setLoadingGrafico] = useState(true);
  const [periodo, setPeriodo] = useState('30d');

  useEffect(() => {
    fetchStats();
  }, [periodo]);

  useEffect(() => {
    fetchGraficoTemporal();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ventas/cotizaciones/stats?periodo=${periodo}`);
      if (!response.ok) throw new Error('Error al cargar estadísticas');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGraficoTemporal = async () => {
    try {
      setLoadingGrafico(true);
      const response = await fetch('/api/ventas/dashboard/grafico-temporal');
      if (!response.ok) throw new Error('Error al cargar gráfico temporal');
      const data = await response.json();
      setGraficoTemporal(data);
    } catch (error) {
      console.error('Error fetching grafico temporal:', error);
    } finally {
      setLoadingGrafico(false);
    }
  };

  // Datos formateados para gráfico temporal de líneas
  const temporalChartData = useMemo(() => {
    if (!graficoTemporal?.data) return [];
    return graficoTemporal.data.map(item => ({
      mes: format(new Date(item.mes + '-01'), 'MMM yy', { locale: es }),
      cotizaciones: item.cotizacionesMonto,
      ventas: item.ventasMonto,
      cobranzas: item.cobranzasMonto,
    }));
  }, [graficoTemporal]);

  // Datos para gráfico de barras comparativo (período actual vs anterior)
  const comparativaData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        nombre: 'Cotizaciones',
        actual: stats.totales.cantidad.valor,
        anterior: stats.totales.cantidad.variacion !== 0
          ? Math.round(stats.totales.cantidad.valor / (1 + stats.totales.cantidad.variacion / 100))
          : stats.totales.cantidad.valor,
      },
      {
        nombre: 'Enviadas',
        actual: stats.conversion.enviadas.valor,
        anterior: stats.conversion.enviadas.variacion !== 0
          ? Math.round(stats.conversion.enviadas.valor / (1 + stats.conversion.enviadas.variacion / 100))
          : stats.conversion.enviadas.valor,
      },
      {
        nombre: 'Aceptadas',
        actual: stats.conversion.aceptadas.valor,
        anterior: stats.conversion.aceptadas.variacion !== 0
          ? Math.round(stats.conversion.aceptadas.valor / (1 + stats.conversion.aceptadas.variacion / 100))
          : stats.conversion.aceptadas.valor,
      },
    ];
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <FileText className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Error al cargar estadísticas</p>
        <Button onClick={fetchStats} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  // Preparar datos para gráfico de pie
  const pieData = Object.entries(stats.porEstado)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      name: estadoLabels[key],
      value,
      color: ESTADO_COLORS[key] || '#9ca3af',
    }));

  // Preparar datos para gráfico de evolución
  const evolucionData = stats.evolucionMensual.map(item => ({
    mes: format(new Date(item.mes + '-01'), 'MMM', { locale: es }),
    enviadas: item.enviadas,
    aceptadas: item.aceptadas,
    perdidas: item.perdidas,
    monto: item.montoTotal,
  }));

  // Funnel data
  const funnelData = [
    { name: 'Enviadas', value: stats.conversion.enviadas.valor, color: DEFAULT_COLORS.chart1 },
    { name: 'Aceptadas', value: stats.conversion.aceptadas.valor, color: DEFAULT_COLORS.chart5 },
    { name: 'Convertidas', value: stats.conversion.convertidas, color: DEFAULT_COLORS.chart2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Cotizaciones</h2>
          <p className="text-muted-foreground">
            {format(new Date(stats.periodo.desde), "dd MMM", { locale: es })} - {format(new Date(stats.periodo.hasta), "dd MMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="90d">90 días</SelectItem>
              <SelectItem value="1y">1 año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchStats}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPIs con tendencias */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Total Cotizaciones
                </p>
                <p className="text-2xl font-bold">{stats.totales.cantidad.valor}</p>
                <div className="flex items-center gap-2 mt-1">
                  <TrendIndicator trend={stats.totales.cantidad} />
                  <span className="text-xs text-muted-foreground">vs período ant.</span>
                </div>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${DEFAULT_COLORS.chart1}15` }}
              >
                <FileText className="h-5 w-5" style={{ color: DEFAULT_COLORS.chart1 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Monto Total
                </p>
                <p className="text-2xl font-bold">{formatCurrencyCompact(stats.totales.montoTotal.valor)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <TrendIndicator trend={stats.totales.montoTotal} />
                  <span className="text-xs text-muted-foreground">vs período ant.</span>
                </div>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${DEFAULT_COLORS.chart5}15` }}
              >
                <DollarSign className="h-5 w-5" style={{ color: DEFAULT_COLORS.chart5 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Tasa Aceptación
                </p>
                <p className="text-2xl font-bold">{stats.conversion.tasaAceptacion.valor.toFixed(1)}%</p>
                <div className="flex items-center gap-2 mt-1">
                  <TrendIndicator trend={stats.conversion.tasaAceptacion} />
                  <span className="text-xs text-muted-foreground">
                    {stats.conversion.aceptadas.valor} de {stats.conversion.enviadas.valor}
                  </span>
                </div>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${DEFAULT_COLORS.chart2}15` }}
              >
                <TrendingUp className="h-5 w-5" style={{ color: DEFAULT_COLORS.chart2 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Tiempo Promedio
                </p>
                <p className="text-2xl font-bold">
                  {stats.tiempos.promedioCierre ? `${stats.tiempos.promedioCierre}d` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Días hasta cierre
                </p>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${DEFAULT_COLORS.chart6}15` }}
              >
                <Clock className="h-5 w-5" style={{ color: DEFAULT_COLORS.chart6 }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Por Vencer Alert */}
      {stats.porVencer.cantidad > 0 && (
        <Card style={{
          borderColor: `${DEFAULT_COLORS.chart4}50`,
          backgroundColor: `${DEFAULT_COLORS.chart4}08`
        }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2" style={{ color: DEFAULT_COLORS.chart4 }}>
              <AlertTriangle className="w-4 h-4" />
              {stats.porVencer.cantidad} cotizaciones por vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.porVencer.items.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{item.numero}</span>
                    <span className="text-muted-foreground">{item.cliente}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(item.total)}</span>
                    <Badge variant={item.diasRestantes <= 1 ? 'destructive' : 'secondary'}>
                      {item.diasRestantes === 0 ? 'Hoy' : item.diasRestantes === 1 ? 'Mañana' : `${item.diasRestantes}d`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evolución Temporal 12 meses (ventas/cotizaciones/cobranzas) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: DEFAULT_COLORS.chart1 }} />
            Evolución Temporal (12 meses)
          </CardTitle>
          <CardDescription>Montos de cotizaciones, ventas y cobranzas por mes</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingGrafico ? (
            <div className="flex items-center justify-center h-72">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : temporalChartData.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-72 text-muted-foreground">
              <BarChart3 className="w-8 h-8 mb-2" />
              <p className="text-sm">No hay datos suficientes (mínimo 2 meses)</p>
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={temporalChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cotizaciones"
                    stroke={DEFAULT_COLORS.chart1}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Cotizaciones"
                  />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke={DEFAULT_COLORS.chart5}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Ventas"
                  />
                  <Line
                    type="monotone"
                    dataKey="cobranzas"
                    stroke={DEFAULT_COLORS.chart3}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Cobranzas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row: Comparativa + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comparativa Período Actual vs Anterior */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Período Actual vs Anterior</CardTitle>
            <CardDescription>Comparativa de cantidades entre períodos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativaData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar
                    dataKey="anterior"
                    fill={`${DEFAULT_COLORS.chart1}50`}
                    name="Período anterior"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="actual"
                    fill={DEFAULT_COLORS.chart1}
                    name="Período actual"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Funnel de Conversión */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Funnel de Conversión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelData.map((item, idx) => {
                const maxValue = Math.max(...funnelData.map(f => f.value));
                const width = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                    <div className="h-8 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${width}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                    {idx < funnelData.length - 1 && (
                      <div className="flex justify-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="pt-2 border-t">
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <p className="text-muted-foreground">Tasa Aceptación</p>
                    <p className="font-semibold" style={{ color: DEFAULT_COLORS.chart5 }}>
                      {stats.conversion.tasaAceptacion.valor.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tasa Conversión</p>
                    <p className="font-semibold" style={{ color: DEFAULT_COLORS.chart2 }}>
                      {stats.conversion.tasaConversion.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tasa Pérdida</p>
                    <p className="font-semibold" style={{ color: DEFAULT_COLORS.kpiNegative }}>
                      {stats.conversion.tasaPerdida.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row: Pie + Evolución mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Estado (Pie) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => [value, 'Cotizaciones']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Evolución Mensual (cotizaciones) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolución Mensual</CardTitle>
            <CardDescription>Cotizaciones enviadas, aceptadas y perdidas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="enviadas"
                    stroke={DEFAULT_COLORS.chart1}
                    strokeWidth={2}
                    name="Enviadas"
                  />
                  <Line
                    type="monotone"
                    dataKey="aceptadas"
                    stroke={DEFAULT_COLORS.chart5}
                    strokeWidth={2}
                    name="Aceptadas"
                  />
                  <Line
                    type="monotone"
                    dataKey="perdidas"
                    stroke={DEFAULT_COLORS.kpiNegative}
                    strokeWidth={2}
                    name="Perdidas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: DEFAULT_COLORS.chart5 }} />
              Top Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topClientes.length > 0 ? (
                stats.topClientes.map((cliente, idx) => (
                  <div key={cliente.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">{cliente.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {cliente.cotizaciones} cotizaciones ({cliente.aceptadas} aceptadas)
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold" style={{ color: DEFAULT_COLORS.chart5 }}>
                      {formatCurrencyCompact(cliente.montoTotal)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">Sin datos</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Vendedores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCheck className="w-4 h-4" style={{ color: DEFAULT_COLORS.chart2 }} />
              Top Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topVendedores.length > 0 ? (
                stats.topVendedores.map((vendedor, idx) => (
                  <div key={vendedor.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">{vendedor.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {vendedor.cotizaciones} cot. | {vendedor.tasaAceptacion.toFixed(0)}% aceptación
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold" style={{ color: DEFAULT_COLORS.chart2 }}>
                      {formatCurrencyCompact(vendedor.montoTotal)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">Sin datos</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
