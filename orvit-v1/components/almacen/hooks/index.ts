// Types
export * from './types';

// Warehouses
export { useWarehouses, useWarehouse, useDefaultWarehouse, useWarehousesMutations } from './useWarehouses';

// Solicitudes
export { useSolicitudes, useSolicitud, useSolicitudesMutations, useSolicitudesCount } from './useSolicitudes';

// Despachos
export { useDespachos, useDespacho, useDespachosMutations, useDespachosCount } from './useDespachos';

// Devoluciones
export { useDevoluciones, useDevolucion, useDevolucionesMutations, useDevolucionesCount } from './useDevoluciones';

// Inventario
export {
  useInventario,
  useItemAvailability,
  useCheckAvailability,
  useLowStockItems,
  useInventarioSummary,
} from './useInventario';

// Movimientos / Kardex
export { useMovimientos, useKardex, useMovimientosHoy } from './useMovimientos';

// Reservas
export { useReservas, useReservasSummary, useReservasMutations, useReservasCount } from './useReservas';

// Transferencias
export { useTransferencias, useTransferencia, useTransferenciasMutations } from './useTransferencias';

// Ajustes
export { useAjustes, useAjuste, useAjustesMutations } from './useAjustes';

// Stats
export { useAlmacenStats, useAlmacenKPIs } from './useAlmacenStats';

// Modal (URL params / deep linking)
export {
  useAlmacenModal,
  useAlmacenTab,
  getAlmacenModalUrl,
  getAlmacenTabUrl,
  type AlmacenModalType,
  type AlmacenModalMode,
  type AlmacenTab,
} from './useAlmacenModal';
