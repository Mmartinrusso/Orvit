// Warehouse types and adapters
export {
  WarehouseDTOSchema,
  type WarehouseDTO,
  normalizeWarehouse,
  normalizeWarehouses,
  WarehouseCreateSchema,
  type WarehouseCreateInput,
  WarehouseUpdateSchema,
  type WarehouseUpdateInput,
} from './warehouse';

// Enums and constants
export {
  // MaterialRequest
  MaterialRequestStatuses,
  type MaterialRequestStatus,
  MaterialRequestStatusSchema,
  MaterialRequestStatusLabels,
  MaterialRequestStatusColors,
  MaterialRequestTypes,
  type MaterialRequestType,
  MaterialRequestTypeSchema,
  MaterialRequestTypeLabels,

  // Despacho
  DespachoStatuses,
  type DespachoStatus,
  DespachoStatusSchema,
  DespachoStatusLabels,
  DespachoStatusColors,
  DespachoTypes,
  type DespachoType,
  DespachoTypeSchema,
  DespachoTypeLabels,

  // Devolucion
  DevolucionStatuses,
  type DevolucionStatus,
  DevolucionStatusSchema,
  DevolucionStatusLabels,
  DevolucionStatusColors,

  // Reserva
  ReservaStatuses,
  type ReservaStatus,
  ReservaStatusSchema,
  ReservaStatusLabels,
  ReservaStatusColors,
  ReservaTypes,
  type ReservaType,
  ReservaTypeSchema,
  ReservaTypeLabels,

  // Priority
  Priorities,
  type Priority,
  PrioritySchema,
  PriorityLabels,
  PriorityColors,

  // InventoryItem
  InventoryItemTypes,
  type InventoryItemType,
  InventoryItemTypeSchema,
  InventoryItemTypeLabels,

  // Movement
  MovementTypes,
  type MovementType,
  MovementTypeSchema,
  MovementTypeLabels,
  MovementTypeColors,

  // Transfer
  TransferStatuses,
  type TransferStatus,
  TransferStatusLabels,
  TransferStatusColors,

  // Adjustment
  AdjustmentStatuses,
  type AdjustmentStatus,
  AdjustmentStatusLabels,
  AdjustmentStatusColors,
  AdjustmentTypes,
  type AdjustmentType,
  AdjustmentTypeLabels,
} from './enums';
