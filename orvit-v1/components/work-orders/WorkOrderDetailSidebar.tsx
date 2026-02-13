'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { WorkOrder, WorkOrderStatus, Priority } from '@/lib/types';
import { cn, formatHours } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  DollarSign,
  Wrench,
  User,
  Tag,
} from 'lucide-react';
import { statusLabel, priorityLabel, maintenanceTypeLabel } from './work-order-utils';

const statusColors: Record<WorkOrderStatus, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
  ON_HOLD: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
};

const priorityColors: Record<Priority, string> = {
  LOW: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  HIGH: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  CRITICAL: 'bg-destructive/10 text-destructive border-destructive/20',
  URGENT: 'bg-destructive/10 text-destructive border-destructive/20',
};

interface WorkOrderDetailSidebarProps {
  workOrder: WorkOrder;
}

export function WorkOrderDetailSidebar({ workOrder }: WorkOrderDetailSidebarProps) {
  const hasDates = workOrder.scheduledDate || workOrder.startedDate || workOrder.completedDate;
  const hasTimeCost = workOrder.estimatedHours || workOrder.actualHours || workOrder.cost;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Datos clave */}
      <div>
        <h3 className="text-xs font-semibold text-foreground mb-3">Datos clave</h3>
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between">
            <dt className="text-xs text-muted-foreground">Estado</dt>
            <dd>
              <Badge variant="secondary" className={cn('text-xs border', statusColors[workOrder.status])}>
                {statusLabel(workOrder.status)}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs text-muted-foreground">Prioridad</dt>
            <dd>
              <Badge variant="secondary" className={cn('text-xs border', priorityColors[workOrder.priority])}>
                {priorityLabel(workOrder.priority)}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs text-muted-foreground">Tipo</dt>
            <dd className="text-xs text-foreground">{maintenanceTypeLabel(workOrder.type)}</dd>
          </div>
          {workOrder.machine?.name && (
            <div className="flex items-center justify-between">
              <dt className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Wrench className="h-3 w-3" />
                Máquina
              </dt>
              <dd className="text-xs text-foreground">{workOrder.machine.name}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-xs text-muted-foreground flex items-center gap-1.5">
              <User className="h-3 w-3" />
              Responsable
            </dt>
            <dd className="text-xs text-foreground">{workOrder.assignedTo?.name || 'Sin asignar'}</dd>
          </div>
          {workOrder.tags && workOrder.tags.length > 0 && (
            <div>
              <dt className="text-xs text-muted-foreground mb-1.5">Tags</dt>
              <dd className="flex flex-wrap gap-1">
                {workOrder.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {hasDates && (
        <>
          <Separator />
          <div>
            <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Fechas
            </h3>
            <dl className="space-y-2">
              {workOrder.scheduledDate ? (
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-muted-foreground">Programada</dt>
                  <dd className="text-xs text-foreground">
                    {format(new Date(workOrder.scheduledDate), 'dd MMM yyyy', { locale: es })}
                  </dd>
                </div>
              ) : null}
              {workOrder.startedDate ? (
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-muted-foreground">Inicio</dt>
                  <dd className="text-xs text-foreground">
                    {format(new Date(workOrder.startedDate), 'dd MMM yyyy', { locale: es })}
                  </dd>
                </div>
              ) : null}
              {workOrder.completedDate ? (
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-muted-foreground">Fin</dt>
                  <dd className="text-xs text-foreground">
                    {format(new Date(workOrder.completedDate), 'dd MMM yyyy', { locale: es })}
                  </dd>
                </div>
              ) : null}
              {workOrder.scheduledDate && new Date(workOrder.scheduledDate) < new Date() && 
               workOrder.status !== WorkOrderStatus.COMPLETED && 
               workOrder.status !== WorkOrderStatus.CANCELLED && (
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-muted-foreground">Vencimiento</dt>
                  <dd className="text-xs text-destructive">
                    {format(new Date(workOrder.scheduledDate), 'dd MMM yyyy', { locale: es })}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </>
      )}

      {!hasDates && (
        <>
          <Separator />
          <div>
            <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Fechas
            </h3>
            <p className="text-xs text-muted-foreground">Sin fechas registradas</p>
          </div>
        </>
      )}

      {hasTimeCost && (
        <>
          <Separator />
          <div>
            <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Tiempo y Costo
            </h3>
            <dl className="space-y-2">
              {workOrder.estimatedHours && (
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-muted-foreground">Tiempo estimado</dt>
                  <dd className="text-xs text-foreground">{formatHours(workOrder.estimatedHours)}</dd>
                </div>
              )}
              {workOrder.actualHours && (
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-muted-foreground">Tiempo real</dt>
                  <dd className="text-xs text-foreground">{formatHours(workOrder.actualHours)}</dd>
                </div>
              )}
              {workOrder.cost && (
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-muted-foreground">Costo estimado</dt>
                  <dd className="text-xs text-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {workOrder.cost.toFixed(2)}€
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </>
      )}
    </div>
  );
}
