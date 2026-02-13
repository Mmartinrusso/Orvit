'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { X, Edit, MoreVertical, Play, CheckCircle2, RotateCcw, Calendar } from 'lucide-react';
import { WorkOrder, WorkOrderStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { statusLabel, priorityLabel } from './work-order-utils';

const statusColors: Record<WorkOrderStatus, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
  ON_HOLD: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
};

const priorityColors: Record<string, string> = {
  LOW: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  HIGH: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  CRITICAL: 'bg-destructive/10 text-destructive border-destructive/20',
  URGENT: 'bg-destructive/10 text-destructive border-destructive/20',
};

interface WorkOrderDetailHeaderStickyProps {
  workOrder: WorkOrder;
  onClose: () => void;
  onEdit?: () => void;
  onStatusChange?: (newStatus: WorkOrderStatus) => void;
  onDelete?: () => void;
}

export function WorkOrderDetailHeaderSticky({
  workOrder,
  onClose,
  onEdit,
  onStatusChange,
  onDelete,
}: WorkOrderDetailHeaderStickyProps) {
  const getPrimaryAction = () => {
    switch (workOrder.status) {
      case WorkOrderStatus.PENDING:
        return {
          label: 'Iniciar',
          icon: Play,
          onClick: () => onStatusChange?.(WorkOrderStatus.IN_PROGRESS),
        };
      case WorkOrderStatus.IN_PROGRESS:
        return {
          label: 'Completar',
          icon: CheckCircle2,
          onClick: () => onStatusChange?.(WorkOrderStatus.COMPLETED),
        };
      case WorkOrderStatus.COMPLETED:
        return {
          label: 'Reabrir',
          icon: RotateCcw,
          onClick: () => onStatusChange?.(WorkOrderStatus.PENDING),
        };
      default:
        return null;
    }
  };

  const primaryAction = getPrimaryAction();

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-card px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold leading-tight text-foreground mb-2 line-clamp-2">
            {workOrder.title}
          </h2>
          
          {/* Meta línea compacta */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap mb-2">
            {workOrder.machine?.name && (
              <>
                <span className="font-medium">{workOrder.machine.name}</span>
                <span>·</span>
              </>
            )}
            <span>{workOrder.assignedTo?.name || 'Sin asignar'}</span>
            <span>·</span>
            <span>Creada {format(new Date(workOrder.createdAt), 'dd MMM yyyy', { locale: es })}</span>
            {workOrder.scheduledDate && (
              <>
                <span>·</span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Vence {format(new Date(workOrder.scheduledDate), 'dd MMM yyyy', { locale: es })}</span>
                </div>
              </>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn('text-xs border', statusColors[workOrder.status])}>
              {statusLabel(workOrder.status)}
            </Badge>
            <Badge variant="secondary" className={cn('text-xs border', priorityColors[workOrder.priority])}>
              {priorityLabel(workOrder.priority)}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {primaryAction && (
            <Button
              size="lg"
              onClick={primaryAction.onClick}
              className="text-xs"
            >
              <primaryAction.icon className="h-3.5 w-3.5 mr-1.5" />
              {primaryAction.label}
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" size="lg" onClick={onEdit} className="text-xs">
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-lg" aria-label="Más opciones">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onStatusChange?.(WorkOrderStatus.PENDING)}>
                Pendiente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(WorkOrderStatus.IN_PROGRESS)}>
                En Proceso
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(WorkOrderStatus.ON_HOLD)}>
                En Espera
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(WorkOrderStatus.COMPLETED)}>
                Completada
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(WorkOrderStatus.CANCELLED)}>
                Cancelada
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    Eliminar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
