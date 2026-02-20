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
    color: 'bg-muted text-foreground border-border',
    icon: FileEdit,
  },
  PENDING_REVIEW: {
    label: 'Pendiente de Revisión',
    color: 'bg-info-muted text-info-muted-foreground border-info-muted-foreground/20',
    icon: Clock,
  },
  UNDER_REVIEW: {
    label: 'En Revisión',
    color: 'bg-muted text-foreground border-border',
    icon: Search,
  },
  APPROVED: {
    label: 'Aprobado',
    color: 'bg-success-muted text-success border-success/20',
    icon: CheckCircle,
  },
  REJECTED: {
    label: 'Rechazado',
    color: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: XCircle,
  },
  IMPLEMENTING: {
    label: 'En Implementación',
    color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20',
    icon: Wrench,
  },
  COMPLETED: {
    label: 'Completado',
    color: 'bg-success-muted text-success border-success/20',
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'bg-muted text-muted-foreground border-border',
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
  EQUIPMENT: { label: 'Equipo', color: 'bg-info-muted text-info-muted-foreground' },
  PROCESS: { label: 'Proceso', color: 'bg-muted text-foreground' },
  PROCEDURE: { label: 'Procedimiento', color: 'bg-warning-muted text-warning-muted-foreground' },
  MATERIAL: { label: 'Material', color: 'bg-success-muted text-success' },
  PERSONNEL: { label: 'Personal', color: 'bg-muted text-foreground' },
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
  LOW: { label: 'Baja', color: 'bg-muted text-foreground' },
  MEDIUM: { label: 'Media', color: 'bg-info-muted text-info-muted-foreground' },
  HIGH: { label: 'Alta', color: 'bg-warning-muted text-warning-muted-foreground' },
  CRITICAL: { label: 'Crítica', color: 'bg-destructive/10 text-destructive' },
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
