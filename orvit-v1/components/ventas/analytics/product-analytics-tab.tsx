'use client';

import { useState } from 'react';
import { useProductAnalytics } from '@/hooks/use-product-analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, TrendingUp, DollarSign, Package, Users } from 'lucide-react';
import { ProductKPICard } from './product-kpi-cards';
import { ProductSalesChart } from './product-sales-chart';
import { ProductMarginChart } from './product-margin-chart';
import { ProductAlertBanner } from './product-alert-banner';

interface ProductAnalyticsTabProps {
  productId: string;
}

export function ProductAnalyticsTab({ productId }: ProductAnalyticsTabProps) {
  const [period, setPeriod] = useState('mes');

  const { data, isLoading, error } = useProductAnalytics(productId, {
    period,
    includeComparison: true,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error al cargar analytics: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertDescription>No hay datos disponibles</AlertDescription>
      </Alert>
    );
  }

  const hasAlerts = Object.values(data.alerts).some(Boolean);

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Período de análisis</h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
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

      {/* Alerts Banner */}
      {hasAlerts && <ProductAlertBanner alerts={data.alerts} product={data.product} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProductKPICard
          icon={TrendingUp}
          iconColor="bg-primary"
          label="Ventas del Período"
          value={`$${data.salesMetrics.totalRevenue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${data.salesMetrics.totalQuantitySold} unidades vendidas`}
          trend={data.salesMetrics.trend}
          trendInfo={`${data.salesMetrics.orderCount} órdenes de ${data.salesMetrics.uniqueCustomers} clientes`}
        />

        <ProductKPICard
          icon={DollarSign}
          iconColor="bg-success"
          label="Margen Promedio"
          value={`${data.marginMetrics.realMargin.toFixed(1)}%`}
          subtitle={
            data.marginMetrics.belowMin
              ? `Por debajo del mínimo (${data.product.minStock}%)`
              : 'Dentro del rango esperado'
          }
          alert={data.marginMetrics.belowMin}
          trendInfo={`Proyectado: ${data.marginMetrics.projectedMargin.toFixed(1)}% | Dif: ${data.marginMetrics.difference > 0 ? '+' : ''}${data.marginMetrics.difference.toFixed(1)}%`}
        />

        <ProductKPICard
          icon={Package}
          iconColor="bg-purple-500"
          label="Rotación de Inventario"
          value={`${data.inventoryMetrics.turnoverRate.toFixed(1)}x`}
          subtitle={`Velocidad: ${data.inventoryMetrics.velocity}`}
          velocityBadge={data.inventoryMetrics.velocity}
          trendInfo={`Cobertura: ${data.inventoryMetrics.daysOfStockLeft} días de stock`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Evolución de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductSalesChart data={data.trends.salesByMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de Margen</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductMarginChart
              data={data.trends.marginHistory}
              marginMin={data.product.minStock}
              marginMax={100}
            />
          </CardContent>
        </Card>
      </div>

      {/* Top Client */}
      {data.topClient && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Cliente Principal del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{data.topClient.name}</p>
                <p className="text-sm text-muted-foreground">
                  {data.topClient.quantityBought} unidades en {data.topClient.orderCount} {data.topClient.orderCount === 1 ? 'orden' : 'órdenes'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-success">
                  ${data.topClient.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Total comprado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State for no sales */}
      {data.salesMetrics.orderCount === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium mb-2">Sin ventas en este período</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Este producto no tiene ventas registradas en el {period === 'mes' ? 'último mes' : period === 'trimestre' ? 'último trimestre' : period === 'semestre' ? 'último semestre' : 'último año'}.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
