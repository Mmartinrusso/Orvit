'use client';

import { useState } from 'react';
import { useClientAnalytics, type Period } from '@/hooks/use-client-analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  ShoppingCart,
  Clock,
  AlertTriangle,
  CreditCard,
  Package,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';

interface ClientAnalyticsTabProps {
  clientId: string;
}

export function ClientAnalyticsTab({ clientId }: ClientAnalyticsTabProps) {
  const [period, setPeriod] = useState<Period>('mes');
  const { data, isLoading, error } = useClientAnalytics(clientId, period, true);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Error al cargar analytics del cliente</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-600" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 75) return 'text-blue-600 bg-blue-100';
    if (score >= 60) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excelente';
    if (score >= 75) return 'Bueno';
    if (score >= 60) return 'Regular';
    return 'Riesgo';
  };

  // Detectar alertas activas
  const activeAlerts = Object.entries(data.alerts).filter(([_, value]) => value === true);

  return (
    <div className="space-y-6">
      {/* Header con selector de período */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Analytics del Cliente</h3>
          <p className="text-sm text-muted-foreground">
            Análisis de comportamiento y métricas clave
          </p>
        </div>
        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Último Mes</SelectItem>
            <SelectItem value="trimestre">Último Trimestre</SelectItem>
            <SelectItem value="semestre">Último Semestre</SelectItem>
            <SelectItem value="año">Último Año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alertas (si existen) */}
      {activeAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong className="font-semibold">Alertas activas:</strong>
            <ul className="mt-2 list-disc list-inside space-y-1">
              {data.alerts.nearCreditLimit && (
                <li>Cerca del límite de crédito ({data.creditMetrics.utilizationRate.toFixed(1)}%)</li>
              )}
              {data.alerts.exceededCreditLimit && (
                <li>Límite de crédito excedido</li>
              )}
              {data.alerts.hasOverdueInvoices && (
                <li>Facturas vencidas pendientes (${data.paymentMetrics.overdueAmount.toFixed(2)})</li>
              )}
              {data.alerts.slowPayer && (
                <li>Pagador lento (DSO: {data.paymentMetrics.dso} días)</li>
              )}
              {data.alerts.noRecentActivity && (
                <li>Sin actividad reciente</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Score de Salud */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Score de Salud del Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={cn('rounded-full w-20 h-20 flex items-center justify-center text-3xl font-bold', getScoreColor(data.score))}>
                {data.score}
              </div>
              <div>
                <p className="text-2xl font-bold">{getScoreLabel(data.score)}</p>
                <p className="text-sm text-muted-foreground">
                  Basado en puntualidad, volumen y antigüedad
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ventas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del Período</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.salesMetrics.totalRevenue)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
              {getTrendIcon(data.salesMetrics.trend)}
              <span>{data.salesMetrics.invoiceCount} facturas</span>
              {data.salesMetrics.growthRate !== 0 && (
                <Badge variant={data.salesMetrics.growthRate > 0 ? 'default' : 'destructive'} className="text-xs">
                  {data.salesMetrics.growthRate > 0 ? '+' : ''}{data.salesMetrics.growthRate.toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Ticket promedio: {formatCurrency(data.salesMetrics.averageTicket)}
            </p>
          </CardContent>
        </Card>

        {/* DSO (Days Sales Outstanding) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DSO - Días de Cobro</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.paymentMetrics.dso} días</div>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant={data.paymentMetrics.punctualityRate >= 70 ? 'default' : 'destructive'}>
                {data.paymentMetrics.punctualityRate.toFixed(1)}% puntual
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Pagado: {formatCurrency(data.paymentMetrics.totalPaid)}
            </p>
          </CardContent>
        </Card>

        {/* Crédito */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crédito Disponible</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.creditMetrics.availableCredit)}</div>
            <div className="mt-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Utilización</span>
                <span className={cn(
                  'font-semibold',
                  data.creditMetrics.utilizationRate >= 90 ? 'text-red-600' :
                  data.creditMetrics.utilizationRate >= 75 ? 'text-orange-600' :
                  'text-green-600'
                )}>
                  {data.creditMetrics.utilizationRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full',
                    data.creditMetrics.utilizationRate >= 90 ? 'bg-red-600' :
                    data.creditMetrics.utilizationRate >= 75 ? 'bg-orange-600' :
                    'bg-green-600'
                  )}
                  style={{ width: `${Math.min(data.creditMetrics.utilizationRate, 100)}%` }}
                />
              </div>
            </div>
            {data.creditMetrics.nearLimit && (
              <p className="text-xs text-orange-600 mt-2 font-semibold">⚠️ Cerca del límite</p>
            )}
            {data.creditMetrics.exceeded && (
              <p className="text-xs text-red-600 mt-2 font-semibold">⚠️ Límite excedido</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ventas Mensuales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Evolución de Ventas (Últimos 12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.trends.salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  name="Ventas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Productos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top 5 Productos Comprados</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length > 0 ? (
              <div className="space-y-3">
                {data.topProducts.map((product, index) => (
                  <div key={product.productId} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{product.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.quantityBought.toFixed(2)} unidades • {product.orderCount} pedidos
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(product.totalAmount)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sin productos comprados en el período
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Saldo Pendiente */}
      {data.paymentMetrics.pendingAmount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Estado de Cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Saldo Total</p>
                <p className="text-2xl font-bold">{formatCurrency(data.paymentMetrics.pendingAmount)}</p>
              </div>
              {data.paymentMetrics.overdueAmount > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Vencido</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(data.paymentMetrics.overdueAmount)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Al Día</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.paymentMetrics.pendingAmount - data.paymentMetrics.overdueAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
