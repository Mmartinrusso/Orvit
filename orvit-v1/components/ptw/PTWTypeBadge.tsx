'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PTWType } from '@/lib/types';
import {
  Flame,
  Box,
  ArrowUpFromLine,
  Zap,
  Construction,
  FlaskConical,
  RadioTower,
  Gauge,
  MoreHorizontal
} from 'lucide-react';

interface PTWTypeBadgeProps {
  type: PTWType;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const typeConfig: Record<PTWType, {
  label: string;
  className: string;
  icon: React.ElementType;
}> = {
  [PTWType.HOT_WORK]: {
    label: 'Trabajo en Caliente',
    className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/30',
    icon: Flame,
  },
  [PTWType.CONFINED_SPACE]: {
    label: 'Espacio Confinado',
    className: 'bg-muted text-foreground border-border',
    icon: Box,
  },
  [PTWType.HEIGHT_WORK]: {
    label: 'Trabajo en Altura',
    className: 'bg-info-muted text-info-muted-foreground border-info-muted-foreground/30',
    icon: ArrowUpFromLine,
  },
  [PTWType.ELECTRICAL]: {
    label: 'Trabajo Electrico',
    className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/30',
    icon: Zap,
  },
  [PTWType.EXCAVATION]: {
    label: 'Excavacion',
    className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/30',
    icon: Construction,
  },
  [PTWType.CHEMICAL]: {
    label: 'Trabajo Quimico',
    className: 'bg-success-muted text-success border-success/30',
    icon: FlaskConical,
  },
  [PTWType.RADIATION]: {
    label: 'Radiacion',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: RadioTower,
  },
  [PTWType.PRESSURE_SYSTEMS]: {
    label: 'Sistemas a Presion',
    className: 'bg-info-muted text-info-muted-foreground border-info-muted-foreground/30',
    icon: Gauge,
  },
  [PTWType.OTHER]: {
    label: 'Otro',
    className: 'bg-muted text-foreground border-border',
    icon: MoreHorizontal,
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1',
};

export default function PTWTypeBadge({ type, showIcon = true, size = 'md' }: PTWTypeBadgeProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(config.className, sizeClasses[size], 'font-medium inline-flex items-center gap-1')}
    >
      {showIcon && <Icon className={size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />}
      {config.label}
    </Badge>
  );
}
