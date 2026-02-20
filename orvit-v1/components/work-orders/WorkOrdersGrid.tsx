'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Wrench,
  Calendar,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Play,
  CheckCircle2,
  RotateCcw,
  Pause,
  UserPlus,
  Copy,
  Clock,
} from 'lucide-react';
import { WorkOrder, WorkOrderStatus, Priority } from '@/lib/types';
import { cn, formatHours } from '@/lib/utils';
import {
  statusLabels,
  priorityLabels,
  statusColors,
  priorityColors,
  statusIndicatorColors,
  isOverdue,
  formatDateShort,
  formatDateShortWithTime,
  relativeTime,
  getInitials,
  getDueText,
  daysUntilDue,
  stripHtml,
} from './workOrders.helpers';

interface WorkOrdersGridProps {
  workOrders: WorkOrder[];
  onViewDetails?: (workOrder: WorkOrder) => void;
  onEdit?: (workOrder: WorkOrder) => void;
  onDelete?: (workOrder: WorkOrder) => void;
  onStatusChange?: (workOrder: WorkOrder, newStatus: WorkOrderStatus) => Promise<void>;
  onAssign?: (workOrder: WorkOrder) => void;
  onDuplicate?: (workOrder: WorkOrder) => void;
  className?: string;
}

export function WorkOrdersGrid({
  workOrders,
  onViewDetails,
  onEdit,
  onDelete,
  onStatusChange,
  onAssign,
  onDuplicate,
  className,
}: WorkOrdersGridProps) {
  const getPrimaryAction = (order: WorkOrder) => {
    // Si no está asignada y hay handler, mostrar "Asignar"
    if (!order.assignedToId && onAssign && 
        order.status !== WorkOrderStatus.COMPLETED && 
        order.status !== WorkOrderStatus.CANCELLED) {
      return {
        label: 'Asignar',
        icon: UserPlus,
        onClick: () => onAssign(order),
        variant: 'outline' as const,
      };
    }

    if (!onStatusChange) return null;

    switch (order.status) {
      case WorkOrderStatus.PENDING:
        return {
          label: 'Iniciar',
          icon: Play,
          onClick: () => onStatusChange(order, WorkOrderStatus.IN_PROGRESS),
          variant: 'default' as const,
        };
      case WorkOrderStatus.IN_PROGRESS:
        return {
          label: 'Completar',
          icon: CheckCircle2,
          onClick: () => onStatusChange(order, WorkOrderStatus.COMPLETED),
          variant: 'default' as const,
        };
      case WorkOrderStatus.COMPLETED:
        return {
          label: 'Reabrir',
          icon: RotateCcw,
          onClick: () => onStatusChange(order, WorkOrderStatus.PENDING),
          variant: 'outline' as const,
        };
      case WorkOrderStatus.ON_HOLD:
        return {
          label: 'Reanudar',
          icon: Play,
          onClick: () => onStatusChange(order, WorkOrderStatus.IN_PROGRESS),
          variant: 'default' as const,
        };
      default:
        return null;
    }
  };

  if (workOrders.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3',
      className
    )}>
      {workOrders.map((order) => {
        const orderIsOverdue = isOverdue(order.scheduledDate, order.status);
        const primaryAction = getPrimaryAction(order);
        const dueText = getDueText(order.scheduledDate, order.status);

        return (
          <Card
            key={order.id}
            className={cn(
              'group relative transition-all duration-200 border-border bg-card rounded-xl overflow-hidden',
              'hover:shadow-md hover:border-border/80',
              orderIsOverdue && 'border-l-[3px] border-l-rose-500'
            )}
          >
            {/* Indicador de estado (barra superior sutil) */}
            <div className={cn(
              'absolute top-0 left-0 right-0 h-0.5',
              statusIndicatorColors[order.status]
            )} />

            <CardContent className="p-4 pt-5">
              {/* Header: Título + Dropdown */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 
                  className="font-semibold text-sm text-foreground line-clamp-2 flex-1 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => onViewDetails?.(order)}
                >
                  {order.title}
                </h3>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {onViewDetails && (
                      <DropdownMenuItem onClick={() => onViewDetails(order)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalles
                      </DropdownMenuItem>
                    )}
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(order)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                    )}
                    {onDuplicate && (
                      <DropdownMenuItem onClick={() => onDuplicate(order)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                    )}
                    {onStatusChange && order.status === WorkOrderStatus.IN_PROGRESS && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onStatusChange(order, WorkOrderStatus.ON_HOLD)}
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pausar
                        </DropdownMenuItem>
                      </>
                    )}
                    {onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(order)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Meta línea compacta */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 flex-wrap">
                {order.machine?.name && (
                  <>
                    <div className="flex items-center gap-1">
                      <Wrench className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[100px]">{order.machine.name}</span>
                    </div>
                    <span className="text-border">·</span>
                  </>
                )}
                <span className={cn(
                  'truncate',
                  !order.assignedToId && 'text-warning-muted-foreground font-medium'
                )}>
                  {order.assignedTo?.name || 'Sin asignar'}
                </span>
              </div>

              {/* Descripción */}
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                {stripHtml(order.description)}
              </p>

              {/* Badge SLA — visible para vencidas y próximas 7 días */}
              {(() => {
                if (!dueText) return null;
                const days = daysUntilDue(order.scheduledDate);
                if (days === null || days > 7) return null;
                const cls =
                  days < 0
                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                    : days === 0
                    ? 'bg-warning-muted text-warning-muted-foreground border border-warning-muted'
                    : days <= 2
                    ? 'bg-warning-muted text-warning-muted-foreground border border-warning-muted'
                    : 'bg-warning-muted text-warning-muted-foreground border border-warning-muted';
                return (
                  <div className={cn('flex items-center gap-1.5 text-xs mb-3 rounded-lg px-2 py-1.5', cls)}>
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="font-medium">{dueText}</span>
                  </div>
                );
              })()}

              {/* Timing: Fechas y duración según el estado */}
              {order.status === WorkOrderStatus.COMPLETED ? (
                <div className="flex flex-col gap-1.5 text-xs mb-3">
                  {/* Info de cierre: Diagnóstico y Solución */}
                  {((order as any).diagnosisNotes || (order as any).workPerformedNotes) && (
                    <div className="bg-success-muted rounded-md p-2 space-y-1">
                      {(order as any).diagnosisNotes && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Diagnóstico:</span>{' '}
                          {(order as any).diagnosisNotes.length > 60
                            ? (order as any).diagnosisNotes.substring(0, 60) + '...'
                            : (order as any).diagnosisNotes}
                        </p>
                      )}
                      {(order as any).workPerformedNotes && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Solución:</span>{' '}
                          {(order as any).workPerformedNotes.length > 60
                            ? (order as any).workPerformedNotes.substring(0, 60) + '...'
                            : (order as any).workPerformedNotes}
                        </p>
                      )}
                      {(order as any).resultNotes && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Resultado:</span>{' '}
                          {(order as any).resultNotes === 'FUNCIONÓ' ? '✅ Funcionó' :
                           (order as any).resultNotes === 'PARCIAL' ? '⚠️ Parcial' :
                           (order as any).resultNotes === 'NO_FUNCIONÓ' ? '❌ No funcionó' :
                           (order as any).resultNotes}
                        </p>
                      )}
                    </div>
                  )}
                  {/* Fechas y tiempo */}
                  <div className="text-muted-foreground space-y-0.5">
                    {order.createdAt && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                        <span>Pedida: {formatDateShortWithTime(order.createdAt)}</span>
                      </div>
                    )}
                    {order.completedDate && (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-success" />
                        <span>Realizada: {formatDateShortWithTime(order.completedDate)}</span>
                        {order.actualHours && (
                          <span className="ml-1 text-success font-medium">
                            ({formatHours(order.actualHours)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : order.status === WorkOrderStatus.IN_PROGRESS && order.startedDate ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>Iniciada {formatDateShort(order.startedDate)}</span>
                  </div>
                </div>
              ) : order.scheduledDate && order.status === WorkOrderStatus.PENDING ? (
                <div className={cn(
                  'flex items-center gap-1.5 text-xs mb-3 flex-wrap',
                  orderIsOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                )}>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>Programada {formatDateShort(order.scheduledDate)}</span>
                  </div>
                </div>
              ) : null}

              {/* Badges de estado y prioridad */}
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-2 py-0 h-5 border', statusColors[order.status])}
                >
                  {statusLabels[order.status]}
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-2 py-0 h-5"
                >
                  {priorityLabels[order.priority]}
                </Badge>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                {primaryAction ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails?.(order)}
                      className="h-8 text-xs flex-1"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={primaryAction.onClick}
                      className="h-8 text-xs flex-1"
                    >
                      <primaryAction.icon className="h-3.5 w-3.5 mr-1" />
                      {primaryAction.label}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onViewDetails?.(order)}
                    className="h-8 text-xs w-full"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Ver
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
