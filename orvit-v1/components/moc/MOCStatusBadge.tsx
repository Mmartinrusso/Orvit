'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  FileEdit,
  Clock,
  Search,
  CheckCircle,
  XCircle,
  Wrench,
  CheckCircle2,
  Ban,
} from 'lucide-react';

const MOC_STATUS_CONFIG = {
  DRAFT: {
    label: 'Borrador',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: FileEdit,
  },
  PENDING_REVIEW: {
    label: 'Pendiente de Revisión',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Clock,
  },
  UNDER_REVIEW: {
    label: 'En Revisión',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: Search,
  },
  APPROVED: {
    label: 'Aprobado',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
  },
  REJECTED: {
    label: 'Rechazado',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
  IMPLEMENTING: {
    label: 'En Implementación',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Wrench,
  },
  COMPLETED: {
    label: 'Completado',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'bg-gray-100 text-gray-500 border-gray-200',
    icon: Ban,
  },
};

interface MOCStatusBadgeProps {
  status: keyof typeof MOC_STATUS_CONFIG;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function MOCStatusBadge({ status, showIcon = true, size = 'md' }: MOCStatusBadgeProps) {
  const config = MOC_STATUS_CONFIG[status] || MOC_STATUS_CONFIG.DRAFT;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  return (
    <Badge variant="outline" className={cn(config.color, sizeClasses[size])}>
      {showIcon && <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />}
      {config.label}
    </Badge>
  );
}

export const MOC_CHANGE_TYPES = {
  EQUIPMENT: { label: 'Equipo', color: 'bg-blue-100 text-blue-800' },
  PROCESS: { label: 'Proceso', color: 'bg-purple-100 text-purple-800' },
  PROCEDURE: { label: 'Procedimiento', color: 'bg-amber-100 text-amber-800' },
  MATERIAL: { label: 'Material', color: 'bg-green-100 text-green-800' },
  PERSONNEL: { label: 'Personal', color: 'bg-pink-100 text-pink-800' },
};

interface MOCTypeBadgeProps {
  type: keyof typeof MOC_CHANGE_TYPES;
}

export function MOCTypeBadge({ type }: MOCTypeBadgeProps) {
  const config = MOC_CHANGE_TYPES[type] || MOC_CHANGE_TYPES.EQUIPMENT;
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  );
}

export const MOC_PRIORITIES = {
  LOW: { label: 'Baja', color: 'bg-gray-100 text-gray-800' },
  MEDIUM: { label: 'Media', color: 'bg-blue-100 text-blue-800' },
  HIGH: { label: 'Alta', color: 'bg-amber-100 text-amber-800' },
  CRITICAL: { label: 'Crítica', color: 'bg-red-100 text-red-800' },
};

interface MOCPriorityBadgeProps {
  priority: keyof typeof MOC_PRIORITIES;
}

export function MOCPriorityBadge({ priority }: MOCPriorityBadgeProps) {
  const config = MOC_PRIORITIES[priority] || MOC_PRIORITIES.MEDIUM;
  return (
    <Badge variant="outline" className={config.color}>
      Prioridad: {config.label}
    </Badge>
  );
}

export default MOCStatusBadge;
