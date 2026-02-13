'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, TrendingDown, Clock } from 'lucide-react';

interface ProductAlertBannerProps {
  alerts: {
    lowStock: boolean;
    lowMargin: boolean;
    noSalesIn90Days: boolean;
    slowTurnover: boolean;
  };
  product: {
    name: string;
    currentStock: number;
    minStock: number;
  };
}

export function ProductAlertBanner({ alerts, product }: ProductAlertBannerProps) {
  const activeAlerts = [];

  if (alerts.lowStock) {
    activeAlerts.push({
      icon: Package,
      severity: product.currentStock === 0 ? 'high' : 'medium',
      message: product.currentStock === 0
        ? 'Stock agotado - Reabastecer urgente'
        : `Stock bajo (${product.currentStock} unidades) - Por debajo del mínimo (${product.minStock})`,
      suggestion: 'Revisar próximas compras programadas',
    });
  }

  if (alerts.lowMargin) {
    activeAlerts.push({
      icon: TrendingDown,
      severity: 'high',
      message: 'Margen por debajo del mínimo configurado',
      suggestion: 'Considerar ajustar precio de venta o negociar con proveedor',
    });
  }

  if (alerts.noSalesIn90Days) {
    activeAlerts.push({
      icon: Clock,
      severity: 'medium',
      message: 'Sin ventas en los últimos 90 días',
      suggestion: 'Evaluar descontinuar producto o implementar promoción',
    });
  }

  if (alerts.slowTurnover) {
    activeAlerts.push({
      icon: TrendingDown,
      severity: 'low',
      message: 'Rotación lenta de inventario',
      suggestion: 'Reducir stock mínimo o acelerar ventas con promociones',
    });
  }

  if (activeAlerts.length === 0) {
    return null;
  }

  const highestSeverity = activeAlerts.some(a => a.severity === 'high')
    ? 'high'
    : activeAlerts.some(a => a.severity === 'medium')
    ? 'medium'
    : 'low';

  return (
    <Alert variant={highestSeverity === 'high' ? 'destructive' : 'default'} className="border-l-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold">Alertas del producto</span>
            <Badge variant={highestSeverity === 'high' ? 'destructive' : highestSeverity === 'medium' ? 'default' : 'secondary'}>
              {activeAlerts.length} {activeAlerts.length === 1 ? 'alerta' : 'alertas'}
            </Badge>
          </div>

          <ul className="space-y-2">
            {activeAlerts.map((alert, index) => {
              const Icon = alert.icon;
              return (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.suggestion}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  );
}
