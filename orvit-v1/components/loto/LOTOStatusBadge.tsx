'use client';

import { Badge } from '@/components/ui/badge';
import { LOTOStatus } from '@/lib/types';
import { Lock, Unlock, AlertCircle } from 'lucide-react';

interface LOTOStatusBadgeProps {
  status: LOTOStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<LOTOStatus, {
  label: string;
  className: string;
  icon: React.ElementType;
}> = {
  [LOTOStatus.LOCKED]: {
    label: 'Bloqueado',
    className: 'bg-red-100 text-red-700 border-red-300',
    icon: Lock,
  },
  [LOTOStatus.UNLOCKED]: {
    label: 'Desbloqueado',
    className: 'bg-green-100 text-green-700 border-green-300',
    icon: Unlock,
  },
  [LOTOStatus.PARTIAL]: {
    label: 'Parcial',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    icon: AlertCircle,
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1',
};

export default function LOTOStatusBadge({ status, showIcon = true, size = 'md' }: LOTOStatusBadgeProps) {
  const config = statusConfig[status];
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
