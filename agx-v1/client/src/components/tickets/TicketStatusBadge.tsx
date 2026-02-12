import { Badge } from '@/components/common';
import type { TicketStatus } from '@/api';

const statusVariants: Record<TicketStatus, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
  new: 'info',
  approved: 'success',
  rejected: 'error',
  in_progress: 'warning',
  completed: 'success',
  failed: 'error',
};

const statusLabels: Record<TicketStatus, string> = {
  new: 'Nuevo',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  in_progress: 'En Progreso',
  completed: 'Completado',
  failed: 'Fallido',
};

interface TicketStatusBadgeProps {
  status: TicketStatus;
}

export function TicketStatusBadge({ status }: TicketStatusBadgeProps) {
  return (
    <Badge variant={statusVariants[status]}>
      {statusLabels[status]}
    </Badge>
  );
}
