'use client';

import { Badge } from '@/components/ui/badge';
import { PTWStatus } from '@/lib/types';
import {
  FileText,
  Clock,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  XCircle,
  Ban,
  AlertTriangle
} from 'lucide-react';

interface PTWStatusBadgeProps {
  status: PTWStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<PTWStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  icon: React.ElementType;
}> = {
  [PTWStatus.DRAFT]: {
    label: 'Borrador',
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: FileText,
  },
  [PTWStatus.PENDING_APPROVAL]: {
    label: 'Pendiente',
    variant: 'outline',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-300',
    icon: Clock,
  },
  [PTWStatus.APPROVED]: {
    label: 'Aprobado',
    variant: 'outline',
    className: 'bg-blue-50 text-blue-700 border-blue-300',
    icon: CheckCircle,
  },
  [PTWStatus.ACTIVE]: {
    label: 'Activo',
    variant: 'default',
    className: 'bg-green-100 text-green-700 border-green-300',
    icon: PlayCircle,
  },
  [PTWStatus.SUSPENDED]: {
    label: 'Suspendido',
    variant: 'outline',
    className: 'bg-orange-50 text-orange-700 border-orange-300',
    icon: PauseCircle,
  },
  [PTWStatus.CLOSED]: {
    label: 'Cerrado',
    variant: 'secondary',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: XCircle,
  },
  [PTWStatus.CANCELLED]: {
    label: 'Cancelado',
    variant: 'destructive',
    className: 'bg-red-50 text-red-700 border-red-300',
    icon: Ban,
  },
  [PTWStatus.EXPIRED]: {
    label: 'Expirado',
    variant: 'outline',
    className: 'bg-purple-50 text-purple-700 border-purple-300',
    icon: AlertTriangle,
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1',
};

export default function PTWStatusBadge({ status, showIcon = true, size = 'md' }: PTWStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} ${sizeClasses[size]} font-medium inline-flex items-center gap-1`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />}
      {config.label}
    </Badge>
  );
}
