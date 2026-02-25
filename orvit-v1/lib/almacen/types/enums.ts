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
  BORRADOR: 'bg-muted text-muted-foreground',
  PENDIENTE_APROBACION: 'bg-warning-muted text-warning-muted-foreground',
  APROBADA: 'bg-success-muted text-success-muted-foreground',
  PARCIALMENTE_DESPACHADA: 'bg-info-muted text-info-muted-foreground',
  DESPACHADA: 'bg-success-muted text-success-muted-foreground',
  CANCELADA: 'bg-destructive/10 text-destructive',
  RECHAZADA: 'bg-destructive/10 text-destructive',
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
  BORRADOR: 'bg-muted text-muted-foreground',
  EN_PREPARACION: 'bg-info-muted text-info-muted-foreground',
  LISTO_DESPACHO: 'bg-warning-muted text-warning-muted-foreground',
  DESPACHADO: 'bg-success-muted text-success-muted-foreground',
  RECIBIDO: 'bg-success-muted text-success-muted-foreground',
  CANCELADO: 'bg-destructive/10 text-destructive',
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
  BORRADOR: 'bg-muted text-muted-foreground',
  PENDIENTE_REVISION: 'bg-warning-muted text-warning-muted-foreground',
  ACEPTADA: 'bg-success-muted text-success-muted-foreground',
  RECHAZADA: 'bg-destructive/10 text-destructive',
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
  ACTIVA: 'bg-success-muted text-success-muted-foreground',
  CONSUMIDA_PARCIAL: 'bg-info-muted text-info-muted-foreground',
  CONSUMIDA: 'bg-muted text-muted-foreground',
  LIBERADA: 'bg-warning-muted text-warning-muted-foreground',
  EXPIRADA: 'bg-destructive/10 text-destructive',
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
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-info-muted text-info-muted-foreground',
  HIGH: 'bg-warning-muted text-warning-muted-foreground',
  CRITICAL: 'bg-destructive/10 text-destructive',
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
  ENTRADA: 'bg-success-muted text-success-muted-foreground',
  SALIDA: 'bg-destructive/10 text-destructive',
  AJUSTE_POSITIVO: 'bg-info-muted text-info-muted-foreground',
  AJUSTE_NEGATIVO: 'bg-warning-muted text-warning-muted-foreground',
  TRANSFERENCIA_ENTRADA: 'bg-accent-purple-muted text-accent-purple-muted-foreground',
  TRANSFERENCIA_SALIDA: 'bg-accent-purple-muted text-accent-purple-muted-foreground',
  RESERVA: 'bg-warning-muted text-warning-muted-foreground',
  LIBERACION_RESERVA: 'bg-muted text-muted-foreground',
  CONSUMO_RESERVA: 'bg-success-muted text-success-muted-foreground',
};

// ============================================
// TransferStatus - Estados de Transferencia
// ============================================
export const TransferStatuses = [
  'BORRADOR',
  'SOLICITADO',
  'EN_TRANSITO',
  'RECIBIDO_PARCIAL',
  'COMPLETADO',
  'CANCELADO',
] as const;

export type TransferStatus = (typeof TransferStatuses)[number];
export const TransferStatusSchema = z.enum(TransferStatuses);

export const TransferStatusLabels: Record<TransferStatus, string> = {
  BORRADOR: 'Borrador',
  SOLICITADO: 'Solicitado',
  EN_TRANSITO: 'En Tránsito',
  RECIBIDO_PARCIAL: 'Recibido Parcial',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
};

export const TransferStatusColors: Record<TransferStatus, string> = {
  BORRADOR: 'bg-muted text-muted-foreground',
  SOLICITADO: 'bg-info-muted text-info-muted-foreground',
  EN_TRANSITO: 'bg-accent-purple-muted text-accent-purple-muted-foreground',
  RECIBIDO_PARCIAL: 'bg-warning-muted text-warning-muted-foreground',
  COMPLETADO: 'bg-success-muted text-success-muted-foreground',
  CANCELADO: 'bg-destructive/10 text-destructive',
};

// ============================================
// AdjustmentStatus - Estados de Ajuste
// ============================================
export const AdjustmentStatuses = [
  'BORRADOR',
  'PENDIENTE_APROBACION',
  'CONFIRMADO',
  'RECHAZADO',
] as const;

export type AdjustmentStatus = (typeof AdjustmentStatuses)[number];
export const AdjustmentStatusSchema = z.enum(AdjustmentStatuses);

export const AdjustmentStatusLabels: Record<AdjustmentStatus, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente Aprobación',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado',
};

export const AdjustmentStatusColors: Record<AdjustmentStatus, string> = {
  BORRADOR: 'bg-muted text-muted-foreground',
  PENDIENTE_APROBACION: 'bg-warning-muted text-warning-muted-foreground',
  CONFIRMADO: 'bg-success-muted text-success-muted-foreground',
  RECHAZADO: 'bg-destructive/10 text-destructive',
};

// ============================================
// AdjustmentType - Tipos de Ajuste
// ============================================
export const AdjustmentTypes = [
  'INVENTARIO_FISICO',
  'ROTURA',
  'VENCIMIENTO',
  'MERMA',
  'CORRECCION',
  'DEVOLUCION_INTERNA',
] as const;

export type AdjustmentType = (typeof AdjustmentTypes)[number];
export const AdjustmentTypeSchema = z.enum(AdjustmentTypes);

export const AdjustmentTypeLabels: Record<AdjustmentType, string> = {
  INVENTARIO_FISICO: 'Inventario Físico',
  ROTURA: 'Rotura',
  VENCIMIENTO: 'Vencimiento',
  MERMA: 'Merma',
  CORRECCION: 'Corrección',
  DEVOLUCION_INTERNA: 'Devolución Interna',
};
