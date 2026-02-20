'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Analytics {
  overview: {
    totalDeliveries: number;
    onTimeRate: number;
    avgDeliveryTimeHours: number;
  };
  statusBreakdown: Array<{
    estado: string;
    count: number;
    percentage: number;
  }>;
  deliveriesByType: Array<{
    tipo: string;
    count: number;
    percentage: number;
  }>;
  topDrivers: Array<{
    nombre: string;
    entregas: number;
  }>;
  failureAnalysis: Array<{
    reason: string;
    count: number;
  }>;
  trends: Array<{
    date: string;
    created: number;
    delivered: number;
  }>;
}

export function DeliveryAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30'); // days

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const fechaDesde = new Date();
      fechaDesde.setDate(fechaDesde.getDate() - parseInt(period));

      const params = new URLSearchParams({
        fechaDesde: fechaDesde.toISOString(),
      });

      const response = await fetch(`/api/ventas/entregas/analytics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        toast.error('Error al cargar analíticas');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Error al cargar analíticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No se pudieron cargar las analíticas</p>
      </div>
    );
  }

  const { overview, statusBreakdown, deliveriesByType, topDrivers, failureAnalysis, trends } =
    analytics;

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analíticas de Entregas</h2>
          <p className="text-sm text-muted-foreground">
            Métricas y rendimiento del sistema de entregas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
              <SelectItem value="365">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadAnalytics}>
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-info-muted rounded-lg">
                <Package className="w-6 h-6 text-info-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Entregas</p>
                <p className="text-3xl font-bold">{overview.totalDeliveries}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success-muted rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Tasa Entrega a Tiempo</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">{overview.onTimeRate}%</p>
                  {overview.onTimeRate >= 80 ? (
                    <TrendingUp className="w-5 h-5 text-success" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Tiempo Promedio</p>
                <p className="text-3xl font-bold">{overview.avgDeliveryTimeHours}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entregas por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusBreakdown.map((status) => (
                <div key={status.estado} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{status.estado}</span>
                    <span className="text-muted-foreground">
                      {status.count} ({status.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${status.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entregas por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deliveriesByType.map((type) => (
                <div
                  key={type.tipo}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{type.tipo}</p>
                      <p className="text-xs text-muted-foreground">{type.percentage}% del total</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{type.count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Drivers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Top Conductores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topDrivers.length > 0 ? (
              <div className="space-y-3">
                {topDrivers.map((driver, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <span className="font-medium">{driver.nombre}</span>
                    </div>
                    <span className="text-muted-foreground">{driver.entregas} entregas</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay datos de conductores
              </p>
            )}
          </CardContent>
        </Card>

        {/* Failure Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Principales Motivos de Falla
            </CardTitle>
          </CardHeader>
          <CardContent>
            {failureAnalysis.length > 0 ? (
              <div className="space-y-3">
                {failureAnalysis.map((failure, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{failure.reason}</span>
                      <span className="text-muted-foreground">{failure.count}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-destructive h-1.5 rounded-full"
                        style={{
                          width: `${(failure.count / failureAnalysis[0].count) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay entregas fallidas en este período
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tendencia de Entregas (Últimos 7 Días)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trends.map((day) => {
              const maxValue = Math.max(...trends.map((t) => Math.max(t.created, t.delivered)));
              return (
                <div key={day.date} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {new Date(day.date).toLocaleDateString('es-AR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Creadas: {day.created}</span>
                      <span>Entregadas: {day.delivered}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-6">
                    <div
                      className="bg-primary rounded"
                      style={{ width: `${(day.created / maxValue) * 100}%` }}
                      title={`${day.created} creadas`}
                    />
                    <div
                      className="bg-success rounded"
                      style={{ width: `${(day.delivered / maxValue) * 100}%` }}
                      title={`${day.delivered} entregadas`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded" />
              <span>Creadas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-success rounded" />
              <span>Entregadas</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
