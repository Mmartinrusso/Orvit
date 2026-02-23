'use client';

/**
 * Badge de estado para cargas
 * Muestra el estado actual con colores y permite cambiar estado si tiene permisos
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileEdit,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { LoadStatus, LOAD_STATUS_CONFIG } from '@/lib/cargas/types';
import { cn } from '@/lib/utils';

interface LoadStatusBadgeProps {
  status: LoadStatus;
  loadId: number;
  onStatusChange?: (newStatus: LoadStatus) => Promise<void>;
  canEdit?: boolean;
  size?: 'sm' | 'default';
  showDropdown?: boolean;
}

const STATUS_ICONS: Record<LoadStatus, typeof FileEdit> = {
  DRAFT: FileEdit,
  PENDING: Clock,
  IN_TRANSIT: Truck,
  DELIVERED: CheckCircle2,
  CANCELLED: XCircle,
};

export default function LoadStatusBadge({
  status,
  loadId,
  onStatusChange,
  canEdit = false,
  size = 'default',
  showDropdown = true,
}: LoadStatusBadgeProps) {
  const [isChanging, setIsChanging] = useState(false);
  const config = LOAD_STATUS_CONFIG[status];
  const Icon = STATUS_ICONS[status];
  const allowedTransitions = config.allowedTransitions;

  const handleStatusChange = async (newStatus: LoadStatus) => {
    if (!onStatusChange || isChanging) return;

    setIsChanging(true);
    try {
      await onStatusChange(newStatus);
    } finally {
      setIsChanging(false);
    }
  };

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium transition-colors',
        config.bgColor,
        config.color,
        size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5',
        canEdit && showDropdown && allowedTransitions.length > 0 && 'cursor-pointer hover:opacity-80'
      )}
    >
      {isChanging ? (
        <Loader2 className={cn('animate-spin', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
      ) : (
        <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      )}
      {config.label}
      {canEdit && showDropdown && allowedTransitions.length > 0 && !isChanging && (
        <ChevronDown className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      )}
    </Badge>
  );

  // Si no puede editar o no hay transiciones, solo mostrar badge con tooltip
  if (!canEdit || !showDropdown || allowedTransitions.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
          {allowedTransitions.length === 0 && status !== 'DRAFT' && (
            <p className="text-xs text-muted-foreground mt-1">Estado final</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Con dropdown para cambiar estado
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isChanging}>
        {badge}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Cambiar estado a:
        </div>
        <DropdownMenuSeparator />
        {allowedTransitions.map((newStatus) => {
          const newConfig = LOAD_STATUS_CONFIG[newStatus];
          const NewIcon = STATUS_ICONS[newStatus];
          return (
            <DropdownMenuItem
              key={newStatus}
              onClick={() => handleStatusChange(newStatus)}
              className="gap-2"
            >
              <NewIcon className={cn('h-4 w-4', newConfig.color)} />
              <div>
                <p className="font-medium">{newConfig.label}</p>
                <p className="text-xs text-muted-foreground">{newConfig.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Versión inline del badge (sin dropdown, para tablas)
 */
export function LoadStatusBadgeInline({
  status,
  size = 'sm',
}: {
  status: LoadStatus;
  size?: 'sm' | 'default';
}) {
  const config = LOAD_STATUS_CONFIG[status];
  const Icon = STATUS_ICONS[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        config.bgColor,
        config.color,
        size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5'
      )}
    >
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {config.label}
    </Badge>
  );
}
