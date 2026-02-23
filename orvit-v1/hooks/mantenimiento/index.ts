'use client';

// Exportar todos los hooks de mantenimiento centralizados
export { useMaintenancePending } from './use-maintenance-pending';
export { useMaintenanceCompleted } from './use-maintenance-completed';
export { useChecklists } from './use-checklists';
export { useMachineDetail } from './use-machine-detail';
export { useMachineWorkOrders } from './use-machine-work-orders';
export { useMachineFailures } from './use-machine-failures';
export { useDocuments } from './use-documents';
export { useNotifications } from './use-notifications';

// Re-exportar hooks existentes que ya usan React Query
export { useMaintenanceHistory, useMaintenanceExecutions } from '../use-maintenance-history';
export { useMaintenanceDashboard } from '../use-maintenance-dashboard';

