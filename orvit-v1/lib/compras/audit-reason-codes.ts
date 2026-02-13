/**
 * Audit Reason Codes - Catálogo de códigos de razón para auditoría
 *
 * Define los códigos de razón obligatorios para operaciones críticas.
 * Estos códigos son inmutables y se usan para reportes de auditoría.
 */

// ============================================================
// TIPOS
// ============================================================

export type EntityType =
  | 'PEDIDO'
  | 'OC'
  | 'RECEPCION'
  | 'FACTURA'
  | 'PAGO'
  | 'PROVEEDOR'
  | 'NC_ND'
  | 'MATCH'
  | 'GRNI';

export type ActionType =
  | 'APROBAR'
  | 'RECHAZAR'
  | 'ANULAR'
  | 'MODIFICAR'
  | 'CREAR'
  | 'RESOLVER'
  | 'ESCALAR'
  | 'BLOQUEAR'
  | 'LIBERAR';

export interface ReasonCode {
  code: string;
  label: string;
  description: string;
  category: 'APPROVAL' | 'REJECTION' | 'CANCELLATION' | 'MODIFICATION' | 'RESOLUTION' | 'OPERATIONAL';
  entityTypes: EntityType[];
  actionTypes: ActionType[];
  requiresText: boolean;  // Si requiere texto adicional
  isDefault?: boolean;
}

// ============================================================
// CATÁLOGO DE REASON CODES
// ============================================================

export const REASON_CODES: ReasonCode[] = [
  // === APROBACIONES ===
  {
    code: 'APPROVED_STANDARD',
    label: 'Aprobación estándar',
    description: 'Cumple todos los requisitos para aprobación',
    category: 'APPROVAL',
    entityTypes: ['PEDIDO', 'OC', 'PAGO', 'NC_ND'],
    actionTypes: ['APROBAR'],
    requiresText: false,
    isDefault: true,
  },
  {
    code: 'APPROVED_WITH_EXCEPTION',
    label: 'Aprobación con excepción',
    description: 'Aprobado a pesar de no cumplir todos los requisitos',
    category: 'APPROVAL',
    entityTypes: ['PEDIDO', 'OC', 'PAGO', 'FACTURA', 'MATCH'],
    actionTypes: ['APROBAR', 'LIBERAR'],
    requiresText: true,
  },
  {
    code: 'APPROVED_URGENT',
    label: 'Aprobación urgente',
    description: 'Aprobado por urgencia operativa',
    category: 'APPROVAL',
    entityTypes: ['PEDIDO', 'OC', 'PAGO'],
    actionTypes: ['APROBAR'],
    requiresText: true,
  },
  {
    code: 'APPROVED_BY_MANAGER',
    label: 'Aprobación gerencial',
    description: 'Aprobado por autorización gerencial',
    category: 'APPROVAL',
    entityTypes: ['PEDIDO', 'OC', 'PAGO', 'PROVEEDOR'],
    actionTypes: ['APROBAR'],
    requiresText: false,
  },

  // === RECHAZOS ===
  {
    code: 'REJECTED_BUDGET',
    label: 'Rechazado por presupuesto',
    description: 'Excede el presupuesto disponible',
    category: 'REJECTION',
    entityTypes: ['PEDIDO', 'OC'],
    actionTypes: ['RECHAZAR'],
    requiresText: false,
  },
  {
    code: 'REJECTED_POLICY',
    label: 'Rechazado por política',
    description: 'No cumple con las políticas de la empresa',
    category: 'REJECTION',
    entityTypes: ['PEDIDO', 'OC', 'PAGO', 'PROVEEDOR'],
    actionTypes: ['RECHAZAR'],
    requiresText: true,
  },
  {
    code: 'REJECTED_DOCUMENTATION',
    label: 'Rechazado por documentación',
    description: 'Documentación incompleta o incorrecta',
    category: 'REJECTION',
    entityTypes: ['PEDIDO', 'OC', 'FACTURA', 'PAGO', 'PROVEEDOR'],
    actionTypes: ['RECHAZAR'],
    requiresText: true,
  },
  {
    code: 'REJECTED_PRICE',
    label: 'Rechazado por precio',
    description: 'Precio fuera de rango aceptable',
    category: 'REJECTION',
    entityTypes: ['PEDIDO', 'OC', 'FACTURA'],
    actionTypes: ['RECHAZAR'],
    requiresText: false,
  },
  {
    code: 'REJECTED_QUALITY',
    label: 'Rechazado por calidad',
    description: 'No cumple estándares de calidad',
    category: 'REJECTION',
    entityTypes: ['RECEPCION'],
    actionTypes: ['RECHAZAR'],
    requiresText: true,
  },
  {
    code: 'REJECTED_DUPLICATE',
    label: 'Rechazado por duplicado',
    description: 'Documento duplicado o ya procesado',
    category: 'REJECTION',
    entityTypes: ['FACTURA', 'PAGO'],
    actionTypes: ['RECHAZAR'],
    requiresText: false,
  },

  // === ANULACIONES ===
  {
    code: 'CANCELLED_BY_USER',
    label: 'Anulado por usuario',
    description: 'Anulado a solicitud del usuario',
    category: 'CANCELLATION',
    entityTypes: ['PEDIDO', 'OC', 'RECEPCION', 'PAGO'],
    actionTypes: ['ANULAR'],
    requiresText: true,
  },
  {
    code: 'CANCELLED_ERROR',
    label: 'Anulado por error',
    description: 'Anulado debido a error en la carga',
    category: 'CANCELLATION',
    entityTypes: ['PEDIDO', 'OC', 'RECEPCION', 'FACTURA', 'PAGO'],
    actionTypes: ['ANULAR'],
    requiresText: true,
  },
  {
    code: 'CANCELLED_SUPPLIER',
    label: 'Anulado por proveedor',
    description: 'Anulado a solicitud del proveedor',
    category: 'CANCELLATION',
    entityTypes: ['OC'],
    actionTypes: ['ANULAR'],
    requiresText: true,
  },
  {
    code: 'CANCELLED_OBSOLETE',
    label: 'Anulado por obsolescencia',
    description: 'Ya no se requiere el producto/servicio',
    category: 'CANCELLATION',
    entityTypes: ['PEDIDO', 'OC'],
    actionTypes: ['ANULAR'],
    requiresText: false,
  },

  // === MODIFICACIONES ===
  {
    code: 'MODIFIED_PRICE',
    label: 'Modificación de precio',
    description: 'Actualización de precio',
    category: 'MODIFICATION',
    entityTypes: ['OC', 'FACTURA'],
    actionTypes: ['MODIFICAR'],
    requiresText: true,
  },
  {
    code: 'MODIFIED_QUANTITY',
    label: 'Modificación de cantidad',
    description: 'Cambio en cantidad',
    category: 'MODIFICATION',
    entityTypes: ['OC', 'RECEPCION'],
    actionTypes: ['MODIFICAR'],
    requiresText: true,
  },
  {
    code: 'MODIFIED_BANK_DATA',
    label: 'Modificación datos bancarios',
    description: 'Cambio en datos bancarios del proveedor',
    category: 'MODIFICATION',
    entityTypes: ['PROVEEDOR'],
    actionTypes: ['MODIFICAR'],
    requiresText: true,
  },
  {
    code: 'MODIFIED_CORRECTION',
    label: 'Corrección de datos',
    description: 'Corrección de datos erróneos',
    category: 'MODIFICATION',
    entityTypes: ['PEDIDO', 'OC', 'RECEPCION', 'FACTURA', 'PROVEEDOR'],
    actionTypes: ['MODIFICAR'],
    requiresText: true,
  },

  // === RESOLUCIONES (Match exceptions) ===
  {
    code: 'RESOLVED_WITHIN_TOLERANCE',
    label: 'Resuelto dentro de tolerancia',
    description: 'Diferencia dentro de límites aceptables',
    category: 'RESOLUTION',
    entityTypes: ['MATCH'],
    actionTypes: ['RESOLVER'],
    requiresText: false,
  },
  {
    code: 'RESOLVED_NC_REQUESTED',
    label: 'NC solicitada',
    description: 'Se solicitó nota de crédito al proveedor',
    category: 'RESOLUTION',
    entityTypes: ['MATCH', 'FACTURA'],
    actionTypes: ['RESOLVER'],
    requiresText: false,
  },
  {
    code: 'RESOLVED_ND_REQUESTED',
    label: 'ND solicitada',
    description: 'Se solicitó nota de débito al proveedor',
    category: 'RESOLUTION',
    entityTypes: ['MATCH', 'FACTURA'],
    actionTypes: ['RESOLVER'],
    requiresText: false,
  },
  {
    code: 'RESOLVED_RECEPTION_CORRECTED',
    label: 'Recepción corregida',
    description: 'Se corrigió la recepción',
    category: 'RESOLUTION',
    entityTypes: ['MATCH'],
    actionTypes: ['RESOLVER'],
    requiresText: true,
  },
  {
    code: 'RESOLVED_APPROVED_EXCEPTION',
    label: 'Aprobado por excepción',
    description: 'Se aprueba el pago a pesar de la diferencia',
    category: 'RESOLUTION',
    entityTypes: ['MATCH'],
    actionTypes: ['RESOLVER', 'APROBAR'],
    requiresText: true,
  },

  // === OPERACIONALES ===
  {
    code: 'BLOCKED_MATCH_EXCEPTION',
    label: 'Bloqueado por excepción de match',
    description: 'Pago bloqueado por discrepancias en match',
    category: 'OPERATIONAL',
    entityTypes: ['PAGO', 'FACTURA'],
    actionTypes: ['BLOQUEAR'],
    requiresText: false,
  },
  {
    code: 'BLOCKED_SUPPLIER_INACTIVE',
    label: 'Bloqueado por proveedor inactivo',
    description: 'Proveedor bloqueado o inactivo',
    category: 'OPERATIONAL',
    entityTypes: ['PAGO', 'OC'],
    actionTypes: ['BLOQUEAR'],
    requiresText: false,
  },
  {
    code: 'RELEASED_MANAGER_APPROVAL',
    label: 'Liberado por aprobación gerencial',
    description: 'Bloqueo liberado por autorización gerencial',
    category: 'OPERATIONAL',
    entityTypes: ['PAGO', 'FACTURA'],
    actionTypes: ['LIBERAR'],
    requiresText: true,
  },
  {
    code: 'ESCALATED_SLA_BREACH',
    label: 'Escalado por incumplimiento SLA',
    description: 'Escalado automático por SLA vencido',
    category: 'OPERATIONAL',
    entityTypes: ['MATCH', 'GRNI'],
    actionTypes: ['ESCALAR'],
    requiresText: false,
  },
  {
    code: 'ESCALATED_MANUAL',
    label: 'Escalado manual',
    description: 'Escalado manualmente por usuario',
    category: 'OPERATIONAL',
    entityTypes: ['MATCH', 'PEDIDO', 'PAGO'],
    actionTypes: ['ESCALAR'],
    requiresText: true,
  },
];

// ============================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================

/**
 * Obtiene los reason codes válidos para una entidad y acción
 */
export function getValidReasonCodes(
  entityType: EntityType,
  actionType: ActionType
): ReasonCode[] {
  return REASON_CODES.filter(
    rc => rc.entityTypes.includes(entityType) && rc.actionTypes.includes(actionType)
  );
}

/**
 * Obtiene el reason code por defecto para una acción
 */
export function getDefaultReasonCode(
  entityType: EntityType,
  actionType: ActionType
): ReasonCode | null {
  const valid = getValidReasonCodes(entityType, actionType);
  return valid.find(rc => rc.isDefault) || valid[0] || null;
}

/**
 * Valida si un reason code es válido para la operación
 */
export function isValidReasonCode(
  code: string,
  entityType: EntityType,
  actionType: ActionType
): boolean {
  const valid = getValidReasonCodes(entityType, actionType);
  return valid.some(rc => rc.code === code);
}

/**
 * Obtiene un reason code por su código
 */
export function getReasonCode(code: string): ReasonCode | null {
  return REASON_CODES.find(rc => rc.code === code) || null;
}

/**
 * Valida los parámetros de razón para una operación
 * Retorna error si no cumple los requisitos
 */
export function validateReasonParams(
  entityType: EntityType,
  actionType: ActionType,
  reasonCode: string | null | undefined,
  reasonText: string | null | undefined
): { valid: boolean; error?: string } {
  // Acciones que SIEMPRE requieren reason code
  const actionsRequiringReason: ActionType[] = ['RECHAZAR', 'ANULAR', 'MODIFICAR', 'RESOLVER', 'ESCALAR', 'LIBERAR'];

  if (actionsRequiringReason.includes(actionType)) {
    if (!reasonCode) {
      return {
        valid: false,
        error: `La acción ${actionType} requiere un código de razón`,
      };
    }

    // Verificar que el código sea válido
    if (!isValidReasonCode(reasonCode, entityType, actionType)) {
      const validCodes = getValidReasonCodes(entityType, actionType).map(rc => rc.code);
      return {
        valid: false,
        error: `Código de razón '${reasonCode}' no válido para ${entityType}/${actionType}. Válidos: ${validCodes.join(', ')}`,
      };
    }

    // Verificar si requiere texto
    const rc = getReasonCode(reasonCode);
    if (rc?.requiresText && !reasonText?.trim()) {
      return {
        valid: false,
        error: `El código de razón '${reasonCode}' requiere texto explicativo`,
      };
    }
  }

  return { valid: true };
}

// ============================================================
// HELPER PARA AUDIT LOG
// ============================================================

export interface AuditReasonParams {
  reasonCode: string;
  reasonText?: string;
}

/**
 * Prepara los parámetros de razón para guardar en audit log
 */
export function prepareAuditReason(
  entityType: EntityType,
  actionType: ActionType,
  params?: AuditReasonParams | null
): { reasonCode: string | null; reasonText: string | null } {
  if (!params?.reasonCode) {
    // Usar default si existe
    const defaultRc = getDefaultReasonCode(entityType, actionType);
    return {
      reasonCode: defaultRc?.code || null,
      reasonText: null,
    };
  }

  return {
    reasonCode: params.reasonCode,
    reasonText: params.reasonText || null,
  };
}

/**
 * Obtiene el label legible de un reason code
 */
export function getReasonLabel(code: string | null): string {
  if (!code) return 'Sin especificar';
  const rc = getReasonCode(code);
  return rc?.label || code;
}
