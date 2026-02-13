'use client';

import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, TrendingDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertType = 'STOCK_BAJO' | 'MARGEN_BAJO' | 'SIN_VENTAS' | 'ROTACION_LENTA';
type AlertPriority = 'ALTA' | 'MEDIA' | 'BAJA';

interface AlertBadgeProps {
  tipo: AlertType;
  prioridad: AlertPriority;
  count?: number;
  showIcon?: boolean;
  className?: string;
}

const ALERT_CONFIG: Record<
  AlertType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: {
      ALTA: string;
      MEDIA: string;
      BAJA: string;
    };
  }
> = {
  STOCK_BAJO: {
    label: 'Stock Bajo',
    icon: Package,
    color: {
      ALTA: 'bg-red-100 text-red-800 border-red-300',
      MEDIA: 'bg-orange-100 text-orange-800 border-orange-300',
      BAJA: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
  },
  MARGEN_BAJO: {
    label: 'Margen Bajo',
    icon: TrendingDown,
    color: {
      ALTA: 'bg-red-100 text-red-800 border-red-300',
      MEDIA: 'bg-orange-100 text-orange-800 border-orange-300',
      BAJA: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
  },
  SIN_VENTAS: {
    label: 'Sin Ventas',
    icon: Clock,
    color: {
      ALTA: 'bg-red-100 text-red-800 border-red-300',
      MEDIA: 'bg-orange-100 text-orange-800 border-orange-300',
      BAJA: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
  },
  ROTACION_LENTA: {
    label: 'Rotación Lenta',
    icon: TrendingDown,
    color: {
      ALTA: 'bg-red-100 text-red-800 border-red-300',
      MEDIA: 'bg-orange-100 text-orange-800 border-orange-300',
      BAJA: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
  },
};

export function AlertBadge({ tipo, prioridad, count, showIcon = true, className }: AlertBadgeProps) {
  const config = ALERT_CONFIG[tipo];
  const Icon = config.icon;
  const colorClass = config.color[prioridad];

  return (
    <Badge variant="outline" className={cn(colorClass, 'text-xs font-medium', className)}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
      {count !== undefined && count > 1 && <span className="ml-1">({count})</span>}
    </Badge>
  );
}

interface AlertCountBadgeProps {
  count: number;
  prioridad?: AlertPriority;
  className?: string;
}

export function AlertCountBadge({ count, prioridad = 'MEDIA', className }: AlertCountBadgeProps) {
  if (count === 0) return null;

  const variantClass =
    prioridad === 'ALTA'
      ? 'bg-red-100 text-red-800 border-red-300'
      : prioridad === 'MEDIA'
      ? 'bg-orange-100 text-orange-800 border-orange-300'
      : 'bg-yellow-100 text-yellow-800 border-yellow-300';

  return (
    <Badge variant="outline" className={cn(variantClass, 'text-xs font-medium', className)}>
      <AlertTriangle className="w-3 h-3 mr-1" />
      {count}
    </Badge>
  );
}
