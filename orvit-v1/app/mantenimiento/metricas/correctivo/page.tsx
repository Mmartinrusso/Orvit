'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  RefreshCw,
  Wrench,
  Timer,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CorrectiveMetricsPage() {
  const [dateRange, setDateRange] = useState('30'); // días

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['corrective-metrics', dateRange],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const res = await fetch(`/api/metrics/corrective?${params}`);
      if (!res.ok) throw new Error('Error al cargar métricas');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            <span>Error al cargar métricas</span>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  const metrics = data?.data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Métricas de Mantenimiento Correctivo</h1>
          <p className="text-muted-foreground">
            Período: {metrics?.period?.days} días
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
              <SelectItem value="365">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Fallas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Fallas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.summary?.totalFailures || 0}</div>
            <div className="flex gap-2 mt-2 text-sm">
              <Badge variant="outline" className="bg-yellow-50">
                {metrics?.summary?.openFailures || 0} abiertas
              </Badge>
              <Badge variant="outline" className="bg-green-50">
                {metrics?.summary?.resolvedFailures || 0} resueltas
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* MTTR */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              MTTR (Tiempo Medio de Reparación)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.mttr?.formatted || '0m'}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {metrics?.mttr?.hours || 0} horas promedio
            </p>
          </CardContent>
        </Card>

        {/* SLA */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Cumplimiento SLA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              'text-3xl font-bold',
              (metrics?.sla?.overall || 0) >= 90 ? 'text-green-600' :
              (metrics?.sla?.overall || 0) >= 70 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {metrics?.sla?.overall || 0}%
            </div>
            <div className="flex gap-1 mt-2">
              {Object.entries(metrics?.sla?.byPriority || {}).map(([priority, pct]) => (
                <Badge key={priority} variant="outline" className="text-xs">
                  {priority}: {pct as number}%
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Downtime */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Downtime Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.downtime?.formatted || '0m'}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {metrics?.summary?.failuresWithDowntime || 0} fallas con parada
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recurrencia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Recurrencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Máquinas con fallas recurrentes</span>
                <Badge variant={metrics?.recurrence?.recurrentMachines > 0 ? 'destructive' : 'secondary'}>
                  {metrics?.recurrence?.recurrentMachines || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Ventana de análisis</span>
                <span className="text-muted-foreground">
                  {metrics?.recurrence?.windowDays || 7} días
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tasa de recurrencia</span>
                <span className={cn(
                  'font-medium',
                  (metrics?.recurrence?.rate || 0) > 20 ? 'text-red-600' : 'text-green-600'
                )}>
                  {metrics?.recurrence?.rate || 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Subcomponentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Top Subcomponentes con Fallas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics?.topSubcomponents?.length > 0 ? (
              <div className="space-y-3">
                {metrics.topSubcomponents.map((sub: any, idx: number) => (
                  <div key={sub.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-6 h-6 p-0 justify-center">
                        {idx + 1}
                      </Badge>
                      <span className="text-sm">{sub.name}</span>
                    </div>
                    <Badge variant="secondary">{sub.count} fallas</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin datos de subcomponentes
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Umbrales SLA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Umbrales SLA por Prioridad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(metrics?.sla?.thresholds || {}).map(([priority, hours]) => (
              <div key={priority} className="text-center p-4 bg-muted rounded-lg">
                <Badge className={cn(
                  priority === 'P1' ? 'bg-red-500' :
                  priority === 'P2' ? 'bg-orange-500' :
                  priority === 'P3' ? 'bg-yellow-500' : 'bg-green-500'
                )}>
                  {priority}
                </Badge>
                <div className="text-2xl font-bold mt-2">{hours as number}h</div>
                <div className="text-sm text-muted-foreground">máximo</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
