'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Bell,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercentage } from './utils/metrics';

interface AlertsCardProps {
  data: {
    totalSales: number;
    totalCosts: number;
    marginPercentage: number;
    netMargin: number;
    sales: {
      topProducts: Array<{
        name: string;
        margin?: number;
        profit?: number;
        units: number;
        revenue: number;
      }>;
    };
    costsSummary: {
      total: number;
      components: Array<{
        label: string;
        amount: number;
        percentage: number;
      }>;
    };
  };
  previousMonthData?: {
    totalSales: number;
    totalCosts: number;
    marginPercentage: number;
  } | null;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  action?: string;
}

export function AlertsCard({ data, previousMonthData }: AlertsCardProps) {
  const generateAlerts = (): Alert[] => {
    const alerts: Alert[] = [];

    // 1. Margen crítico - SOLO esto es rojo (crítico real)
    if (data.marginPercentage < 10) {
      alerts.push({
        id: 'margin-critical',
        type: 'critical',
        title: 'Margen Crítico',
        description: `El margen está en ${formatPercentage(data.marginPercentage)}. Acción urgente requerida.`,
        action: 'Revisar precios'
      });
    }

    // 2. Productos con margen bajo (warning = gris oscuro, no rojo)
    const lowMarginProducts = data.sales.topProducts.filter(p => p.margin !== undefined && p.margin < 15);
    if (lowMarginProducts.length > 0) {
      const worstProduct = lowMarginProducts.sort((a, b) => (a.margin || 0) - (b.margin || 0))[0];
      alerts.push({
        id: 'low-margin-products',
        type: lowMarginProducts.some(p => (p.margin || 0) < 0) ? 'critical' : 'warning',
        title: `${lowMarginProducts.length} Productos con Margen Bajo`,
        description: `${worstProduct.name} tiene ${formatPercentage(worstProduct.margin || 0)} de margen.`,
        action: 'Ajustar precios'
      });
    }

    // 3. Concentración de costos (info = gris neutro)
    const highCostComponent = data.costsSummary.components.find(c => c.percentage > 50);
    if (highCostComponent) {
      alerts.push({
        id: 'cost-concentration',
        type: 'info',
        title: 'Concentración de Costos',
        description: `${highCostComponent.label} representa +${highCostComponent.percentage.toFixed(1)}% del costo total.`,
        action: 'Diversificar'
      });
    }

    return alerts.slice(0, 3);
  };

  const alerts = generateAlerts();

  // Colores del sistema - solo rojo para crítico
  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return {
          bg: 'bg-destructive/10',
          border: 'border-destructive/30',
          icon: AlertTriangle,
          iconColor: 'text-destructive',
          titleColor: 'text-destructive'
        };
      case 'warning':
        return {
          bg: 'bg-muted',
          border: 'border-border',
          icon: AlertCircle,
          iconColor: 'text-muted-foreground',
          titleColor: 'text-foreground'
        };
      case 'info':
        return {
          bg: 'bg-muted',
          border: 'border-border',
          icon: Info,
          iconColor: 'text-muted-foreground',
          titleColor: 'text-foreground'
        };
      case 'success':
        return {
          bg: 'bg-muted',
          border: 'border-border',
          icon: CheckCircle2,
          iconColor: 'text-muted-foreground',
          titleColor: 'text-foreground'
        };
    }
  };

  if (alerts.length === 0) {
    return null;
  }

  const criticalCount = alerts.filter(a => a.type === 'critical').length;

  return (
    <Card className={cn(
      "border-l-4",
      criticalCount > 0 ? "border-l-destructive" : "border-l-muted-foreground"
    )}>
      <CardContent className="p-4">
        {/* Header compacto */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Alertas</span>
          </div>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs h-5 px-1.5">
              {criticalCount} urgente
            </Badge>
          )}
        </div>

        {/* Alertas en grid horizontal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {alerts.map((alert) => {
            const styles = getAlertStyles(alert.type);
            const Icon = styles.icon;

            return (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-2 p-2.5 rounded-md border",
                  styles.bg,
                  styles.border
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", styles.iconColor)} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-semibold", styles.titleColor)}>{alert.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                  {alert.action && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="text-xs font-medium text-muted-foreground cursor-pointer hover:underline">{alert.action}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
