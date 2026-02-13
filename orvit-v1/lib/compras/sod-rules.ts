/**
 * SoD Rules - Segregation of Duties
 *
 * Reglas de segregación de funciones para prevenir fraude y errores.
 * Implementa el principio de "cuatro ojos" en operaciones críticas.
 *
 * Las reglas se almacenan en la tabla SoDMatrix y son configurables por empresa.
 */

import { PrismaClient } from '@prisma/client';

export interface SoDRule {
  id: string;
  name: string;
  description: string;
  action1: string;  // Acción que el usuario hizo
  action2: string;  // Acción que no puede hacer
  scope: 'SAME_DOCUMENT' | 'SAME_SUPPLIER' | 'GLOBAL';
  enabled: boolean;
  severity: 'BLOCKING' | 'WARNING';
}

export interface SoDCheckResult {
  allowed: boolean;
  violation?: SoDRule;
  message?: string;
}

// Cache de reglas por empresa (TTL 5 minutos)
const rulesCache = new Map<number, { rules: SoDRule[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Obtiene reglas SoD desde la base de datos para una empresa
 */
async function getSoDRulesFromDB(
  companyId: number,
  prismaClient: PrismaClient | any
): Promise<SoDRule[]> {
  // Verificar cache
  const cached = rulesCache.get(companyId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.rules;
  }

  // Consultar desde SoDMatrix
  const dbRules = await prismaClient.$queryRaw<Array<{
    id: number;
    ruleCode: string;
    action1: string;
    action2: string;
    scope: string;
    severity: string;
    isEnabled: boolean;
    description: string | null;
  }>>`
    SELECT id, "ruleCode", action1, action2, scope, severity, "isEnabled", description
    FROM "SoDMatrix"
    WHERE "companyId" = ${companyId}
    AND "isEnabled" = true
  `;

  const rules: SoDRule[] = dbRules.map(r => ({
    id: r.ruleCode,
    name: r.ruleCode.replace(/_/g, ' '),
    description: r.description || `${r.action1} → ${r.action2}`,
    action1: r.action1,
    action2: r.action2,
    scope: r.scope as SoDRule['scope'],
    enabled: r.isEnabled,
    severity: r.severity as SoDRule['severity'],
  }));

  // Actualizar cache
  rulesCache.set(companyId, { rules, timestamp: Date.now() });

  return rules;
}

/**
 * Invalida el cache de reglas para una empresa
 */
export function invalidateSoDCache(companyId?: number): void {
  if (companyId) {
    rulesCache.delete(companyId);
  } else {
    rulesCache.clear();
  }
}

/**
 * Reglas de Segregación de Funciones
 */
export const SOD_RULES: SoDRule[] = [
  // === PEDIDOS DE COMPRA ===
  {
    id: 'SOD_001',
    name: 'Creador pedido no puede aprobar',
    description: 'Quien crea el pedido no puede aprobarlo',
    action1: 'CREAR_PEDIDO',
    action2: 'APROBAR_PEDIDO',
    scope: 'SAME_DOCUMENT',
    enabled: true,
    severity: 'BLOCKING',
  },
  {
    id: 'SOD_002',
    name: 'Aprobador pedido no puede crear OC',
    description: 'Quien aprueba el pedido no puede crear la OC',
    action1: 'APROBAR_PEDIDO',
    action2: 'CREAR_OC',
    scope: 'SAME_DOCUMENT',
    enabled: true,
    severity: 'BLOCKING',
  },

  // === ÓRDENES DE COMPRA ===
  {
    id: 'SOD_003',
    name: 'Creador OC no puede recibir',
    description: 'Quien crea la OC no puede confirmar la recepción',
    action1: 'CREAR_OC',
    action2: 'CONFIRMAR_RECEPCION',
    scope: 'SAME_DOCUMENT',
    enabled: true,
    severity: 'BLOCKING',
  },
  {
    id: 'SOD_004',
    name: 'Aprobador OC no puede crear OP',
    description: 'Quien aprueba la OC no puede crear la orden de pago',
    action1: 'APROBAR_OC',
    action2: 'CREAR_OP',
    scope: 'SAME_DOCUMENT',
    enabled: true,
    severity: 'BLOCKING',
  },

  // === RECEPCIONES ===
  {
    id: 'SOD_005',
    name: 'Receptor no puede aprobar pago',
    description: 'Quien recibe mercadería no puede aprobar el pago',
    action1: 'CONFIRMAR_RECEPCION',
    action2: 'APROBAR_PAGO',
    scope: 'SAME_DOCUMENT',
    enabled: true,
    severity: 'BLOCKING',
  },

  // === PAGOS ===
  {
    id: 'SOD_006',
    name: 'Creador OP no puede aprobar',
    description: 'Quien crea la orden de pago no puede aprobarla',
    action1: 'CREAR_OP',
    action2: 'APROBAR_PAGO',
    scope: 'SAME_DOCUMENT',
    enabled: true,
    severity: 'BLOCKING',
  },

  // === PROVEEDORES ===
  {
    id: 'SOD_007',
    name: 'Creador proveedor no puede aprobar cambio bancario',
    description: 'Quien crea el proveedor no puede aprobar cambios bancarios',
    action1: 'CREAR_PROVEEDOR',
    action2: 'APROBAR_CAMBIO_BANCARIO',
    scope: 'SAME_SUPPLIER',
    enabled: true,
    severity: 'BLOCKING',
  },

  // === FACTURAS ===
  {
    id: 'SOD_008',
    name: 'Registrador factura no puede aprobar pago',
    description: 'Quien registra la factura no puede aprobar el pago',
    action1: 'REGISTRAR_FACTURA',
    action2: 'APROBAR_PAGO',
    scope: 'SAME_DOCUMENT',
    enabled: true,
    severity: 'BLOCKING',
  },
];

/**
 * Mapeo de tipos de documento a entidades de audit log
 */
const DOCUMENT_TYPE_TO_ENTITY: Record<string, string> = {
  'PEDIDO': 'purchase_request',
  'OC': 'purchase_order',
  'FACTURA': 'purchase_receipt',
  'OP': 'payment_order',
  'RECEPCION': 'goods_receipt',
  'PROVEEDOR': 'supplier',
};

/**
 * Mapeo de acciones a acciones de audit log
 */
const ACTION_MAP: Record<string, string[]> = {
  'CREAR_PEDIDO': ['CREAR', 'CREATE'],
  'APROBAR_PEDIDO': ['APROBAR', 'APPROVE', 'APROBAR_PEDIDO'],
  'CREAR_OC': ['CREAR', 'CREATE', 'CREAR_OC'],
  'APROBAR_OC': ['APROBAR', 'APPROVE', 'APROBAR_OC'],
  'CONFIRMAR_RECEPCION': ['CONFIRMAR', 'CONFIRM', 'CONFIRMAR_RECEPCION'],
  'CREAR_OP': ['CREAR', 'CREATE', 'CREAR_OP'],
  'APROBAR_PAGO': ['APROBAR', 'APPROVE', 'APROBAR_PAGO'],
  'REGISTRAR_FACTURA': ['CREAR', 'CREATE', 'REGISTRAR'],
  'CREAR_PROVEEDOR': ['CREAR', 'CREATE'],
  'APROBAR_CAMBIO_BANCARIO': ['APROBAR_CAMBIO_BANCARIO', 'APPROVE_BANK_CHANGE'],
};

/**
 * Verifica reglas de SoD para una acción
 * Lee las reglas desde la base de datos (SoDMatrix)
 */
export async function verificarSoD(
  userId: number,
  accionIntentada: string,
  documentId: number,
  documentType: 'PEDIDO' | 'OC' | 'FACTURA' | 'OP' | 'RECEPCION' | 'PROVEEDOR',
  prismaClient: PrismaClient | any,
  companyId?: number
): Promise<SoDCheckResult> {
  const entidad = DOCUMENT_TYPE_TO_ENTITY[documentType];
  if (!entidad) {
    return { allowed: true };
  }

  // Buscar acciones previas del documento
  const accionesPrevias = await prismaClient.purchaseAuditLog.findMany({
    where: {
      entidadId: documentId,
      entidad: entidad,
    },
    select: { userId: true, accion: true, companyId: true }
  });

  // Obtener companyId del primer resultado si no se proporcionó
  const effectiveCompanyId = companyId || accionesPrevias[0]?.companyId;
  if (!effectiveCompanyId) {
    // Sin companyId, usar reglas hardcodeadas como fallback
    return verificarSoDConReglasDefault(userId, accionIntentada, accionesPrevias);
  }

  // Obtener reglas desde la base de datos
  const sodRules = await getSoDRulesFromDB(effectiveCompanyId, prismaClient);

  // Verificar cada regla habilitada que aplique a la acción intentada
  for (const rule of sodRules.filter(r => r.enabled && r.action2 === accionIntentada)) {
    // Buscar si el usuario realizó la acción previa que genera conflicto
    const accionesConflicto = ACTION_MAP[rule.action1] || [rule.action1];

    const accionPrevia = accionesPrevias.find(a =>
      accionesConflicto.includes(a.accion) && a.userId === userId
    );

    if (accionPrevia) {
      return {
        allowed: rule.severity === 'WARNING', // WARNING permite pero avisa
        violation: rule,
        message: `Violación SoD (${rule.id}): ${rule.description}`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Verificación SoD con reglas default (fallback si no hay en DB)
 */
function verificarSoDConReglasDefault(
  userId: number,
  accionIntentada: string,
  accionesPrevias: Array<{ userId: number; accion: string }>
): SoDCheckResult {
  for (const rule of SOD_RULES.filter(r => r.enabled && r.action2 === accionIntentada)) {
    const accionesConflicto = ACTION_MAP[rule.action1] || [rule.action1];

    const accionPrevia = accionesPrevias.find(a =>
      accionesConflicto.includes(a.accion) && a.userId === userId
    );

    if (accionPrevia) {
      return {
        allowed: false,
        violation: rule,
        message: `Violación SoD (${rule.id}): ${rule.description}`,
      };
    }
  }
  return { allowed: true };
}

/**
 * Verifica SoD entre documentos relacionados (ej: OC y su recepción)
 * Lee las reglas desde la base de datos (SoDMatrix)
 */
export async function verificarSoDEntreDocumentos(
  userId: number,
  accionIntentada: string,
  documentoOrigenId: number,
  documentoOrigenTipo: string,
  prismaClient: PrismaClient | any,
  companyId?: number
): Promise<SoDCheckResult> {
  // Buscar acciones previas en el documento origen
  const entidadOrigen = DOCUMENT_TYPE_TO_ENTITY[documentoOrigenTipo];
  if (!entidadOrigen) {
    return { allowed: true };
  }

  const accionesOrigen = await prismaClient.purchaseAuditLog.findMany({
    where: {
      entidadId: documentoOrigenId,
      entidad: entidadOrigen,
      userId: userId,
    },
    select: { accion: true, companyId: true }
  });

  // Obtener companyId del primer resultado si no se proporcionó
  const effectiveCompanyId = companyId || accionesOrigen[0]?.companyId;

  // Obtener reglas desde la base de datos
  let sodRules = SOD_RULES; // Fallback
  if (effectiveCompanyId) {
    sodRules = await getSoDRulesFromDB(effectiveCompanyId, prismaClient);
  }

  // Verificar reglas de conflicto
  for (const rule of sodRules.filter(r => r.enabled && r.action2 === accionIntentada)) {
    const accionesConflicto = ACTION_MAP[rule.action1] || [rule.action1];

    const tieneConflicto = accionesOrigen.some(a =>
      accionesConflicto.includes(a.accion)
    );

    if (tieneConflicto) {
      return {
        allowed: rule.severity === 'WARNING', // WARNING permite pero avisa
        violation: rule,
        message: `Violación SoD (${rule.id}): ${rule.description}`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Obtiene todas las violaciones potenciales de SoD para un usuario y documento
 * Lee las reglas desde la base de datos (SoDMatrix)
 */
export async function obtenerViolacionesPotenciales(
  userId: number,
  documentId: number,
  documentType: string,
  prismaClient: PrismaClient | any,
  companyId?: number
): Promise<SoDRule[]> {
  const entidad = DOCUMENT_TYPE_TO_ENTITY[documentType];
  if (!entidad) {
    return [];
  }

  const accionesPrevias = await prismaClient.purchaseAuditLog.findMany({
    where: {
      entidadId: documentId,
      entidad: entidad,
      userId: userId,
    },
    select: { accion: true, companyId: true }
  });

  // Obtener companyId del primer resultado si no se proporcionó
  const effectiveCompanyId = companyId || accionesPrevias[0]?.companyId;

  // Obtener reglas desde la base de datos
  let sodRules = SOD_RULES; // Fallback
  if (effectiveCompanyId) {
    sodRules = await getSoDRulesFromDB(effectiveCompanyId, prismaClient);
  }

  const violaciones: SoDRule[] = [];

  for (const rule of sodRules.filter(r => r.enabled)) {
    const accionesConflicto = ACTION_MAP[rule.action1] || [rule.action1];

    const tieneConflicto = accionesPrevias.some(a =>
      accionesConflicto.includes(a.accion)
    );

    if (tieneConflicto) {
      violaciones.push(rule);
    }
  }

  return violaciones;
}

/**
 * Registra una acción en el audit log para tracking de SoD
 */
export async function registrarAccionParaSoD(
  userId: number,
  accion: string,
  documentId: number,
  documentType: string,
  companyId: number,
  prismaClient: PrismaClient | any,
  datosAdicionales?: any
): Promise<void> {
  const entidad = DOCUMENT_TYPE_TO_ENTITY[documentType];
  if (!entidad) {
    return;
  }

  await prismaClient.purchaseAuditLog.create({
    data: {
      entidad,
      entidadId: documentId,
      accion,
      userId,
      companyId,
      datosNuevos: datosAdicionales || {},
    }
  });
}

/**
 * Verifica si un usuario puede realizar una acción basándose en reglas SoD
 * Versión simplificada para uso rápido
 */
export function verificarSoDSimple(
  solicitanteId: number,
  aprobadorId: number
): SoDCheckResult {
  if (solicitanteId === aprobadorId) {
    return {
      allowed: false,
      message: 'El mismo usuario no puede crear y aprobar un documento',
    };
  }
  return { allowed: true };
}

// ============================================================
// ADMINISTRACIÓN DE REGLAS SOD
// ============================================================

/**
 * Obtiene todas las reglas SoD de una empresa (para admin UI)
 */
export async function getAllSoDRules(
  companyId: number,
  prismaClient: PrismaClient | any
): Promise<Array<{
  id: number;
  ruleCode: string;
  action1: string;
  action2: string;
  scope: string;
  severity: string;
  isEnabled: boolean;
  description: string | null;
  createdAt: Date;
}>> {
  const rules = await prismaClient.$queryRaw<Array<{
    id: number;
    ruleCode: string;
    action1: string;
    action2: string;
    scope: string;
    severity: string;
    isEnabled: boolean;
    description: string | null;
    createdAt: Date;
  }>>`
    SELECT id, "ruleCode", action1, action2, scope, severity, "isEnabled", description, "createdAt"
    FROM "SoDMatrix"
    WHERE "companyId" = ${companyId}
    ORDER BY "ruleCode"
  `;

  return rules;
}

/**
 * Actualiza una regla SoD
 */
export async function updateSoDRule(
  companyId: number,
  ruleCode: string,
  updates: {
    isEnabled?: boolean;
    severity?: 'BLOCKING' | 'WARNING';
    description?: string;
  },
  prismaClient: PrismaClient | any
): Promise<{ success: boolean; error?: string }> {
  try {
    const setClause: string[] = [];
    const values: any[] = [];

    if (updates.isEnabled !== undefined) {
      setClause.push(`"isEnabled" = $${values.length + 1}`);
      values.push(updates.isEnabled);
    }
    if (updates.severity !== undefined) {
      setClause.push(`"severity" = $${values.length + 1}`);
      values.push(updates.severity);
    }
    if (updates.description !== undefined) {
      setClause.push(`"description" = $${values.length + 1}`);
      values.push(updates.description);
    }

    if (setClause.length === 0) {
      return { success: false, error: 'No hay campos para actualizar' };
    }

    await prismaClient.$executeRawUnsafe(
      `UPDATE "SoDMatrix" SET ${setClause.join(', ')} WHERE "companyId" = $${values.length + 1} AND "ruleCode" = $${values.length + 2}`,
      ...values,
      companyId,
      ruleCode
    );

    // Invalidar cache
    invalidateSoDCache(companyId);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Crea una nueva regla SoD personalizada
 */
export async function createSoDRule(
  companyId: number,
  rule: {
    ruleCode: string;
    action1: string;
    action2: string;
    scope: 'SAME_DOCUMENT' | 'SAME_SUPPLIER' | 'GLOBAL';
    severity: 'BLOCKING' | 'WARNING';
    description: string;
  },
  prismaClient: PrismaClient | any
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const result = await prismaClient.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "SoDMatrix" ("companyId", "ruleCode", action1, action2, scope, severity, description, "isEnabled")
      VALUES (${companyId}, ${rule.ruleCode}, ${rule.action1}, ${rule.action2}, ${rule.scope}, ${rule.severity}, ${rule.description}, true)
      RETURNING id
    `;

    // Invalidar cache
    invalidateSoDCache(companyId);

    return { success: true, id: result[0]?.id };
  } catch (err: any) {
    if (err.code === '23505') { // Unique violation
      return { success: false, error: 'Ya existe una regla con ese código' };
    }
    return { success: false, error: String(err) };
  }
}

/**
 * Elimina una regla SoD personalizada
 */
export async function deleteSoDRule(
  companyId: number,
  ruleCode: string,
  prismaClient: PrismaClient | any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar que no sea una regla base (las que empiezan con SOD_)
    if (ruleCode.startsWith('SOD_')) {
      return { success: false, error: 'No se pueden eliminar reglas base del sistema. Solo se pueden deshabilitar.' };
    }

    await prismaClient.$executeRaw`
      DELETE FROM "SoDMatrix"
      WHERE "companyId" = ${companyId} AND "ruleCode" = ${ruleCode}
    `;

    // Invalidar cache
    invalidateSoDCache(companyId);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Obtiene estadísticas de violaciones SoD
 */
export async function getSoDViolationStats(
  companyId: number,
  prismaClient: PrismaClient | any,
  daysBack: number = 30
): Promise<{
  totalViolations: number;
  byRule: Record<string, number>;
  byUser: Array<{ userId: number; userName: string; count: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const violationsByRule = await prismaClient.$queryRaw<Array<{
    ruleCode: string;
    count: bigint;
  }>>`
    SELECT
      stl."reasonCode" as "ruleCode",
      COUNT(*) as count
    FROM "StateTransitionLog" stl
    WHERE stl."companyId" = ${companyId}
    AND stl."createdAt" >= ${startDate}
    AND stl."sodCheckResult" IS NOT NULL
    AND stl."sodCheckResult"->>'allowed' = 'false'
    GROUP BY stl."reasonCode"
  `;

  const violationsByUser = await prismaClient.$queryRaw<Array<{
    userId: number;
    userName: string;
    count: bigint;
  }>>`
    SELECT
      stl."userId",
      u.name as "userName",
      COUNT(*) as count
    FROM "StateTransitionLog" stl
    JOIN "User" u ON u.id = stl."userId"
    WHERE stl."companyId" = ${companyId}
    AND stl."createdAt" >= ${startDate}
    AND stl."sodCheckResult" IS NOT NULL
    AND stl."sodCheckResult"->>'allowed' = 'false'
    GROUP BY stl."userId", u.name
    ORDER BY count DESC
    LIMIT 10
  `;

  const totalViolations = violationsByRule.reduce((sum, v) => sum + Number(v.count), 0);

  return {
    totalViolations,
    byRule: Object.fromEntries(violationsByRule.map(v => [v.ruleCode, Number(v.count)])),
    byUser: violationsByUser.map(v => ({
      userId: v.userId,
      userName: v.userName,
      count: Number(v.count),
    })),
  };
}
