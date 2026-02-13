/**
 * Notification Outbox - Sistema de notificaciones asíncronas
 *
 * Implementa el patrón Outbox para notificaciones:
 * - Las notificaciones se crean en una cola (outbox)
 * - Un job las procesa y envía asíncronamente
 * - Garantiza entrega con reintentos
 *
 * Tipos de notificaciones:
 * - EMAIL: Envío por correo electrónico
 * - IN_APP: Notificación dentro de la aplicación
 * - WEBHOOK: Callback a sistemas externos
 */

import { PrismaClient } from '@prisma/client';

// ============================================================
// TIPOS
// ============================================================

export type NotificationType =
  | 'PEDIDO_CREADO'
  | 'PEDIDO_APROBACION_REQUERIDA'
  | 'PEDIDO_APROBADO'
  | 'PEDIDO_RECHAZADO'
  | 'OC_CREADA'
  | 'OC_APROBACION_REQUERIDA'
  | 'OC_APROBADA'
  | 'RECEPCION_CONFIRMADA'
  | 'FACTURA_REGISTRADA'
  | 'MATCH_EXCEPTION'
  | 'MATCH_RESOLVED'
  | 'PAGO_CREADO'
  | 'PAGO_APROBACION_REQUERIDA'
  | 'PAGO_APROBADO'
  | 'PAGO_EJECUTADO'
  | 'CAMBIO_BANCARIO_PENDIENTE'
  | 'CAMBIO_BANCARIO_APROBADO'
  | 'GRNI_AGING_ALERT'
  | 'SLA_BREACH'
  | 'EXCEPTION_ESCALATED'
  | 'SYSTEM_ALERT';

export type NotificationPriority = 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';

export type NotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'EXPIRED';

export interface NotificationRecipient {
  userId?: number;
  email?: string;
  role?: string;  // Envía a todos los usuarios con ese rol
}

export interface NotificationData {
  type: NotificationType;
  companyId: number;
  priority?: NotificationPriority;
  entityType?: string;
  entityId?: number;
  recipient: NotificationRecipient;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
  expiresInHours?: number;  // Default 7 días
}

// ============================================================
// PLANTILLAS DE NOTIFICACIÓN
// ============================================================

const NOTIFICATION_TEMPLATES: Partial<Record<NotificationType, {
  subjectTemplate: string;
  bodyTemplate: string;
  defaultPriority: NotificationPriority;
}>> = {
  PEDIDO_APROBACION_REQUERIDA: {
    subjectTemplate: 'Pedido #{numero} requiere aprobación',
    bodyTemplate: 'El pedido #{numero} por ${monto} de {solicitante} requiere tu aprobación. Prioridad: {prioridad}.',
    defaultPriority: 'NORMAL',
  },
  PEDIDO_APROBADO: {
    subjectTemplate: 'Pedido #{numero} aprobado',
    bodyTemplate: 'Tu pedido #{numero} ha sido aprobado por {aprobador}.',
    defaultPriority: 'NORMAL',
  },
  PEDIDO_RECHAZADO: {
    subjectTemplate: 'Pedido #{numero} rechazado',
    bodyTemplate: 'Tu pedido #{numero} ha sido rechazado. Motivo: {motivo}.',
    defaultPriority: 'ALTA',
  },
  OC_APROBACION_REQUERIDA: {
    subjectTemplate: 'OC #{numero} requiere aprobación',
    bodyTemplate: 'La orden de compra #{numero} por ${monto} para {proveedor} requiere tu aprobación.',
    defaultPriority: 'NORMAL',
  },
  MATCH_EXCEPTION: {
    subjectTemplate: 'Excepción de match - Factura #{facturaNumero}',
    bodyTemplate: 'Se detectó una excepción en el match de la factura #{facturaNumero}: {tipoExcepcion}. Monto afectado: ${montoAfectado}.',
    defaultPriority: 'ALTA',
  },
  PAGO_APROBACION_REQUERIDA: {
    subjectTemplate: 'Pago #{numero} requiere aprobación',
    bodyTemplate: 'El pago #{numero} por ${monto} a {proveedor} requiere tu aprobación.',
    defaultPriority: 'ALTA',
  },
  CAMBIO_BANCARIO_PENDIENTE: {
    subjectTemplate: 'Cambio bancario pendiente - {proveedor}',
    bodyTemplate: 'El proveedor {proveedor} tiene un cambio de datos bancarios pendiente de aprobación. CBU: {cbuNuevo}.',
    defaultPriority: 'URGENTE',
  },
  GRNI_AGING_ALERT: {
    subjectTemplate: 'Alerta GRNI - {proveedor} ({dias} días)',
    bodyTemplate: 'Hay recepciones sin facturar de {proveedor} con más de {dias} días de antigüedad. Monto: ${monto}.',
    defaultPriority: 'NORMAL',
  },
  SLA_BREACH: {
    subjectTemplate: 'SLA incumplido - {entidad} #{numero}',
    bodyTemplate: 'Se ha incumplido el SLA para {entidad} #{numero}. Excedido por {horasExceso} horas.',
    defaultPriority: 'URGENTE',
  },
  EXCEPTION_ESCALATED: {
    subjectTemplate: 'Excepción escalada - {tipoExcepcion}',
    bodyTemplate: 'La excepción {tipoExcepcion} ha sido escalada a tu atención. Factura: {facturaNumero}. Monto: ${montoAfectado}.',
    defaultPriority: 'URGENTE',
  },
};

// ============================================================
// FUNCIONES DE CREACIÓN
// ============================================================

/**
 * Crea una notificación en el outbox
 */
export async function createNotification(
  data: NotificationData,
  prismaClient: PrismaClient | any
): Promise<{ success: boolean; notificationId?: number; error?: string }> {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (data.expiresInHours || 7 * 24)); // Default 7 días

    const result = await prismaClient.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "NotificationOutbox" (
        "companyId", "type", "priority", "entityType", "entityId",
        "recipientUserId", "recipientEmail", "recipientRole",
        "subject", "body", "metadata", "status", "expiresAt"
      ) VALUES (
        ${data.companyId},
        ${data.type},
        ${data.priority || 'NORMAL'},
        ${data.entityType || null},
        ${data.entityId || null},
        ${data.recipient.userId || null},
        ${data.recipient.email || null},
        ${data.recipient.role || null},
        ${data.subject},
        ${data.body},
        ${data.metadata ? JSON.stringify(data.metadata) : null}::jsonb,
        'PENDING',
        ${expiresAt}
      )
      RETURNING id
    `;

    return { success: true, notificationId: result[0]?.id };
  } catch (err) {
    console.error('[NOTIFICATION] Error creating notification:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Crea una notificación usando plantilla
 */
export async function createNotificationFromTemplate(
  type: NotificationType,
  companyId: number,
  recipient: NotificationRecipient,
  variables: Record<string, string | number>,
  entityType?: string,
  entityId?: number,
  prismaClient?: PrismaClient | any
): Promise<{ success: boolean; notificationId?: number; error?: string }> {
  const template = NOTIFICATION_TEMPLATES[type];
  if (!template) {
    // Crear notificación sin plantilla
    return createNotification({
      type,
      companyId,
      recipient,
      subject: `Notificación: ${type}`,
      body: JSON.stringify(variables),
      entityType,
      entityId,
    }, prismaClient);
  }

  // Reemplazar variables en plantilla
  let subject = template.subjectTemplate;
  let body = template.bodyTemplate;

  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    body = body.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }

  return createNotification({
    type,
    companyId,
    priority: template.defaultPriority,
    recipient,
    subject,
    body,
    entityType,
    entityId,
    metadata: variables,
  }, prismaClient);
}

/**
 * Crea notificaciones para todos los usuarios con un rol específico
 */
export async function notifyRole(
  type: NotificationType,
  companyId: number,
  role: string,
  variables: Record<string, string | number>,
  entityType?: string,
  entityId?: number,
  prismaClient?: PrismaClient | any
): Promise<{ success: boolean; count: number }> {
  // Buscar usuarios con el rol
  const users = await prismaClient.$queryRaw<Array<{ id: number; email: string }>>`
    SELECT u.id, u.email
    FROM "User" u
    JOIN "user_companies" uc ON uc."userId" = u.id
    JOIN "user_company_roles" ucr ON ucr."userCompanyId" = uc.id
    JOIN "Role" r ON r.id = ucr."roleId"
    WHERE uc."companyId" = ${companyId}
    AND r.name = ${role}
    AND u."isActive" = true
  `;

  let count = 0;
  for (const user of users) {
    const result = await createNotificationFromTemplate(
      type,
      companyId,
      { userId: user.id, email: user.email },
      variables,
      entityType,
      entityId,
      prismaClient
    );
    if (result.success) count++;
  }

  return { success: true, count };
}

// ============================================================
// FUNCIONES DE PROCESAMIENTO
// ============================================================

/**
 * Obtiene notificaciones pendientes para procesar
 */
export async function getPendingNotifications(
  limit: number,
  prismaClient: PrismaClient | any
): Promise<Array<{
  id: number;
  companyId: number;
  type: string;
  priority: string;
  recipientUserId: number | null;
  recipientEmail: string | null;
  recipientRole: string | null;
  subject: string;
  body: string;
  metadata: any;
  attempts: number;
}>> {
  // Ordenar por prioridad y antigüedad
  const notifications = await prismaClient.$queryRaw<Array<{
    id: number;
    companyId: number;
    type: string;
    priority: string;
    recipientUserId: number | null;
    recipientEmail: string | null;
    recipientRole: string | null;
    subject: string;
    body: string;
    metadata: any;
    attempts: number;
  }>>`
    SELECT id, "companyId", type, priority, "recipientUserId", "recipientEmail",
           "recipientRole", subject, body, metadata, attempts
    FROM "NotificationOutbox"
    WHERE status = 'PENDING'
    AND "expiresAt" > NOW()
    ORDER BY
      CASE priority
        WHEN 'URGENTE' THEN 1
        WHEN 'ALTA' THEN 2
        WHEN 'NORMAL' THEN 3
        WHEN 'BAJA' THEN 4
      END,
      "createdAt" ASC
    LIMIT ${limit}
    FOR UPDATE SKIP LOCKED
  `;

  return notifications;
}

/**
 * Marca una notificación como en procesamiento
 */
export async function markAsProcessing(
  notificationId: number,
  prismaClient: PrismaClient | any
): Promise<void> {
  await prismaClient.$executeRaw`
    UPDATE "NotificationOutbox"
    SET status = 'PROCESSING', "lastAttemptAt" = NOW(), attempts = attempts + 1
    WHERE id = ${notificationId}
  `;
}

/**
 * Marca una notificación como enviada
 */
export async function markAsSent(
  notificationId: number,
  prismaClient: PrismaClient | any
): Promise<void> {
  await prismaClient.$executeRaw`
    UPDATE "NotificationOutbox"
    SET status = 'SENT', "sentAt" = NOW()
    WHERE id = ${notificationId}
  `;
}

/**
 * Marca una notificación como fallida
 */
export async function markAsFailed(
  notificationId: number,
  errorMessage: string,
  prismaClient: PrismaClient | any
): Promise<void> {
  await prismaClient.$executeRaw`
    UPDATE "NotificationOutbox"
    SET status = CASE WHEN attempts >= 3 THEN 'FAILED' ELSE 'PENDING' END,
        "errorMessage" = ${errorMessage}
    WHERE id = ${notificationId}
  `;
}

/**
 * Limpia notificaciones expiradas
 */
export async function cleanupExpiredNotifications(
  prismaClient: PrismaClient | any
): Promise<number> {
  const result = await prismaClient.$executeRaw`
    UPDATE "NotificationOutbox"
    SET status = 'EXPIRED'
    WHERE status = 'PENDING'
    AND "expiresAt" < NOW()
  `;
  return result;
}

// ============================================================
// FUNCIONES DE CONSULTA
// ============================================================

/**
 * Obtiene notificaciones para un usuario (in-app notifications)
 */
export async function getUserNotifications(
  userId: number,
  companyId: number,
  prismaClient: PrismaClient | any,
  options?: {
    unreadOnly?: boolean;
    limit?: number;
    types?: NotificationType[];
  }
): Promise<Array<{
  id: number;
  type: string;
  priority: string;
  subject: string;
  body: string;
  metadata: any;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
}>> {
  const limit = options?.limit || 50;

  let whereClause = `"recipientUserId" = ${userId} AND "companyId" = ${companyId}`;

  if (options?.unreadOnly) {
    whereClause += ` AND status IN ('PENDING', 'SENT')`;
  }

  if (options?.types && options.types.length > 0) {
    const typesStr = options.types.map(t => `'${t}'`).join(',');
    whereClause += ` AND type IN (${typesStr})`;
  }

  const notifications = await prismaClient.$queryRawUnsafe<Array<{
    id: number;
    type: string;
    priority: string;
    subject: string;
    body: string;
    metadata: any;
    status: string;
    createdAt: Date;
    sentAt: Date | null;
  }>>(`
    SELECT id, type, priority, subject, body, metadata, status, "createdAt", "sentAt"
    FROM "NotificationOutbox"
    WHERE ${whereClause}
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `);

  return notifications;
}

/**
 * Obtiene estadísticas del outbox para monitoreo
 */
export async function getOutboxStats(
  companyId: number | null,
  prismaClient: PrismaClient | any
): Promise<{
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  expired: number;
  byPriority: Record<string, number>;
  avgLatencyMs: number;
}> {
  let whereClause = '1=1';
  if (companyId) {
    whereClause = `"companyId" = ${companyId}`;
  }

  const stats = await prismaClient.$queryRawUnsafe<Array<{
    status: string;
    count: bigint;
    priority: string;
  }>>(`
    SELECT status, priority, COUNT(*) as count
    FROM "NotificationOutbox"
    WHERE ${whereClause}
    GROUP BY status, priority
  `);

  const latency = await prismaClient.$queryRawUnsafe<Array<{ avg_latency: number }>>(`
    SELECT AVG(EXTRACT(EPOCH FROM ("sentAt" - "createdAt")) * 1000)::float as avg_latency
    FROM "NotificationOutbox"
    WHERE ${whereClause} AND status = 'SENT' AND "sentAt" IS NOT NULL
  `);

  const result = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    expired: 0,
    byPriority: {} as Record<string, number>,
    avgLatencyMs: latency[0]?.avg_latency || 0,
  };

  for (const stat of stats) {
    const count = Number(stat.count);
    switch (stat.status) {
      case 'PENDING': result.pending += count; break;
      case 'PROCESSING': result.processing += count; break;
      case 'SENT': result.sent += count; break;
      case 'FAILED': result.failed += count; break;
      case 'EXPIRED': result.expired += count; break;
    }
    result.byPriority[stat.priority] = (result.byPriority[stat.priority] || 0) + count;
  }

  return result;
}
