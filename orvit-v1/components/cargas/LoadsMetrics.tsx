'use client';

/**
 * Dashboard de métricas para cargas
 * Muestra KPIs y estadísticas resumidas
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Truck,
  Calendar,
  Weight,
  TrendingUp,
  User,
  CalendarDays,
} from 'lucide-react';
import { Load, LoadMetrics } from '@/lib/cargas/types';
import { calculateLoadMetrics } from '@/lib/cargas/utils';

interface LoadsMetricsProps {
  loads: Load[];
  className?: string;
  userColors?: {
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
    chart6: string;
    kpiPositive: string;
    kpiNegative: string;
    kpiNeutral: string;
  };
}

const DEFAULT_COLORS = {
  chart1: '#6366f1',
  chart2: '#8b5cf6',
  chart3: '#ec4899',
  chart4: '#f59e0b',
  chart5: '#10b981',
  chart6: '#06b6d4',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};

export default function LoadsMetrics({ loads, className, userColors = DEFAULT_COLORS }: LoadsMetricsProps) {
  const metrics = useMemo(() => calculateLoadMetrics(loads), [loads]);

  const kpis = [
    {
      title: 'Total Cargas',
      value: metrics.totalLoads,
      subtitle: `${metrics.loadsThisMonth} este mes`,
      icon: Package,
      color: userColors.chart1,
    },
    {
      title: 'Cargas Hoy',
      value: metrics.loadsToday,
      subtitle: `${metrics.loadsThisWeek} esta semana`,
      icon: Calendar,
      color: userColors.chart5,
    },
    {
      title: 'Prom. Items/Carga',
      value: metrics.avgItemsPerLoad.toFixed(1),
      subtitle: 'por carga',
      icon: TrendingUp,
      color: userColors.chart2,
    },
    {
      title: 'Peso Total Mes',
      value: `${metrics.totalWeightThisMonth.toFixed(1)} Tn`,
      subtitle: 'toneladas',
      icon: Weight,
      color: userColors.chart4,
    },
  ];

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {kpi.title}
                  </p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kpi.subtitle}
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${kpi.color}15` }}
                >
                  <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info adicional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Camión más usado */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Camión más usado
                </p>
                {metrics.mostUsedTruck ? (
                  <>
                    <p className="text-lg font-semibold mt-1">
                      {metrics.mostUsedTruck.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span
                        className="font-medium"
                        style={{ color: userColors.kpiPositive }}
                      >
                        {metrics.mostUsedTruck.count}
                      </span>{' '}
                      cargas
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Sin datos
                  </p>
                )}
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${userColors.chart3}15` }}
              >
                <Truck className="h-5 w-5" style={{ color: userColors.chart3 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cliente más frecuente */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Cliente más frecuente
                </p>
                {metrics.mostFrequentClient ? (
                  <>
                    <p className="text-lg font-semibold mt-1 truncate max-w-[200px]">
                      {metrics.mostFrequentClient.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span
                        className="font-medium"
                        style={{ color: userColors.kpiPositive }}
                      >
                        {metrics.mostFrequentClient.count}
                      </span>{' '}
                      entregas
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Sin datos
                  </p>
                )}
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${userColors.chart6}15` }}
              >
                <User className="h-5 w-5" style={{ color: userColors.chart6 }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
