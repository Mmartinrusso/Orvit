'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Pencil } from 'lucide-react';
import { WorkOrder } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  statusLabels,
  priorityLabels,
  statusColors,
  priorityColors,
} from './workOrders.helpers';

interface WorkOrderDialogHeaderStickyProps {
  workOrder?: WorkOrder;
  onClose: () => void;
}

export function WorkOrderDialogHeaderSticky({
  workOrder,
  onClose,
}: WorkOrderDialogHeaderStickyProps) {
  return (
    <div className="flex-shrink-0 border-b border-border bg-card px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Pencil className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {workOrder ? 'Editar orden' : 'Nueva orden'}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {workOrder
              ? 'Modifica los detalles de la orden de trabajo'
              : 'Crea una nueva orden de trabajo para programar mantenimiento'}
          </p>
          {workOrder && (
            <div className="flex items-center gap-2 mt-3">
              <Badge
                variant="outline"
                className={cn('text-xs border', statusColors[workOrder.status])}
              >
                {statusLabels[workOrder.status]}
              </Badge>
              <Badge
                variant="outline"
                className={cn('text-xs border', priorityColors[workOrder.priority])}
              >
                {priorityLabels[workOrder.priority]}
              </Badge>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-9 w-9 flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
