/**
 * Match Exception Workflow Helper
 *
 * Gestiona el ciclo de vida de las excepciones de match:
 * - Asignación automática de owner basada en tipo
 * - Cálculo de SLA y deadline
 * - Escalamiento automático cuando SLA se incumple
 * - Resolución con audit trail
 */

import { PrismaClient } from '@prisma/client';
import { addHours, isPast } from 'date-fns';

// Tipos de excepción conocidos
export type ExceptionType =
  | 'PRECIO_DIFERENTE'
  | 'CANTIDAD_DIFERENTE'
  | 'SIN_RECEPCION'
  | 'ITEM_EXTRA'
  | 'ITEM_FALTANTE'
  | 'IMPUESTO_DIFERENTE';

// Prioridades
export type ExceptionPriority = 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';

// Acciones de resolución
export type ResolutionAction =
  | 'APROBAR_DIFERENCIA'        // Aprobar pago con la diferencia
  | 'AJUSTAR_FACTURA'           // Solicitar NC o ND
  | 'AJUSTAR_RECEPCION'         // Corregir recepción
  | 'RECHAZAR_FACTURA'          // Devolver factura al proveedor
  | 'ESCALAR'                   // Escalar a supervisor
  | 'CERRAR_SIN_ACCION';        // Cerrar sin cambios

// Códigos de razón
export const RESOLUTION_REASON_CODES = {
  APPROVED_WITHIN_POLICY: 'Aprobado dentro de política de tolerancias',
  APPROVED_BY_EXCEPTION: 'Aprobado por excepción autorizada',
  NC_REQUESTED: 'Nota de crédito solicitada',
  ND_REQUESTED: 'Nota de débito solicitada',
  RECEPTION_CORRECTED: 'Recepción corregida',
  INVOICE_RETURNED: 'Factura devuelta al proveedor',
  DUPLICATE_RESOLVED: 'Duplicado resuelto',
  DATA_ERROR_FIXED: 'Error de datos corregido',
  ESCALATED_TO_SUPERVISOR: 'Escalado a supervisor',
} as const;

export interface SLAConfig {
  exceptionType: string;
  slaHours: number;
  ownerRole: string | null;
  escalateAfterHours: number | null;
  escalateToRole: string | null;
}

export interface ExceptionResolution {
  action: ResolutionAction;
  reasonCode: string;
  reasonText?: string;
  adjustedAmount?: number;
  ncndId?: number;
}

/**
 * Obtiene la configuración de SLA para un tipo de excepción
 */
export async function getSLAConfig(
  companyId: number,
  exceptionType: string,
  prismaClient: PrismaClient
): Promise<SLAConfig> {
  const config = await prismaClient.$queryRaw<SLAConfig[]>`
    SELECT "exceptionType", "slaHours", "ownerRole", "escalateAfterHours", "escalateToRole"
    FROM "MatchExceptionSLAConfig"
    WHERE "companyId" = ${companyId}
    AND "exceptionType" = ${exceptionType}
    AND "isActive" = true
    LIMIT 1
  `;

  if (config.length > 0) {
    return config[0];
  }

  // Configuración por defecto
  return {
    exceptionType,
    slaHours: 24,
    ownerRole: 'COMPRAS_ANALISTA',
    escalateAfterHours: 48,
    escalateToRole: 'COMPRAS_SUPERVISOR',
  };
}

/**
 * Calcula la prioridad basada en el monto afectado
 */
export function calcularPrioridad(
  montoAfectado: number,
  exceptionType: ExceptionType
): ExceptionPriority {
  // SIN_RECEPCION siempre es alta prioridad (bloquea todo)
  if (exceptionType === 'SIN_RECEPCION') {
    return 'ALTA';
  }

  // Por monto
  if (montoAfectado >= 100000) return 'URGENTE';
  if (montoAfectado >= 50000) return 'ALTA';
  if (montoAfectado >= 10000) return 'NORMAL';
  return 'BAJA';
}

/**
 * Asigna owner y SLA a una excepción nueva
 */
export async function asignarOwnerYSLA(
  exceptionId: number,
  companyId: number,
  exceptionType: string,
  montoAfectado: number,
  prismaClient: PrismaClient
): Promise<{ ownerId: number | null; ownerRole: string; slaDeadline: Date; prioridad: ExceptionPriority }> {
  const slaConfig = await getSLAConfig(companyId, exceptionType, prismaClient);
  const prioridad = calcularPrioridad(montoAfectado, exceptionType as ExceptionType);

  // Ajustar SLA según prioridad
  let slaHours = slaConfig.slaHours;
  if (prioridad === 'URGENTE') slaHours = Math.max(4, slaHours / 4);
  else if (prioridad === 'ALTA') slaHours = Math.max(8, slaHours / 2);

  const slaDeadline = addHours(new Date(), slaHours);

  // Buscar usuario con el rol especificado
  let ownerId: number | null = null;
  if (slaConfig.ownerRole) {
    const ownerUsers = await prismaClient.$queryRaw<Array<{ id: number }>>`
      SELECT u.id
      FROM "User" u
      JOIN "user_companies" uc ON uc."userId" = u.id
      JOIN "user_company_roles" ucr ON ucr."userCompanyId" = uc.id
      JOIN "Role" r ON r.id = ucr."roleId"
      WHERE uc."companyId" = ${companyId}
      AND r.name = ${slaConfig.ownerRole}
      AND u."isActive" = true
      ORDER BY RANDOM()
      LIMIT 1
    `;
    if (ownerUsers.length > 0) {
      ownerId = ownerUsers[0].id;
    }
  }

  // Actualizar la excepción
  await prismaClient.$executeRaw`
    UPDATE "match_exceptions"
    SET "ownerId" = ${ownerId},
        "ownerRole" = ${slaConfig.ownerRole},
        "slaDeadline" = ${slaDeadline},
        "prioridad" = ${prioridad},
        "montoAfectado" = ${montoAfectado}
    WHERE "id" = ${exceptionId}
  `;

  return {
    ownerId,
    ownerRole: slaConfig.ownerRole || 'SIN_ASIGNAR',
    slaDeadline,
    prioridad,
  };
}

/**
 * Verifica y procesa SLA breach + escalamiento
 */
export async function procesarSLABreaches(
  companyId: number,
  prismaClient: PrismaClient
): Promise<{ processed: number; escalated: number }> {
  const ahora = new Date();
  let processed = 0;
  let escalated = 0;

  // Obtener excepciones con SLA vencido que no han sido marcadas
  const exceptionesVencidas = await prismaClient.$queryRaw<Array<{
    id: number;
    tipo: string;
    ownerId: number | null;
    slaDeadline: Date;
    createdAt: Date;
  }>>`
    SELECT me.id, me.tipo, me."ownerId", me."slaDeadline", me."createdAt"
    FROM "match_exceptions" me
    JOIN "MatchResult" mr ON mr.id = me."matchResultId"
    WHERE mr."companyId" = ${companyId}
    AND me."resuelto" = false
    AND me."slaBreached" = false
    AND me."slaDeadline" < ${ahora}
  `;

  for (const exc of exceptionesVencidas) {
    // Marcar SLA breach
    await prismaClient.$executeRaw`
      UPDATE "match_exceptions"
      SET "slaBreached" = true
      WHERE "id" = ${exc.id}
    `;
    processed++;

    // Verificar si debe escalar
    const slaConfig = await getSLAConfig(companyId, exc.tipo, prismaClient);
    if (slaConfig.escalateAfterHours && slaConfig.escalateToRole) {
      const horasDesdeCreacion = Math.floor(
        (ahora.getTime() - new Date(exc.createdAt).getTime()) / (1000 * 60 * 60)
      );

      if (horasDesdeCreacion >= slaConfig.escalateAfterHours) {
        // Buscar usuario para escalar
        const escalateUsers = await prismaClient.$queryRaw<Array<{ id: number }>>`
          SELECT u.id
          FROM "User" u
          JOIN "user_companies" uc ON uc."userId" = u.id
          JOIN "user_company_roles" ucr ON ucr."userCompanyId" = uc.id
          JOIN "Role" r ON r.id = ucr."roleId"
          WHERE uc."companyId" = ${companyId}
          AND r.name = ${slaConfig.escalateToRole}
          AND u."isActive" = true
          ORDER BY RANDOM()
          LIMIT 1
        `;

        if (escalateUsers.length > 0) {
          const nuevoOwnerId = escalateUsers[0].id;

          // Registrar historial de escalamiento
          await prismaClient.$executeRaw`
            INSERT INTO "MatchExceptionHistory" (
              "exceptionId", "action", "fromOwnerId", "toOwnerId",
              "fromStatus", "toStatus", "reasonCode", "reasonText", "userId"
            ) VALUES (
              ${exc.id}, 'ESCALATE', ${exc.ownerId}, ${nuevoOwnerId},
              'PENDING', 'ESCALATED', 'SLA_BREACH',
              ${'Escalado automático por incumplimiento de SLA'},
              ${nuevoOwnerId}
            )
          `;

          // Actualizar owner
          await prismaClient.$executeRaw`
            UPDATE "match_exceptions"
            SET "ownerId" = ${nuevoOwnerId},
                "ownerRole" = ${slaConfig.escalateToRole},
                "escalatedAt" = ${ahora},
                "escalatedTo" = ${nuevoOwnerId},
                "prioridad" = 'URGENTE'
            WHERE "id" = ${exc.id}
          `;

          escalated++;

          // TODO: Crear notificación en NotificationOutbox
        }
      }
    }
  }

  return { processed, escalated };
}

/**
 * Resuelve una excepción
 */
export async function resolverExcepcion(
  exceptionId: number,
  userId: number,
  resolution: ExceptionResolution,
  prismaClient: PrismaClient
): Promise<{ success: boolean; message: string }> {
  // Obtener excepción actual
  const exception = await prismaClient.$queryRaw<Array<{
    id: number;
    matchResultId: number;
    tipo: string;
    resuelto: boolean;
    ownerId: number | null;
  }>>`
    SELECT id, "matchResultId", tipo, resuelto, "ownerId"
    FROM "match_exceptions"
    WHERE id = ${exceptionId}
    LIMIT 1
  `;

  if (exception.length === 0) {
    return { success: false, message: 'Excepción no encontrada' };
  }

  const exc = exception[0];

  if (exc.resuelto) {
    return { success: false, message: 'Excepción ya fue resuelta' };
  }

  // Registrar historial
  await prismaClient.$executeRaw`
    INSERT INTO "MatchExceptionHistory" (
      "exceptionId", "action", "fromOwnerId", "toOwnerId",
      "fromStatus", "toStatus", "reasonCode", "reasonText", "userId"
    ) VALUES (
      ${exceptionId}, ${resolution.action}, ${exc.ownerId}, ${userId},
      'PENDING', 'RESOLVED', ${resolution.reasonCode},
      ${resolution.reasonText || null}, ${userId}
    )
  `;

  // Marcar como resuelta
  await prismaClient.$executeRaw`
    UPDATE "match_exceptions"
    SET "resuelto" = true,
        "resueltoPor" = ${userId},
        "resueltoAt" = NOW(),
        "accion" = ${resolution.action},
        "reasonCode" = ${resolution.reasonCode},
        "reasonText" = ${resolution.reasonText || null}
    WHERE "id" = ${exceptionId}
  `;

  // Verificar si todas las excepciones del match están resueltas
  const pendientes = await prismaClient.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM "match_exceptions"
    WHERE "matchResultId" = ${exc.matchResultId}
    AND "resuelto" = false
  `;

  if (Number(pendientes[0].count) === 0) {
    // Todas resueltas, actualizar MatchResult
    await prismaClient.$executeRaw`
      UPDATE "MatchResult"
      SET "estado" = 'RESUELTO',
          "updatedAt" = NOW()
      WHERE "id" = ${exc.matchResultId}
    `;

    // Actualizar factura asociada
    const matchResult = await prismaClient.$queryRaw<Array<{ facturaId: number }>>`
      SELECT "facturaId" FROM "MatchResult" WHERE id = ${exc.matchResultId}
    `;

    if (matchResult.length > 0 && matchResult[0].facturaId) {
      await prismaClient.$executeRaw`
        UPDATE "PurchaseReceipt"
        SET "matchStatus" = 'MATCH_OK',
            "matchBlockReason" = NULL
        WHERE "id" = ${matchResult[0].facturaId}
      `;
    }
  }

  return { success: true, message: 'Excepción resuelta correctamente' };
}

/**
 * Obtiene excepciones pendientes para un usuario (por rol o asignación directa)
 */
export async function getExcepcionesPendientes(
  userId: number,
  companyId: number,
  prismaClient: PrismaClient,
  options?: {
    soloAsignadas?: boolean;
    tipo?: ExceptionType;
    prioridad?: ExceptionPriority;
    limit?: number;
  }
): Promise<Array<{
  id: number;
  tipo: string;
  campo: string;
  valorEsperado: string | null;
  valorRecibido: string | null;
  diferencia: number | null;
  porcentajeDiff: number | null;
  montoAfectado: number | null;
  prioridad: string;
  slaDeadline: Date | null;
  slaBreached: boolean;
  ownerRole: string | null;
  facturaId: number | null;
  facturaNumero: string | null;
  proveedorNombre: string | null;
  createdAt: Date;
}>> {
  const limit = options?.limit || 50;

  // Obtener roles del usuario
  const userRoles = await prismaClient.$queryRaw<Array<{ name: string }>>`
    SELECT r.name
    FROM "Role" r
    JOIN "user_company_roles" ucr ON ucr."roleId" = r.id
    JOIN "user_companies" uc ON uc.id = ucr."userCompanyId"
    WHERE uc."userId" = ${userId}
    AND uc."companyId" = ${companyId}
  `;

  const roleNames = userRoles.map(r => r.name);

  let whereConditions = `
    mr."companyId" = ${companyId}
    AND me."resuelto" = false
  `;

  if (options?.soloAsignadas) {
    whereConditions += ` AND me."ownerId" = ${userId}`;
  } else if (roleNames.length > 0) {
    const rolesStr = roleNames.map(r => `'${r}'`).join(',');
    whereConditions += ` AND (me."ownerId" = ${userId} OR me."ownerRole" IN (${rolesStr}))`;
  } else {
    whereConditions += ` AND me."ownerId" = ${userId}`;
  }

  if (options?.tipo) {
    whereConditions += ` AND me.tipo = '${options.tipo}'`;
  }

  if (options?.prioridad) {
    whereConditions += ` AND me.prioridad = '${options.prioridad}'`;
  }

  const excepciones = await prismaClient.$queryRawUnsafe<Array<{
    id: number;
    tipo: string;
    campo: string;
    valorEsperado: string | null;
    valorRecibido: string | null;
    diferencia: number | null;
    porcentajeDiff: number | null;
    montoAfectado: number | null;
    prioridad: string;
    slaDeadline: Date | null;
    slaBreached: boolean;
    ownerRole: string | null;
    facturaId: number | null;
    facturaNumero: string | null;
    proveedorNombre: string | null;
    createdAt: Date;
  }>>(`
    SELECT
      me.id,
      me.tipo,
      me.campo,
      me."valorEsperado",
      me."valorRecibido",
      me.diferencia::float,
      me."porcentajeDiff"::float,
      me."montoAfectado"::float,
      me.prioridad,
      me."slaDeadline",
      me."slaBreached",
      me."ownerRole",
      pr.id as "facturaId",
      CONCAT(pr.tipo, ' ', pr."numeroSerie", '-', pr."numeroFactura") as "facturaNumero",
      s.name as "proveedorNombre",
      me."createdAt"
    FROM "match_exceptions" me
    JOIN "MatchResult" mr ON mr.id = me."matchResultId"
    LEFT JOIN "PurchaseReceipt" pr ON pr.id = mr."facturaId"
    LEFT JOIN "suppliers" s ON s.id = pr."proveedorId"
    WHERE ${whereConditions}
    ORDER BY
      CASE me.prioridad
        WHEN 'URGENTE' THEN 1
        WHEN 'ALTA' THEN 2
        WHEN 'NORMAL' THEN 3
        WHEN 'BAJA' THEN 4
      END,
      me."slaDeadline" ASC NULLS LAST,
      me."createdAt" ASC
    LIMIT ${limit}
  `);

  return excepciones;
}

/**
 * Obtiene estadísticas de excepciones para Control Tower
 */
export async function getExceptionStats(
  companyId: number,
  prismaClient: PrismaClient
): Promise<{
  total: number;
  porTipo: Record<string, number>;
  porPrioridad: Record<string, number>;
  slaBreach: number;
  montoTotalAfectado: number;
  antiguedadPromedio: number;
}> {
  const stats = await prismaClient.$queryRaw<Array<{
    total: bigint;
    slaBreach: bigint;
    montoTotal: number | null;
    antiguedadProm: number | null;
  }>>`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN me."slaBreached" THEN 1 ELSE 0 END) as "slaBreach",
      SUM(me."montoAfectado")::float as "montoTotal",
      AVG(EXTRACT(EPOCH FROM (NOW() - me."createdAt")) / 3600)::float as "antiguedadProm"
    FROM "match_exceptions" me
    JOIN "MatchResult" mr ON mr.id = me."matchResultId"
    WHERE mr."companyId" = ${companyId}
    AND me."resuelto" = false
  `;

  const porTipo = await prismaClient.$queryRaw<Array<{ tipo: string; count: bigint }>>`
    SELECT me.tipo, COUNT(*) as count
    FROM "match_exceptions" me
    JOIN "MatchResult" mr ON mr.id = me."matchResultId"
    WHERE mr."companyId" = ${companyId}
    AND me."resuelto" = false
    GROUP BY me.tipo
  `;

  const porPrioridad = await prismaClient.$queryRaw<Array<{ prioridad: string; count: bigint }>>`
    SELECT me.prioridad, COUNT(*) as count
    FROM "match_exceptions" me
    JOIN "MatchResult" mr ON mr.id = me."matchResultId"
    WHERE mr."companyId" = ${companyId}
    AND me."resuelto" = false
    GROUP BY me.prioridad
  `;

  return {
    total: Number(stats[0]?.total || 0),
    porTipo: Object.fromEntries(porTipo.map(p => [p.tipo, Number(p.count)])),
    porPrioridad: Object.fromEntries(porPrioridad.map(p => [p.prioridad || 'NORMAL', Number(p.count)])),
    slaBreach: Number(stats[0]?.slaBreach || 0),
    montoTotalAfectado: stats[0]?.montoTotal || 0,
    antiguedadPromedio: Math.round(stats[0]?.antiguedadProm || 0),
  };
}
