'use client';

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
    className: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: Flame,
  },
  [PTWType.CONFINED_SPACE]: {
    label: 'Espacio Confinado',
    className: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: Box,
  },
  [PTWType.HEIGHT_WORK]: {
    label: 'Trabajo en Altura',
    className: 'bg-sky-100 text-sky-800 border-sky-300',
    icon: ArrowUpFromLine,
  },
  [PTWType.ELECTRICAL]: {
    label: 'Trabajo Electrico',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: Zap,
  },
  [PTWType.EXCAVATION]: {
    label: 'Excavacion',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: Construction,
  },
  [PTWType.CHEMICAL]: {
    label: 'Trabajo Quimico',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: FlaskConical,
  },
  [PTWType.RADIATION]: {
    label: 'Radiacion',
    className: 'bg-red-100 text-red-800 border-red-300',
    icon: RadioTower,
  },
  [PTWType.PRESSURE_SYSTEMS]: {
    label: 'Sistemas a Presion',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: Gauge,
  },
  [PTWType.OTHER]: {
    label: 'Otro',
    className: 'bg-gray-100 text-gray-800 border-gray-300',
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
      className={`${config.className} ${sizeClasses[size]} font-medium inline-flex items-center gap-1`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />}
      {config.label}
    </Badge>
  );
}
