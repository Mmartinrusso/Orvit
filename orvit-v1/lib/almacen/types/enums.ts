import { z } from 'zod';

// ============================================
// MaterialRequest - Estados
// ============================================
export const MaterialRequestStatuses = [
  'BORRADOR',
  'PENDIENTE_APROBACION',
  'APROBADA',
  'PARCIALMENTE_DESPACHADA',
  'DESPACHADA',
  'CANCELADA',
  'RECHAZADA',
] as const;

export type MaterialRequestStatus = (typeof MaterialRequestStatuses)[number];
export const MaterialRequestStatusSchema = z.enum(MaterialRequestStatuses);

export const MaterialRequestStatusLabels: Record<MaterialRequestStatus, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente Aprobación',
  APROBADA: 'Aprobada',
  PARCIALMENTE_DESPACHADA: 'Parcialmente Despachada',
  DESPACHADA: 'Despachada',
  CANCELADA: 'Cancelada',
  RECHAZADA: 'Rechazada',
};

export const MaterialRequestStatusColors: Record<MaterialRequestStatus, string> = {
  BORRADOR: 'bg-gray-100 text-gray-800',
  PENDIENTE_APROBACION: 'bg-yellow-100 text-yellow-800',
  APROBADA: 'bg-green-100 text-green-800',
  PARCIALMENTE_DESPACHADA: 'bg-blue-100 text-blue-800',
  DESPACHADA: 'bg-emerald-100 text-emerald-800',
  CANCELADA: 'bg-red-100 text-red-800',
  RECHAZADA: 'bg-red-100 text-red-800',
};

// ============================================
// MaterialRequest - Tipos
// ============================================
export const MaterialRequestTypes = [
  'INTERNO',
  'OT_MANTENIMIENTO',
  'OP_PRODUCCION',
  'PROYECTO',
] as const;

export type MaterialRequestType = (typeof MaterialRequestTypes)[number];
export const MaterialRequestTypeSchema = z.enum(MaterialRequestTypes);

export const MaterialRequestTypeLabels: Record<MaterialRequestType, string> = {
  INTERNO: 'Interno',
  OT_MANTENIMIENTO: 'OT Mantenimiento',
  OP_PRODUCCION: 'OP Producción',
  PROYECTO: 'Proyecto',
};

// ============================================
// Despacho - Estados
// ============================================
export const DespachoStatuses = [
  'BORRADOR',
  'EN_PREPARACION',
  'LISTO_DESPACHO',
  'DESPACHADO',
  'RECIBIDO',
  'CANCELADO',
] as const;

export type DespachoStatus = (typeof DespachoStatuses)[number];
export const DespachoStatusSchema = z.enum(DespachoStatuses);

export const DespachoStatusLabels: Record<DespachoStatus, string> = {
  BORRADOR: 'Borrador',
  EN_PREPARACION: 'En Preparación',
  LISTO_DESPACHO: 'Listo para Despacho',
  DESPACHADO: 'Despachado',
  RECIBIDO: 'Recibido',
  CANCELADO: 'Cancelado',
};

export const DespachoStatusColors: Record<DespachoStatus, string> = {
  BORRADOR: 'bg-gray-100 text-gray-800',
  EN_PREPARACION: 'bg-blue-100 text-blue-800',
  LISTO_DESPACHO: 'bg-yellow-100 text-yellow-800',
  DESPACHADO: 'bg-green-100 text-green-800',
  RECIBIDO: 'bg-emerald-100 text-emerald-800',
  CANCELADO: 'bg-red-100 text-red-800',
};

// ============================================
// Despacho - Tipos
// ============================================
export const DespachoTypes = [
  'ENTREGA_PERSONA',
  'ENTREGA_OT',
  'ENTREGA_OP',
  'CONSUMO_INTERNO',
] as const;

export type DespachoType = (typeof DespachoTypes)[number];
export const DespachoTypeSchema = z.enum(DespachoTypes);

export const DespachoTypeLabels: Record<DespachoType, string> = {
  ENTREGA_PERSONA: 'Entrega a Persona',
  ENTREGA_OT: 'Entrega a OT',
  ENTREGA_OP: 'Entrega a OP',
  CONSUMO_INTERNO: 'Consumo Interno',
};

// ============================================
// Devolucion - Estados
// ============================================
export const DevolucionStatuses = [
  'BORRADOR',
  'PENDIENTE_REVISION',
  'ACEPTADA',
  'RECHAZADA',
] as const;

export type DevolucionStatus = (typeof DevolucionStatuses)[number];
export const DevolucionStatusSchema = z.enum(DevolucionStatuses);

export const DevolucionStatusLabels: Record<DevolucionStatus, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_REVISION: 'Pendiente Revisión',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
};

export const DevolucionStatusColors: Record<DevolucionStatus, string> = {
  BORRADOR: 'bg-gray-100 text-gray-800',
  PENDIENTE_REVISION: 'bg-yellow-100 text-yellow-800',
  ACEPTADA: 'bg-green-100 text-green-800',
  RECHAZADA: 'bg-red-100 text-red-800',
};

// ============================================
// Reserva - Estados
// ============================================
export const ReservaStatuses = [
  'ACTIVA',
  'CONSUMIDA_PARCIAL',
  'CONSUMIDA',
  'LIBERADA',
  'EXPIRADA',
] as const;

export type ReservaStatus = (typeof ReservaStatuses)[number];
export const ReservaStatusSchema = z.enum(ReservaStatuses);

export const ReservaStatusLabels: Record<ReservaStatus, string> = {
  ACTIVA: 'Activa',
  CONSUMIDA_PARCIAL: 'Consumida Parcialmente',
  CONSUMIDA: 'Consumida',
  LIBERADA: 'Liberada',
  EXPIRADA: 'Expirada',
};

export const ReservaStatusColors: Record<ReservaStatus, string> = {
  ACTIVA: 'bg-green-100 text-green-800',
  CONSUMIDA_PARCIAL: 'bg-blue-100 text-blue-800',
  CONSUMIDA: 'bg-gray-100 text-gray-800',
  LIBERADA: 'bg-yellow-100 text-yellow-800',
  EXPIRADA: 'bg-red-100 text-red-800',
};

// ============================================
// Reserva - Tipos
// ============================================
export const ReservaTypes = [
  'SOLICITUD_MATERIAL',
  'ORDEN_PRODUCCION',
  'ORDEN_TRABAJO',
  'MANUAL',
] as const;

export type ReservaType = (typeof ReservaTypes)[number];
export const ReservaTypeSchema = z.enum(ReservaTypes);

export const ReservaTypeLabels: Record<ReservaType, string> = {
  SOLICITUD_MATERIAL: 'Solicitud de Material',
  ORDEN_PRODUCCION: 'Orden de Producción',
  ORDEN_TRABAJO: 'Orden de Trabajo',
  MANUAL: 'Manual',
};

// ============================================
// Priority
// ============================================
export const Priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type Priority = (typeof Priorities)[number];
export const PrioritySchema = z.enum(Priorities);

export const PriorityLabels: Record<Priority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const PriorityColors: Record<Priority, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

// ============================================
// InventoryItem - Tipos
// ============================================
export const InventoryItemTypes = [
  'SUPPLIER_ITEM',
  'TOOL',
] as const;

export type InventoryItemType = (typeof InventoryItemTypes)[number];
export const InventoryItemTypeSchema = z.enum(InventoryItemTypes);

export const InventoryItemTypeLabels: Record<InventoryItemType, string> = {
  SUPPLIER_ITEM: 'Artículo Proveedor',
  TOOL: 'Herramienta',
};

// ============================================
// MovementType - Tipos de Movimiento
// ============================================
export const MovementTypes = [
  'ENTRADA',
  'SALIDA',
  'AJUSTE_POSITIVO',
  'AJUSTE_NEGATIVO',
  'TRANSFERENCIA_ENTRADA',
  'TRANSFERENCIA_SALIDA',
  'RESERVA',
  'LIBERACION_RESERVA',
  'CONSUMO_RESERVA',
] as const;

export type MovementType = (typeof MovementTypes)[number];
export const MovementTypeSchema = z.enum(MovementTypes);

export const MovementTypeLabels: Record<MovementType, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE_POSITIVO: 'Ajuste Positivo',
  AJUSTE_NEGATIVO: 'Ajuste Negativo',
  TRANSFERENCIA_ENTRADA: 'Transferencia (Entrada)',
  TRANSFERENCIA_SALIDA: 'Transferencia (Salida)',
  RESERVA: 'Reserva',
  LIBERACION_RESERVA: 'Liberación de Reserva',
  CONSUMO_RESERVA: 'Consumo de Reserva',
};

export const MovementTypeColors: Record<MovementType, string> = {
  ENTRADA: 'bg-green-100 text-green-800',
  SALIDA: 'bg-red-100 text-red-800',
  AJUSTE_POSITIVO: 'bg-blue-100 text-blue-800',
  AJUSTE_NEGATIVO: 'bg-orange-100 text-orange-800',
  TRANSFERENCIA_ENTRADA: 'bg-purple-100 text-purple-800',
  TRANSFERENCIA_SALIDA: 'bg-purple-100 text-purple-800',
  RESERVA: 'bg-yellow-100 text-yellow-800',
  LIBERACION_RESERVA: 'bg-gray-100 text-gray-800',
  CONSUMO_RESERVA: 'bg-emerald-100 text-emerald-800',
};
