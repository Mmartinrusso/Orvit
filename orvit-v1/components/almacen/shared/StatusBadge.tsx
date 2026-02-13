'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  MaterialRequestStatus,
  MaterialRequestStatusLabels,
  MaterialRequestStatusColors,
  DespachoStatus,
  DespachoStatusLabels,
  DespachoStatusColors,
  DevolucionStatus,
  DevolucionStatusLabels,
  DevolucionStatusColors,
  ReservaStatus,
  ReservaStatusLabels,
  ReservaStatusColors,
  Priority,
  PriorityLabels,
  PriorityColors,
} from '@/lib/almacen/types';

type StatusType =
  | 'solicitud'
  | 'despacho'
  | 'devolucion'
  | 'reserva'
  | 'priority';

interface StatusBadgeProps {
  type: StatusType;
  status: string;
  className?: string;
  size?: 'sm' | 'default';
}

/**
 * Componente para mostrar badges de estado con colores consistentes
 */
export function StatusBadge({
  type,
  status,
  className,
  size = 'default',
}: StatusBadgeProps) {
  const { label, colorClass } = getStatusInfo(type, status);

  return (
    <Badge
      variant="outline"
      className={cn(
        colorClass,
        size === 'sm' && 'text-[10px] px-1.5 py-0',
        className
      )}
    >
      {label}
    </Badge>
  );
}

function getStatusInfo(type: StatusType, status: string): { label: string; colorClass: string } {
  switch (type) {
    case 'solicitud':
      return {
        label: MaterialRequestStatusLabels[status as MaterialRequestStatus] || status,
        colorClass: MaterialRequestStatusColors[status as MaterialRequestStatus] || 'bg-gray-100 text-gray-800',
      };

    case 'despacho':
      return {
        label: DespachoStatusLabels[status as DespachoStatus] || status,
        colorClass: DespachoStatusColors[status as DespachoStatus] || 'bg-gray-100 text-gray-800',
      };

    case 'devolucion':
      return {
        label: DevolucionStatusLabels[status as DevolucionStatus] || status,
        colorClass: DevolucionStatusColors[status as DevolucionStatus] || 'bg-gray-100 text-gray-800',
      };

    case 'reserva':
      return {
        label: ReservaStatusLabels[status as ReservaStatus] || status,
        colorClass: ReservaStatusColors[status as ReservaStatus] || 'bg-gray-100 text-gray-800',
      };

    case 'priority':
      return {
        label: PriorityLabels[status as Priority] || status,
        colorClass: PriorityColors[status as Priority] || 'bg-gray-100 text-gray-800',
      };

    default:
      return {
        label: status,
        colorClass: 'bg-gray-100 text-gray-800',
      };
  }
}

/**
 * Badge específico para estado de solicitud
 */
export function SolicitudStatusBadge({
  status,
  className,
  size,
}: {
  status: MaterialRequestStatus;
  className?: string;
  size?: 'sm' | 'default';
}) {
  return <StatusBadge type="solicitud" status={status} className={className} size={size} />;
}

/**
 * Badge específico para estado de despacho
 */
export function DespachoStatusBadge({
  status,
  className,
  size,
}: {
  status: DespachoStatus;
  className?: string;
  size?: 'sm' | 'default';
}) {
  return <StatusBadge type="despacho" status={status} className={className} size={size} />;
}

/**
 * Badge específico para estado de devolución
 */
export function DevolucionStatusBadge({
  status,
  className,
  size,
}: {
  status: DevolucionStatus;
  className?: string;
  size?: 'sm' | 'default';
}) {
  return <StatusBadge type="devolucion" status={status} className={className} size={size} />;
}

/**
 * Badge específico para estado de reserva
 */
export function ReservaStatusBadge({
  status,
  className,
  size,
}: {
  status: ReservaStatus;
  className?: string;
  size?: 'sm' | 'default';
}) {
  return <StatusBadge type="reserva" status={status} className={className} size={size} />;
}

/**
 * Badge específico para prioridad
 */
export function PriorityBadge({
  priority,
  className,
  size,
}: {
  priority: Priority;
  className?: string;
  size?: 'sm' | 'default';
}) {
  return <StatusBadge type="priority" status={priority} className={className} size={size} />;
}
