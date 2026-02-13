import { WorkOrderStatus, Priority, MaintenanceType } from '@/lib/types';

export const statusLabel = (status: WorkOrderStatus): string => {
  const labels: Record<WorkOrderStatus, string> = {
    PENDING: 'Pendiente',
    IN_PROGRESS: 'En proceso',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    ON_HOLD: 'En espera',
  };
  return labels[status] || status;
};

export const priorityLabel = (priority: Priority): string => {
  const labels: Record<Priority, string> = {
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    CRITICAL: 'Crítica',
    URGENT: 'Urgente',
  };
  return labels[priority] || priority;
};

export const maintenanceTypeLabel = (type: MaintenanceType): string => {
  const labels: Record<MaintenanceType, string> = {
    PREVENTIVE: 'Preventivo',
    CORRECTIVE: 'Correctivo',
    PREDICTIVE: 'Predictivo',
    EMERGENCY: 'Emergencia',
  };
  return labels[type] || type;
};

