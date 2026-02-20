'use client';

import { cn } from '@/lib/utils';
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
    className: 'bg-muted text-foreground border-border',
    icon: FileText,
  },
  [PTWStatus.PENDING_APPROVAL]: {
    label: 'Pendiente',
    variant: 'outline',
    className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/30',
    icon: Clock,
  },
  [PTWStatus.APPROVED]: {
    label: 'Aprobado',
    variant: 'outline',
    className: 'bg-info-muted text-info-muted-foreground border-info-muted-foreground/30',
    icon: CheckCircle,
  },
  [PTWStatus.ACTIVE]: {
    label: 'Activo',
    variant: 'default',
    className: 'bg-success-muted text-success border-success/30',
    icon: PlayCircle,
  },
  [PTWStatus.SUSPENDED]: {
    label: 'Suspendido',
    variant: 'outline',
    className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/30',
    icon: PauseCircle,
  },
  [PTWStatus.CLOSED]: {
    label: 'Cerrado',
    variant: 'secondary',
    className: 'bg-muted text-muted-foreground border-border',
    icon: XCircle,
  },
  [PTWStatus.CANCELLED]: {
    label: 'Cancelado',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: Ban,
  },
  [PTWStatus.EXPIRED]: {
    label: 'Expirado',
    variant: 'outline',
    className: 'bg-muted text-muted-foreground border-border',
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
      className={cn(config.className, sizeClasses[size], 'font-medium inline-flex items-center gap-1')}
    >
      {showIcon && <Icon className={size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />}
      {config.label}
    </Badge>
  );
}
