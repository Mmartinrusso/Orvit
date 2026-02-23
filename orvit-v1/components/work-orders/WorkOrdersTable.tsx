'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Play,
  CheckCircle2,
  RotateCcw,
  Pause,
  Copy,
  UserPlus,
} from 'lucide-react';
import { WorkOrder, WorkOrderStatus, Priority } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  statusLabels,
  priorityLabels,
  statusColors,
  priorityColors,
  isOverdue,
  formatDateShort,
  relativeTime,
  getInitials,
} from './workOrders.helpers';

interface WorkOrdersTableProps {
  workOrders: WorkOrder[];
  onViewDetails?: (workOrder: WorkOrder) => void;
  onEdit?: (workOrder: WorkOrder) => void;
  onDelete?: (workOrder: WorkOrder) => void;
  onStatusChange?: (workOrder: WorkOrder, newStatus: WorkOrderStatus) => Promise<void>;
  onAssign?: (workOrder: WorkOrder) => void;
  onDuplicate?: (workOrder: WorkOrder) => void;
  className?: string;
}

export function WorkOrdersTable({
  workOrders,
  onViewDetails,
  onEdit,
  onDelete,
  onStatusChange,
  onAssign,
  onDuplicate,
  className,
}: WorkOrdersTableProps) {
  const getQuickAction = (order: WorkOrder) => {
    if (!onStatusChange) return null;

    switch (order.status) {
      case WorkOrderStatus.PENDING:
        return {
          label: 'Iniciar',
          icon: Play,
          onClick: () => onStatusChange(order, WorkOrderStatus.IN_PROGRESS),
        };
      case WorkOrderStatus.IN_PROGRESS:
        return {
          label: 'Completar',
          icon: CheckCircle2,
          onClick: () => onStatusChange(order, WorkOrderStatus.COMPLETED),
        };
      default:
        return null;
    }
  };

  if (workOrders.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="font-semibold text-xs w-[280px]">Orden de Trabajo</TableHead>
            <TableHead className="font-semibold text-xs w-[150px]">Máquina</TableHead>
            <TableHead className="font-semibold text-xs w-[100px]">Estado</TableHead>
            <TableHead className="font-semibold text-xs w-[90px]">Prioridad</TableHead>
            <TableHead className="font-semibold text-xs w-[140px]">Responsable</TableHead>
            <TableHead className="font-semibold text-xs w-[100px]">Vence</TableHead>
            <TableHead className="font-semibold text-xs w-[100px]">Creada</TableHead>
            <TableHead className="font-semibold text-xs w-[100px] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workOrders.map((order) => {
            const orderIsOverdue = isOverdue(order.scheduledDate, order.status);
            const quickAction = getQuickAction(order);

            return (
              <TableRow 
                key={order.id}
                className={cn(
                  'group cursor-pointer',
                  orderIsOverdue && 'bg-destructive/5'
                )}
                onClick={() => onViewDetails?.(order)}
              >
                {/* Orden de Trabajo */}
                <TableCell className="py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {order.title}
                    </span>
                    {order.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {order.description}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Máquina */}
                <TableCell className="py-3">
                  <span className="text-sm text-muted-foreground">
                    {order.machine?.name || '—'}
                  </span>
                </TableCell>

                {/* Estado */}
                <TableCell className="py-3">
                  <Badge
                    variant="outline"
                    className={cn('text-xs border', statusColors[order.status])}
                  >
                    {statusLabels[order.status]}
                  </Badge>
                </TableCell>

                {/* Prioridad */}
                <TableCell className="py-3">
                  <Badge
                    variant="outline"
                    className={cn('text-xs border', priorityColors[order.priority])}
                  >
                    {priorityLabels[order.priority]}
                  </Badge>
                </TableCell>

                {/* Responsable */}
                <TableCell className="py-3">
                  {order.assignedTo ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-muted">
                          {getInitials(order.assignedTo.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground truncate max-w-[80px]">
                        {order.assignedTo.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-warning-muted-foreground">
                      Sin asignar
                    </span>
                  )}
                </TableCell>

                {/* Vence */}
                <TableCell className="py-3">
                  {order.scheduledDate ? (
                    <span className={cn(
                      'text-sm',
                      orderIsOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                    )}>
                      {formatDateShort(order.scheduledDate)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Creada */}
                <TableCell className="py-3">
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(order.createdAt)}
                  </span>
                </TableCell>

                {/* Acciones */}
                <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {/* Acción rápida */}
                    {quickAction && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          quickAction.onClick();
                        }}
                        title={quickAction.label}
                      >
                        <quickAction.icon className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Botón asignar si no está asignado */}
                    {!order.assignedToId && onAssign && 
                     order.status !== WorkOrderStatus.COMPLETED && 
                     order.status !== WorkOrderStatus.CANCELLED && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-warning-muted-foreground hover:text-warning-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssign(order);
                        }}
                        title="Asignar"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Dropdown de más acciones */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
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
                        {onStatusChange && order.status === WorkOrderStatus.COMPLETED && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => onStatusChange(order, WorkOrderStatus.PENDING)}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reabrir
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
