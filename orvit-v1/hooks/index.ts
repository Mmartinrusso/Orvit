/**
 * ✨ HOOKS OPTIMIZADOS - Sistema TIN/Mawir
 * 
 * Estos hooks usan React Query para:
 * - Cache automático (2-5 minutos según el caso)
 * - Deduplicación de requests
 * - Refetch inteligente
 * - Estados de loading/error consistentes
 * 
 * PATRÓN DE USO:
 * 1. Usar el hook principal del dashboard para cargar datos iniciales
 * 2. Los hooks derivados extraen datos específicos sin hacer requests adicionales
 */

// ============================================================================
// CORE / BOOTSTRAP
// ============================================================================
export {
  useCoreBootstrap,
  useCurrentUser,
  useCompanies,
  useAreas,
  useSectorsFromBootstrap,
  usePermissions,
  useNotificationsSummary,
  useSystemSettings,
  useInvalidateBootstrap
} from './use-core-bootstrap';

export type {
  BootstrapData,
  BootstrapUser,
  BootstrapCompany,
  BootstrapArea,
  BootstrapSector,
  BootstrapNotifications,
  BootstrapSystemSettings
} from './use-core-bootstrap';

// ============================================================================
// MANTENIMIENTO
// ============================================================================
export { 
  useMaintenanceDashboard,
  usePendingMaintenances,
  useCompletedTodayMaintenances,
  useMaintenanceMachines,
  useMaintenanceMobileUnits,
  useMaintenanceKPIs,
  useMaintenanceChecklists,
  useMaintenanceRecentHistory
} from './use-maintenance-dashboard';

export {
  useMaintenanceHistory,
  useMaintenanceExecutions
} from './use-maintenance-history';

export {
  useAllMaintenances,
  fetchAllMaintenancesCached,
  invalidateMaintenancesCache
} from './use-all-maintenances';

// ============================================================================
// MÁQUINAS
// ============================================================================
export {
  useMachinesInitial,
  useMachinesList,
  useMachinesStats
} from './use-machines-initial';

export {
  useMachineDetail,
  useMachineComponents,
  useMachineFailures,
  useMachineWorkOrders,
  useMachineDocuments,
  useMachineMaintenanceHistory,
  useMachineStats,
  useMachineTools,
  useMachineSpareParts,
  useInvalidateMachineDetail
} from './use-machine-detail';

// Tipos de máquinas
export type {
  MachineDetailData,
  MachineBasic,
  MachineComponent,
  MachineFailure,
  MachineWorkOrder,
  MachineDocument,
  MaintenanceHistoryItem,
  MachineDetailStats,
  MachineTool
} from './use-machine-detail';

// ============================================================================
// HERRAMIENTAS / PAÑOL
// ============================================================================
export {
  useToolsDashboard,
  useToolsList,
  useActiveLoans,
  useToolsStats,
  useRecentMovements,
  usePendingToolRequests
} from './use-tools-dashboard';

// ============================================================================
// ÓRDENES DE TRABAJO
// ============================================================================
export {
  useWorkOrdersDashboard,
  usePendingWorkOrders,
  useInProgressWorkOrders,
  useOverdueWorkOrders,
  useWorkOrdersStats
} from './use-work-orders-dashboard';

export {
  useWorkOrderDetail
} from './use-work-order-detail';

// ============================================================================
// SECTORES
// ============================================================================
export {
  useSectors
} from './use-sectors';

// ============================================================================
// CACHE GLOBAL
// ============================================================================
export {
  useGlobalCache,
  createCacheKey
} from './use-global-cache';

// ============================================================================
// PERFORMANCE MONITOR (Solo desarrollo)
// ============================================================================
export {
  usePerformanceMonitor,
  usePerformanceStats,
  recordCacheHit,
  recordCacheMiss,
  recordDeduplication,
  recordRequest
} from './use-performance-monitor';

// ============================================================================
// DATOS COMPARTIDOS (CACHE GLOBAL OPTIMIZADO)
// ============================================================================
export {
  useSharedMaintenances,
  useSharedDashboard,
  prefetchCommonData,
  invalidateCache,
  getCacheStats,
  getCached,
  setCached,
  fetchWithCache
} from './use-shared-maintenance-data';
