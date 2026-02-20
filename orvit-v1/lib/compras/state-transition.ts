/**
 * State Transition Gateway - Sistema Unificado de Transiciones de Estado
 *
 * Este módulo centraliza TODAS las transiciones de estado críticas del sistema P2P.
 * Garantiza:
 * - Invariantes de negocio
 * - Segregación de funciones (SoD)
 * - Auditoría completa
 * - Idempotencia
 *
 * REGLA DE ORO: Ningún endpoint debe cambiar estado directamente.
 * Todos deben usar este gateway.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import {
  validateReasonParams,
  EntityType as ReasonEntityType,
  ActionType as ReasonActionType,
} from './audit-reason-codes';

// =====================================================
// TIPOS Y ENUMS
// =====================================================

export type EntityType =
  | 'PurchaseRequest'
  | 'PurchaseOrder'
  | 'GoodsReceipt'
  | 'PurchaseReceipt'
  | 'PaymentOrder'
  | 'CreditDebitNote'
  | 'PurchaseReturn'
  | 'SupplierChangeRequest';

export type TransitionAction =
  | 'CREAR'
  | 'ENVIAR_APROBACION'
  | 'APROBAR'
  | 'RECHAZAR'
  | 'CONFIRMAR'
  | 'ANULAR'
  | 'EJECUTAR'
  | 'REVERTIR'
  | 'CERRAR'
  | 'CANCELAR';

export interface TransitionContext {
  userId: number;
  companyId: number;
  entityType: EntityType;
  entityId: number;
  action: TransitionAction;
  reasonCode?: string;
  reasonText?: string;
  metadata?: Record<string, unknown>;
  skipSoD?: boolean; // Solo para casos excepcionales con doble aprobación
  idempotencyKey?: string;
}

export interface TransitionResult {
  success: boolean;
  fromState: string | null;
  toState: string;
  transitionId?: number;
  error?: string;
  errorCode?: string;
  sodCheckResult?: SoDCheckResult;
  eligibilityResult?: EligibilityCheckResult;
}

interface SoDCheckResult {
  allowed: boolean;
  ruleCode?: string;
  message?: string;
  conflictingAction?: string;
  conflictingUserId?: number;
}

interface EligibilityCheckResult {
  eligible: boolean;
  reason?: string;
  code?: string;
  details?: Record<string, unknown>;
}

// =====================================================
// DEFINICIÓN DE MÁQUINAS DE ESTADO
// =====================================================

interface StateDefinition {
  allowedTransitions: Record<string, TransitionAction[]>;
  requiresApproval?: string[];
  requiresSoD?: TransitionAction[];
  requiresEligibility?: TransitionAction[];
  isFinal?: string[];
}

const STATE_MACHINES: Record<EntityType, StateDefinition> = {
  PurchaseRequest: {
    allowedTransitions: {
      BORRADOR: ['ENVIAR_APROBACION', 'ANULAR'],
      EN_APROBACION: ['APROBAR', 'RECHAZAR'],
      APROBADA: ['CERRAR', 'ANULAR'],
      RECHAZADA: ['ANULAR'],
      CONVERTIDA_OC: [],
      ANULADA: [],
    },
    requiresSoD: ['APROBAR'],
    isFinal: ['CONVERTIDA_OC', 'ANULADA'],
  },
  PurchaseOrder: {
    allowedTransitions: {
      BORRADOR: ['ENVIAR_APROBACION', 'ANULAR'],
      EN_APROBACION: ['APROBAR', 'RECHAZAR'],
      APROBADA: ['CONFIRMAR', 'ANULAR'],
      ENVIADA_PROVEEDOR: ['CONFIRMAR', 'CANCELAR'],
      CONFIRMADA: ['CERRAR'],
      PARCIALMENTE_RECIBIDA: ['CERRAR'],
      COMPLETADA: [],
      CANCELADA: [],
    },
    requiresSoD: ['APROBAR'],
    isFinal: ['COMPLETADA', 'CANCELADA'],
  },
  GoodsReceipt: {
    allowedTransitions: {
      BORRADOR: ['CONFIRMAR', 'ANULAR'],
      CONFIRMADA: ['ANULAR'],
      ANULADA: [],
    },
    requiresSoD: ['CONFIRMAR'],
    requiresEligibility: ['CONFIRMAR'],
    isFinal: ['ANULADA'],
  },
  PurchaseReceipt: {
    allowedTransitions: {
      pendiente: ['APROBAR', 'ANULAR'],
      aprobada: ['EJECUTAR', 'ANULAR'],
      parcial: ['EJECUTAR', 'ANULAR'],
      pagada: ['REVERTIR'],
      anulada: [],
    },
    requiresEligibility: ['EJECUTAR'],
    isFinal: ['anulada'],
  },
  PaymentOrder: {
    allowedTransitions: {
      BORRADOR: ['ENVIAR_APROBACION', 'ANULAR'],
      PENDIENTE: ['ENVIAR_APROBACION', 'ANULAR'],
      PENDIENTE_APROBACION: ['APROBAR', 'RECHAZAR'],
      APROBADA: ['EJECUTAR', 'ANULAR'],
      EJECUTADO: ['REVERTIR'],
      RECHAZADA: ['ANULAR'],
      REVERSADO: [],
      ANULADO: [],
    },
    requiresApproval: ['PENDIENTE_APROBACION'],
    requiresSoD: ['APROBAR', 'EJECUTAR'],
    requiresEligibility: ['EJECUTAR'],
    isFinal: ['REVERSADO', 'ANULADO'],
  },
  CreditDebitNote: {
    allowedTransitions: {
      PENDIENTE: ['APROBAR', 'ANULAR'],
      APROBADA: ['EJECUTAR'],
      APLICADA: [],
      ANULADA: [],
    },
    isFinal: ['APLICADA', 'ANULADA'],
  },
  PurchaseReturn: {
    allowedTransitions: {
      BORRADOR: ['CONFIRMAR', 'ANULAR'],
      CONFIRMADA: ['EJECUTAR', 'ANULAR'],
      EJECUTADA: [],
      ANULADA: [],
    },
    isFinal: ['EJECUTADA', 'ANULADA'],
  },
  SupplierChangeRequest: {
    allowedTransitions: {
      PENDIENTE_APROBACION: ['APROBAR', 'RECHAZAR'],
      APROBADO: [],
      RECHAZADO: [],
    },
    requiresApproval: ['PENDIENTE_APROBACION'],
    requiresSoD: ['APROBAR'],
    isFinal: ['APROBADO', 'RECHAZADO'],
  },
};

// Mapeo de acciones a estados destino
const ACTION_TO_STATE: Record<TransitionAction, string> = {
  CREAR: 'BORRADOR',
  ENVIAR_APROBACION: 'EN_APROBACION',
  APROBAR: 'APROBADA',
  RECHAZAR: 'RECHAZADA',
  CONFIRMAR: 'CONFIRMADA',
  ANULAR: 'ANULADA',
  EJECUTAR: 'EJECUTADO',
  REVERTIR: 'REVERSADO',
  CERRAR: 'COMPLETADA',
  CANCELAR: 'CANCELADA',
};

// Mapeo específico por entidad cuando difiere del default
const ENTITY_ACTION_TO_STATE: Partial<Record<EntityType, Partial<Record<TransitionAction, string>>>> = {
  PaymentOrder: {
    ANULAR: 'ANULADO',
    ENVIAR_APROBACION: 'PENDIENTE_APROBACION',
  },
  PurchaseReceipt: {
    EJECUTAR: 'pagada',
    ANULAR: 'anulada',
    APROBAR: 'aprobada',
  },
  SupplierChangeRequest: {
    APROBAR: 'APROBADO',
    RECHAZAR: 'RECHAZADO',
  },
};

// Mapeo de EntityType a ReasonEntityType para validación de códigos de razón
const ENTITY_TO_REASON_ENTITY: Record<EntityType, ReasonEntityType> = {
  PurchaseRequest: 'PEDIDO',
  PurchaseOrder: 'OC',
  GoodsReceipt: 'RECEPCION',
  PurchaseReceipt: 'FACTURA',
  PaymentOrder: 'PAGO',
  CreditDebitNote: 'NC_ND',
  PurchaseReturn: 'RECEPCION', // Usa la misma validación que recepción
  SupplierChangeRequest: 'PROVEEDOR',
};

// Mapeo de TransitionAction a ReasonActionType
const ACTION_TO_REASON_ACTION: Record<TransitionAction, ReasonActionType> = {
  CREAR: 'CREAR',
  ENVIAR_APROBACION: 'CREAR', // No requiere razón especial
  APROBAR: 'APROBAR',
  RECHAZAR: 'RECHAZAR',
  CONFIRMAR: 'APROBAR',
  ANULAR: 'ANULAR',
  EJECUTAR: 'CREAR',
  REVERTIR: 'ANULAR',
  CERRAR: 'CREAR',
  CANCELAR: 'ANULAR',
};

// Acciones que SIEMPRE requieren reason code
const ACTIONS_REQUIRING_REASON: TransitionAction[] = [
  'RECHAZAR',
  'ANULAR',
  'REVERTIR',
  'CANCELAR',
];

// =====================================================
// FUNCIONES DE VERIFICACIÓN
// =====================================================

/**
 * Verifica si la transición es válida según la máquina de estados
 */
function isTransitionAllowed(
  entityType: EntityType,
  currentState: string | null,
  action: TransitionAction
): { allowed: boolean; reason?: string } {
  const machine = STATE_MACHINES[entityType];
  if (!machine) {
    return { allowed: false, reason: `Entidad ${entityType} no tiene máquina de estados definida` };
  }

  // Para creación, no hay estado previo
  if (action === 'CREAR') {
    return { allowed: true };
  }

  if (!currentState) {
    return { allowed: false, reason: 'Estado actual es null' };
  }

  const allowedActions = machine.allowedTransitions[currentState];
  if (!allowedActions) {
    return { allowed: false, reason: `Estado ${currentState} no está definido para ${entityType}` };
  }

  if (machine.isFinal?.includes(currentState)) {
    return { allowed: false, reason: `Estado ${currentState} es final, no permite más transiciones` };
  }

  if (!allowedActions.includes(action)) {
    return {
      allowed: false,
      reason: `Acción ${action} no permitida desde estado ${currentState}. Permitidas: ${allowedActions.join(', ')}`,
    };
  }

  return { allowed: true };
}

/**
 * Obtiene el estado destino para una transición
 */
function getTargetState(entityType: EntityType, action: TransitionAction): string {
  const entityOverride = ENTITY_ACTION_TO_STATE[entityType]?.[action];
  return entityOverride || ACTION_TO_STATE[action] || action;
}

/**
 * Verifica SoD desde la base de datos
 */
async function checkSoD(
  ctx: TransitionContext,
  prismaClient: PrismaClient | Prisma.TransactionClient
): Promise<SoDCheckResult> {
  // Buscar reglas SoD aplicables
  const sodRules = await (prismaClient as PrismaClient).$queryRaw<
    Array<{ ruleCode: string; action1: string; action2: string; scope: string }>
  >`
    SELECT "ruleCode", "action1", "action2", "scope"
    FROM "SoDMatrix"
    WHERE "companyId" = ${ctx.companyId}
    AND "isEnabled" = true
    AND "action2" = ${ctx.action}
  `;

  if (sodRules.length === 0) {
    return { allowed: true };
  }

  // Mapear acción a acciones de audit log
  const actionMap: Record<string, string[]> = {
    CREAR_PEDIDO: ['CREAR', 'CREATE'],
    APROBAR_PEDIDO: ['APROBAR', 'APPROVE', 'APROBAR_PEDIDO'],
    APROBAR_OC: ['APROBAR', 'APPROVE', 'APROBAR_OC'],
    CONFIRMAR_RECEPCION: ['CONFIRMAR', 'CONFIRM', 'CONFIRMAR_RECEPCION'],
    CREAR_OP: ['CREAR', 'CREATE', 'CREAR_OP'],
    APROBAR_OP: ['APROBAR', 'APPROVE', 'APROBAR_OP'],
    REGISTRAR_FACTURA: ['CREAR', 'CREATE', 'REGISTRAR_FACTURA'],
    APROBAR_CAMBIO_CBU: ['APROBAR', 'APPROVE'],
  };

  for (const rule of sodRules) {
    const action1Variants = actionMap[rule.action1] || [rule.action1];

    // Buscar si el usuario realizó la acción1
    let conflictQuery;
    if (rule.scope === 'SAME_DOCUMENT') {
      conflictQuery = await (prismaClient as PrismaClient).$queryRaw<Array<{ userId: number }>>`
        SELECT "userId"
        FROM "PurchaseAuditLog"
        WHERE "companyId" = ${ctx.companyId}
        AND "entidad" = ${ctx.entityType}
        AND "entidadId" = ${ctx.entityId}
        AND "accion" = ANY(${action1Variants})
        AND "userId" = ${ctx.userId}
        LIMIT 1
      `;
    } else {
      // SAME_SUPPLIER scope: buscar en documentos relacionados
      conflictQuery = await (prismaClient as PrismaClient).$queryRaw<Array<{ userId: number }>>`
        SELECT "userId"
        FROM "PurchaseAuditLog"
        WHERE "companyId" = ${ctx.companyId}
        AND "accion" = ANY(${action1Variants})
        AND "userId" = ${ctx.userId}
        AND "createdAt" > NOW() - INTERVAL '30 days'
        LIMIT 1
      `;
    }

    if (conflictQuery.length > 0) {
      return {
        allowed: false,
        ruleCode: rule.ruleCode,
        message: `Violación SoD: Usuario ya realizó ${rule.action1}, no puede realizar ${rule.action2}`,
        conflictingAction: rule.action1,
        conflictingUserId: conflictQuery[0].userId,
      };
    }
  }

  return { allowed: true };
}

/**
 * Verifica idempotencia
 */
async function checkIdempotency(
  ctx: TransitionContext,
  prismaClient: PrismaClient | Prisma.TransactionClient
): Promise<{ exists: boolean; previousResult?: TransitionResult }> {
  if (!ctx.idempotencyKey) {
    return { exists: false };
  }

  const existing = await (prismaClient as PrismaClient).$queryRaw<
    Array<{ status: string; response: string }>
  >`
    SELECT "status", "response"::text
    FROM "IdempotencyKey"
    WHERE "companyId" = ${ctx.companyId}
    AND "key" = ${ctx.idempotencyKey}
    AND "expiresAt" > NOW()
    LIMIT 1
  `;

  if (existing.length > 0) {
    if (existing[0].status === 'COMPLETED' && existing[0].response) {
      return {
        exists: true,
        previousResult: (() => { try { return JSON.parse(existing[0].response) as TransitionResult; } catch { return null as any; } })(),
      };
    }
    // Si está en PROCESSING, es un retry concurrente
    if (existing[0].status === 'PROCESSING') {
      return {
        exists: true,
        previousResult: {
          success: false,
          fromState: null,
          toState: '',
          error: 'Operación en proceso, por favor espere',
          errorCode: 'CONCURRENT_OPERATION',
        },
      };
    }
  }

  return { exists: false };
}

/**
 * Registra la transición en el log inmutable
 */
async function logTransition(
  ctx: TransitionContext,
  fromState: string | null,
  toState: string,
  sodResult: SoDCheckResult,
  eligibilityResult: EligibilityCheckResult | null,
  prismaClient: PrismaClient | Prisma.TransactionClient
): Promise<number> {
  // Calcular hash de integridad
  const hashInput = `${ctx.entityType}:${ctx.entityId}:${fromState}:${toState}:${ctx.action}:${Date.now()}`;
  const integrityHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  const result = await (prismaClient as PrismaClient).$queryRaw<Array<{ id: number }>>`
    INSERT INTO "StateTransitionLog" (
      "companyId", "entityType", "entityId", "fromState", "toState",
      "action", "userId", "reasonCode", "reasonText", "metadata",
      "sodCheckResult", "eligibilityCheckResult", "integrityHash"
    ) VALUES (
      ${ctx.companyId}, ${ctx.entityType}, ${ctx.entityId}, ${fromState}, ${toState},
      ${ctx.action}, ${ctx.userId}, ${ctx.reasonCode || null}, ${ctx.reasonText || null},
      ${JSON.stringify(ctx.metadata || {})}::jsonb,
      ${JSON.stringify(sodResult)}::jsonb,
      ${eligibilityResult ? JSON.stringify(eligibilityResult) : null}::jsonb,
      ${integrityHash}
    )
    RETURNING id
  `;

  return result[0].id;
}

// =====================================================
// GATEWAY PRINCIPAL
// =====================================================

type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Ejecuta una transición de estado con todas las verificaciones
 */
export async function executeTransition(
  ctx: TransitionContext,
  prismaClient: PrismaClient,
  getCurrentState: (prisma: PrismaTransaction) => Promise<string | null>,
  applyTransition: (prisma: PrismaTransaction, toState: string) => Promise<void>,
  checkEligibility?: (prisma: PrismaTransaction) => Promise<EligibilityCheckResult>
): Promise<TransitionResult> {
  // 1. Verificar idempotencia
  const idempotencyCheck = await checkIdempotency(ctx, prismaClient);
  if (idempotencyCheck.exists && idempotencyCheck.previousResult) {
    return idempotencyCheck.previousResult;
  }

  // 2. Registrar idempotency key como PROCESSING
  if (ctx.idempotencyKey) {
    await prismaClient.$executeRaw`
      INSERT INTO "IdempotencyKey" ("key", "companyId", "operation", "entityType", "entityId", "status")
      VALUES (${ctx.idempotencyKey}, ${ctx.companyId}, ${ctx.action}, ${ctx.entityType}, ${ctx.entityId}, 'PROCESSING')
      ON CONFLICT ("companyId", "key") DO UPDATE SET "status" = 'PROCESSING'
    `;
  }

  try {
    // Ejecutar en transacción
    const result = await prismaClient.$transaction(async (tx) => {
      // 3. Obtener estado actual
      const currentState = await getCurrentState(tx as unknown as PrismaTransaction);

      // 4. Verificar si la transición es válida
      const transitionCheck = isTransitionAllowed(ctx.entityType, currentState, ctx.action);
      if (!transitionCheck.allowed) {
        return {
          success: false,
          fromState: currentState,
          toState: '',
          error: transitionCheck.reason,
          errorCode: 'INVALID_TRANSITION',
        };
      }

      // 4.5 Validar reason code si la acción lo requiere
      if (ACTIONS_REQUIRING_REASON.includes(ctx.action)) {
        const reasonEntityType = ENTITY_TO_REASON_ENTITY[ctx.entityType];
        const reasonActionType = ACTION_TO_REASON_ACTION[ctx.action];

        const reasonValidation = validateReasonParams(
          reasonEntityType,
          reasonActionType,
          ctx.reasonCode,
          ctx.reasonText
        );

        if (!reasonValidation.valid) {
          return {
            success: false,
            fromState: currentState,
            toState: '',
            error: reasonValidation.error,
            errorCode: 'REASON_CODE_REQUIRED',
          };
        }
      }

      // 5. Obtener estado destino
      const toState = getTargetState(ctx.entityType, ctx.action);

      // 6. Verificar SoD si es requerido
      const machine = STATE_MACHINES[ctx.entityType];
      let sodResult: SoDCheckResult = { allowed: true };

      if (machine.requiresSoD?.includes(ctx.action) && !ctx.skipSoD) {
        sodResult = await checkSoD(ctx, tx);
        if (!sodResult.allowed) {
          return {
            success: false,
            fromState: currentState,
            toState: '',
            error: sodResult.message,
            errorCode: 'SOD_VIOLATION',
            sodCheckResult: sodResult,
          };
        }
      }

      // 7. Verificar elegibilidad si es requerido
      let eligibilityResult: EligibilityCheckResult | null = null;

      if (machine.requiresEligibility?.includes(ctx.action) && checkEligibility) {
        eligibilityResult = await checkEligibility(tx as unknown as PrismaTransaction);
        if (!eligibilityResult.eligible) {
          return {
            success: false,
            fromState: currentState,
            toState: '',
            error: eligibilityResult.reason,
            errorCode: eligibilityResult.code || 'NOT_ELIGIBLE',
            eligibilityResult,
          };
        }
      }

      // 8. Aplicar la transición
      await applyTransition(tx as unknown as PrismaTransaction, toState);

      // 9. Registrar en log inmutable
      const transitionId = await logTransition(
        ctx,
        currentState,
        toState,
        sodResult,
        eligibilityResult,
        tx
      );

      return {
        success: true,
        fromState: currentState,
        toState,
        transitionId,
        sodCheckResult: sodResult,
        eligibilityResult: eligibilityResult || undefined,
      };
    });

    // 10. Actualizar idempotency key como COMPLETED
    if (ctx.idempotencyKey) {
      await prismaClient.$executeRaw`
        UPDATE "IdempotencyKey"
        SET "status" = 'COMPLETED', "response" = ${JSON.stringify(result)}::jsonb, "entityId" = ${ctx.entityId}
        WHERE "companyId" = ${ctx.companyId} AND "key" = ${ctx.idempotencyKey}
      `;
    }

    return result;
  } catch (error) {
    // Marcar idempotency key como FAILED
    if (ctx.idempotencyKey) {
      await prismaClient.$executeRaw`
        UPDATE "IdempotencyKey"
        SET "status" = 'FAILED'
        WHERE "companyId" = ${ctx.companyId} AND "key" = ${ctx.idempotencyKey}
      `;
    }

    throw error;
  }
}

/**
 * Verifica si una transición es posible (sin ejecutarla)
 */
export async function canTransition(
  ctx: TransitionContext,
  prismaClient: PrismaClient,
  getCurrentState: () => Promise<string | null>,
  checkEligibility?: () => Promise<EligibilityCheckResult>
): Promise<{
  allowed: boolean;
  reason?: string;
  sodCheck?: SoDCheckResult;
  eligibilityCheck?: EligibilityCheckResult;
}> {
  const currentState = await getCurrentState();

  // Verificar máquina de estados
  const transitionCheck = isTransitionAllowed(ctx.entityType, currentState, ctx.action);
  if (!transitionCheck.allowed) {
    return { allowed: false, reason: transitionCheck.reason };
  }

  // Verificar SoD
  const machine = STATE_MACHINES[ctx.entityType];
  if (machine.requiresSoD?.includes(ctx.action)) {
    const sodResult = await checkSoD(ctx, prismaClient);
    if (!sodResult.allowed) {
      return { allowed: false, reason: sodResult.message, sodCheck: sodResult };
    }
  }

  // Verificar elegibilidad
  if (machine.requiresEligibility?.includes(ctx.action) && checkEligibility) {
    const eligibilityResult = await checkEligibility();
    if (!eligibilityResult.eligible) {
      return { allowed: false, reason: eligibilityResult.reason, eligibilityCheck: eligibilityResult };
    }
  }

  return { allowed: true };
}

/**
 * Obtiene las acciones disponibles para un estado
 */
export function getAvailableActions(entityType: EntityType, currentState: string): TransitionAction[] {
  const machine = STATE_MACHINES[entityType];
  if (!machine) return [];

  return machine.allowedTransitions[currentState] || [];
}

/**
 * Verifica si un estado es final
 */
export function isFinalState(entityType: EntityType, state: string): boolean {
  const machine = STATE_MACHINES[entityType];
  return machine?.isFinal?.includes(state) || false;
}
