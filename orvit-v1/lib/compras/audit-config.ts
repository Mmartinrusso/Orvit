import type { LucideIcon } from 'lucide-react';
import {
  ShoppingCart,
  Package,
  FileText,
  CreditCard,
  HandCoins,
  Receipt,
  ArrowRightLeft,
  ClipboardCheck,
} from 'lucide-react';

// Tipos de entidades auditables
export type AuditableEntity =
  | 'purchase_order'
  | 'goods_receipt'
  | 'purchase_receipt'
  | 'payment_order'
  | 'payment_request'
  | 'credit_debit_note'
  | 'stock_transfer'
  | 'stock_adjustment';

// Tipos de acciones de auditoría
export type AuditAction =
  | 'CREATE'
  | 'STATUS_CHANGE'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'COMPLETE'
  | 'DELETE';

// Metadata estructurada para auditoría
export interface AuditMetadata {
  reason?: string;
  amount?: number;
  estadoAnterior?: string;
  estadoNuevo?: string;
  relatedIds?: Array<{ entity: AuditableEntity; id: number; numero?: string }>;
  [key: string]: unknown;
}

// Configuración de entidades
export interface EntidadConfigItem {
  icon: LucideIcon;
  label: string;
  labelPlural: string;
  urlBase: string;
  permiso: string;
}

export const ENTIDAD_CONFIG: Record<AuditableEntity, EntidadConfigItem> = {
  purchase_order: {
    icon: ShoppingCart,
    label: 'Orden de Compra',
    labelPlural: 'Órdenes de Compra',
    urlBase: '/administracion/compras/ordenes',
    permiso: 'compras.ordenes.view',
  },
  goods_receipt: {
    icon: Package,
    label: 'Recepción',
    labelPlural: 'Recepciones',
    urlBase: '/administracion/compras/recepciones',
    permiso: 'compras.recepciones.view',
  },
  purchase_receipt: {
    icon: FileText,
    label: 'Comprobante',
    labelPlural: 'Comprobantes',
    urlBase: '/administracion/compras/comprobantes',
    permiso: 'compras.comprobantes.view',
  },
  payment_order: {
    icon: CreditCard,
    label: 'Orden de Pago',
    labelPlural: 'Órdenes de Pago',
    urlBase: '/administracion/compras/pagos',
    permiso: 'compras.pagos.view',
  },
  payment_request: {
    icon: HandCoins,
    label: 'Solicitud de Pago',
    labelPlural: 'Solicitudes',
    urlBase: '/administracion/compras/solicitudes',
    permiso: 'compras.solicitudes.view',
  },
  credit_debit_note: {
    icon: Receipt,
    label: 'Nota Cr/Db',
    labelPlural: 'Notas Cr/Db',
    urlBase: '/administracion/compras/notas',
    permiso: 'compras.notas.view',
  },
  stock_transfer: {
    icon: ArrowRightLeft,
    label: 'Transferencia',
    labelPlural: 'Transferencias',
    urlBase: '/administracion/compras/stock/transferencias',
    permiso: 'compras.stock.view',
  },
  stock_adjustment: {
    icon: ClipboardCheck,
    label: 'Ajuste de Stock',
    labelPlural: 'Ajustes de Stock',
    urlBase: '/administracion/compras/stock/ajustes',
    permiso: 'compras.stock.view',
  },
};

// Configuración de acciones - colores por ACCIÓN (no por entidad)
export interface AccionConfigItem {
  label: string;
  color: string;
  variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary';
}

export const ACCION_CONFIG: Record<AuditAction, AccionConfigItem> = {
  CREATE: {
    label: 'Creado',
    color: 'text-blue-600',
    variant: 'default',
  },
  STATUS_CHANGE: {
    label: 'Cambio de Estado',
    color: 'text-gray-600',
    variant: 'secondary',
  },
  APPROVE: {
    label: 'Aprobado',
    color: 'text-green-600',
    variant: 'success',
  },
  REJECT: {
    label: 'Rechazado',
    color: 'text-red-600',
    variant: 'destructive',
  },
  CANCEL: {
    label: 'Cancelado',
    color: 'text-red-500',
    variant: 'destructive',
  },
  COMPLETE: {
    label: 'Completado',
    color: 'text-green-500',
    variant: 'success',
  },
  DELETE: {
    label: 'Eliminado',
    color: 'text-red-700',
    variant: 'destructive',
  },
};

// Generar mensaje human-friendly
export function buildHumanMessage(
  accion: AuditAction,
  metadata?: AuditMetadata
): string {
  if (
    accion === 'STATUS_CHANGE' &&
    metadata?.estadoAnterior &&
    metadata?.estadoNuevo
  ) {
    return `${metadata.estadoAnterior} → ${metadata.estadoNuevo}`;
  }
  if (accion === 'APPROVE') return 'Aprobado';
  if (accion === 'REJECT')
    return metadata?.reason ? `Rechazado: ${metadata.reason}` : 'Rechazado';
  if (accion === 'CANCEL')
    return metadata?.reason ? `Cancelado: ${metadata.reason}` : 'Cancelado';
  if (accion === 'CREATE') return 'Creado';
  if (accion === 'COMPLETE') return 'Completado';
  if (accion === 'DELETE') return 'Eliminado';
  return ACCION_CONFIG[accion]?.label || accion;
}

// Construir URL del documento
export function buildDocumentUrl(
  entidad: AuditableEntity,
  entidadId: number
): string {
  const config = ENTIDAD_CONFIG[entidad];
  if (!config) return '#';
  return `${config.urlBase}/${entidadId}`;
}

// Obtener label de entidad
export function getEntidadLabel(entidad: AuditableEntity): string {
  return ENTIDAD_CONFIG[entidad]?.label || entidad;
}

// Obtener icono de entidad
export function getEntidadIcon(entidad: AuditableEntity): LucideIcon {
  return ENTIDAD_CONFIG[entidad]?.icon || FileText;
}

// Obtener config de acción
export function getAccionConfig(accion: AuditAction): AccionConfigItem {
  return (
    ACCION_CONFIG[accion] || {
      label: accion,
      color: 'text-gray-500',
      variant: 'secondary' as const,
    }
  );
}
