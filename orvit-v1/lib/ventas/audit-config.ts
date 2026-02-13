import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  ShoppingBag,
  Truck,
  FileCheck,
  Receipt,
  CreditCard,
  Wallet,
  BookOpen,
  Percent,
  CheckCircle,
} from 'lucide-react';

// Tipos de entidades auditables en ventas
export type SalesAuditableEntity =
  | 'quote'
  | 'sale'
  | 'delivery'
  | 'remito'
  | 'sales_invoice'
  | 'sales_credit_debit_note'
  | 'client_payment'
  | 'ledger_entry'
  | 'price_list'
  | 'sales_approval';

// Tipos de acciones de auditoría para ventas
export type SalesAuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'STATUS_CHANGE'
  | 'SEND'
  | 'APPROVE'
  | 'REJECT'
  | 'CONVERT'
  | 'CANCEL'
  | 'COMPLETE'
  | 'DELETE'
  | 'EMIT'
  | 'VOID'
  | 'ACCEPT'
  | 'APPLY_PAYMENT'
  | 'REVERSE'
  | 'ACCESS_DENIED';

// Metadata estructurada para auditoría de ventas
export interface SalesAuditMetadata {
  reason?: string;
  amount?: number;
  estadoAnterior?: string;
  estadoNuevo?: string;
  clientId?: string | number; // string para cuid, number para legacy
  clientName?: string;
  documentNumber?: string;
  // Para tracking de conversiones
  sourceEntity?: SalesAuditableEntity;
  sourceId?: number;
  sourceNumber?: string;
  // Para tracking de relaciones
  relatedIds?: Array<{ entity: SalesAuditableEntity; id: number; numero?: string }>;
  // Para pagos
  paymentMethod?: string;
  invoiceIds?: number[];
  // Para cotizaciones
  version?: number;
  acceptedBy?: string;
  acceptedAt?: string;
  ipAddress?: string;
  // Para márgenes (solo para usuarios con permiso)
  margin?: number;
  cost?: number;
  // Para accesos denegados
  requiredPermission?: string;
  resource?: string;
  // Datos adicionales
  [key: string]: unknown;
}

// Configuración de entidades de ventas
export interface SalesEntidadConfigItem {
  icon: LucideIcon;
  label: string;
  labelPlural: string;
  urlBase: string;
  permiso: string;
}

export const SALES_ENTIDAD_CONFIG: Record<SalesAuditableEntity, SalesEntidadConfigItem> = {
  quote: {
    icon: FileText,
    label: 'Cotización',
    labelPlural: 'Cotizaciones',
    urlBase: '/administracion/ventas/cotizaciones',
    permiso: 'ventas.cotizaciones.view',
  },
  sale: {
    icon: ShoppingBag,
    label: 'Orden de Venta',
    labelPlural: 'Órdenes de Venta',
    urlBase: '/administracion/ventas/ordenes',
    permiso: 'ventas.ordenes.view',
  },
  delivery: {
    icon: Truck,
    label: 'Entrega',
    labelPlural: 'Entregas',
    urlBase: '/administracion/ventas/entregas',
    permiso: 'ventas.entregas.view',
  },
  remito: {
    icon: FileCheck,
    label: 'Remito',
    labelPlural: 'Remitos',
    urlBase: '/administracion/ventas/remitos',
    permiso: 'ventas.remitos.view',
  },
  sales_invoice: {
    icon: Receipt,
    label: 'Factura',
    labelPlural: 'Facturas',
    urlBase: '/administracion/ventas/facturas',
    permiso: 'ventas.facturas.view',
  },
  sales_credit_debit_note: {
    icon: Percent,
    label: 'Nota Cr/Db',
    labelPlural: 'Notas Cr/Db',
    urlBase: '/administracion/ventas/notas-credito-debito',
    permiso: 'ventas.notas.view',
  },
  client_payment: {
    icon: CreditCard,
    label: 'Pago',
    labelPlural: 'Pagos',
    urlBase: '/administracion/ventas/pagos',
    permiso: 'ventas.pagos.view',
  },
  ledger_entry: {
    icon: BookOpen,
    label: 'Movimiento CC',
    labelPlural: 'Movimientos CC',
    urlBase: '/administracion/ventas/cuenta-corriente',
    permiso: 'ventas.cuenta_corriente.view',
  },
  price_list: {
    icon: Wallet,
    label: 'Lista de Precios',
    labelPlural: 'Listas de Precios',
    urlBase: '/administracion/ventas/listas-precios',
    permiso: 'ventas.listas_precios.view',
  },
  sales_approval: {
    icon: CheckCircle,
    label: 'Aprobación',
    labelPlural: 'Aprobaciones',
    urlBase: '/administracion/ventas/aprobaciones',
    permiso: 'ventas.aprobaciones.view',
  },
};

// Configuración de acciones - colores por ACCIÓN
export interface SalesAccionConfigItem {
  label: string;
  color: string;
  variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary';
}

export const SALES_ACCION_CONFIG: Record<SalesAuditAction, SalesAccionConfigItem> = {
  CREATE: {
    label: 'Creado',
    color: 'text-blue-600',
    variant: 'default',
  },
  UPDATE: {
    label: 'Actualizado',
    color: 'text-blue-500',
    variant: 'default',
  },
  STATUS_CHANGE: {
    label: 'Cambio de Estado',
    color: 'text-gray-600',
    variant: 'secondary',
  },
  SEND: {
    label: 'Enviado',
    color: 'text-indigo-600',
    variant: 'default',
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
  CONVERT: {
    label: 'Convertido',
    color: 'text-purple-600',
    variant: 'default',
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
  EMIT: {
    label: 'Emitido',
    color: 'text-green-600',
    variant: 'success',
  },
  VOID: {
    label: 'Anulado',
    color: 'text-red-600',
    variant: 'destructive',
  },
  ACCEPT: {
    label: 'Aceptado',
    color: 'text-green-600',
    variant: 'success',
  },
  APPLY_PAYMENT: {
    label: 'Pago Aplicado',
    color: 'text-emerald-600',
    variant: 'success',
  },
  REVERSE: {
    label: 'Reversado',
    color: 'text-orange-600',
    variant: 'warning',
  },
  ACCESS_DENIED: {
    label: 'Acceso Denegado',
    color: 'text-red-700',
    variant: 'destructive',
  },
};

// Generar mensaje human-friendly para ventas
export function buildSalesHumanMessage(
  accion: SalesAuditAction,
  metadata?: SalesAuditMetadata
): string {
  if (
    accion === 'STATUS_CHANGE' &&
    metadata?.estadoAnterior &&
    metadata?.estadoNuevo
  ) {
    return `${metadata.estadoAnterior} → ${metadata.estadoNuevo}`;
  }

  if (accion === 'CONVERT' && metadata?.sourceNumber) {
    return `Convertido desde ${metadata.sourceNumber}`;
  }

  if (accion === 'SEND' && metadata?.clientName) {
    return `Enviado a ${metadata.clientName}`;
  }

  if (accion === 'ACCEPT' && metadata?.acceptedBy) {
    return `Aceptado por ${metadata.acceptedBy}`;
  }

  if (accion === 'APPLY_PAYMENT' && metadata?.amount) {
    return `Pago aplicado: $${metadata.amount.toLocaleString('es-AR')}`;
  }

  if (accion === 'APPROVE') return 'Aprobado';
  if (accion === 'REJECT')
    return metadata?.reason ? `Rechazado: ${metadata.reason}` : 'Rechazado';
  if (accion === 'CANCEL')
    return metadata?.reason ? `Cancelado: ${metadata.reason}` : 'Cancelado';
  if (accion === 'VOID')
    return metadata?.reason ? `Anulado: ${metadata.reason}` : 'Anulado';
  if (accion === 'ACCESS_DENIED') {
    const perm = (metadata as any)?.requiredPermission;
    return perm ? `Acceso denegado: ${perm}` : 'Acceso denegado';
  }
  if (accion === 'CREATE') return 'Creado';
  if (accion === 'UPDATE') return 'Actualizado';
  if (accion === 'COMPLETE') return 'Completado';
  if (accion === 'DELETE') return 'Eliminado';
  if (accion === 'EMIT') return 'Emitido';
  if (accion === 'REVERSE') return 'Reversado';

  return SALES_ACCION_CONFIG[accion]?.label || accion;
}

// Construir URL del documento de ventas
export function buildSalesDocumentUrl(
  entidad: SalesAuditableEntity,
  entidadId: number
): string {
  const config = SALES_ENTIDAD_CONFIG[entidad];
  if (!config) return '#';
  return `${config.urlBase}/${entidadId}`;
}

// Obtener label de entidad de ventas
export function getSalesEntidadLabel(entidad: SalesAuditableEntity): string {
  return SALES_ENTIDAD_CONFIG[entidad]?.label || entidad;
}

// Obtener icono de entidad de ventas
export function getSalesEntidadIcon(entidad: SalesAuditableEntity): LucideIcon {
  return SALES_ENTIDAD_CONFIG[entidad]?.icon || FileText;
}

// Obtener config de acción de ventas
export function getSalesAccionConfig(accion: SalesAuditAction): SalesAccionConfigItem {
  return (
    SALES_ACCION_CONFIG[accion] || {
      label: accion,
      color: 'text-gray-500',
      variant: 'secondary' as const,
    }
  );
}

// Mapear tipo de entidad Prisma a nuestra configuración
export function mapPrismaEntityToAuditable(prismaEntity: string): SalesAuditableEntity | null {
  const mapping: Record<string, SalesAuditableEntity> = {
    Quote: 'quote',
    Sale: 'sale',
    SaleDelivery: 'delivery',
    SaleRemito: 'remito',
    SalesInvoice: 'sales_invoice',
    SalesCreditDebitNote: 'sales_credit_debit_note',
    ClientPayment: 'client_payment',
    ClientLedgerEntry: 'ledger_entry',
    SalesPriceList: 'price_list',
    SalesApproval: 'sales_approval',
  };
  return mapping[prismaEntity] || null;
}
