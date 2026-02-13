/**
 * Manejo de Sesiones
 *
 * - Crear y gestionar sesiones de usuario
 * - Control de múltiples dispositivos
 * - Límite de sesiones simultáneas
 */

import { prisma } from '@/lib/prisma';
import { AUTH_CONFIG } from './config';
import { revokeSessionTokens } from './tokens';

// ============================================================================
// TIPOS
// ============================================================================

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  lastActivityAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

export interface DeviceInfo {
  fingerprint?: string;
  deviceName?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// CREAR SESIÓN
// ============================================================================

/**
 * Crea una nueva sesión para el usuario
 * Si excede el límite, cierra la sesión más antigua
 */
export async function createSession(
  userId: number,
  deviceInfo: DeviceInfo
): Promise<string> {
  const expiresAt = new Date(Date.now() + AUTH_CONFIG.session.inactivityTimeout);

  // Verificar cantidad de sesiones activas
  const activeSessions = await prisma.session.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActivityAt: 'asc' }, // Más antigua primero
  });

  // Si excede el límite, cerrar la sesión más antigua
  if (activeSessions.length >= AUTH_CONFIG.session.maxPerUser) {
    const sessionsToClose = activeSessions.slice(
      0,
      activeSessions.length - AUTH_CONFIG.session.maxPerUser + 1
    );

    for (const session of sessionsToClose) {
      await revokeSession(session.id, 'max_sessions_exceeded');
    }
  }

  // Crear nueva sesión
  const session = await prisma.session.create({
    data: {
      userId,
      deviceFingerprint: deviceInfo.fingerprint,
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      expiresAt,
    },
  });

  return session.id;
}

// ============================================================================
// OBTENER SESIONES
// ============================================================================

/**
 * Obtiene todas las sesiones activas de un usuario
 */
export async function getUserSessions(
  userId: number,
  currentSessionId?: string
): Promise<SessionInfo[]> {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  return sessions.map(s => ({
    id: s.id,
    deviceName: s.deviceName,
    deviceType: s.deviceType,
    browser: s.browser,
    os: s.os,
    ipAddress: s.ipAddress,
    lastActivityAt: s.lastActivityAt,
    createdAt: s.createdAt,
    isCurrent: s.id === currentSessionId,
  }));
}

/**
 * Verifica si una sesión está activa
 */
export async function isSessionActive(sessionId: string): Promise<boolean> {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
  });

  return !!session;
}

/**
 * Obtiene los detalles de una sesión específica
 */
export async function getSession(sessionId: string): Promise<SessionInfo | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) return null;

  return {
    id: session.id,
    deviceName: session.deviceName,
    deviceType: session.deviceType,
    browser: session.browser,
    os: session.os,
    ipAddress: session.ipAddress,
    lastActivityAt: session.lastActivityAt,
    createdAt: session.createdAt,
    isCurrent: false,
  };
}

// ============================================================================
// ACTUALIZAR SESIÓN
// ============================================================================

/**
 * Actualiza la última actividad de una sesión
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { lastActivityAt: new Date() },
  }).catch(() => {
    // Ignorar errores si la sesión no existe
  });
}

/**
 * Extiende la expiración de una sesión
 */
export async function extendSession(sessionId: string): Promise<void> {
  const newExpiresAt = new Date(Date.now() + AUTH_CONFIG.session.inactivityTimeout);

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      expiresAt: newExpiresAt,
      lastActivityAt: new Date(),
    },
  }).catch(() => {
    // Ignorar errores si la sesión no existe
  });
}

// ============================================================================
// REVOCAR SESIONES
// ============================================================================

/**
 * Revoca una sesión específica
 */
export async function revokeSession(
  sessionId: string,
  reason?: string
): Promise<void> {
  // Revocar los refresh tokens de esta sesión
  await revokeSessionTokens(sessionId);

  // Marcar sesión como revocada
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokeReason: reason,
    },
  }).catch(() => {
    // Ignorar si no existe
  });
}

/**
 * Revoca todas las sesiones de un usuario excepto la actual
 */
export async function revokeOtherSessions(
  userId: number,
  currentSessionId: string
): Promise<number> {
  // Obtener sesiones a revocar
  const sessionsToRevoke = await prisma.session.findMany({
    where: {
      userId,
      isActive: true,
      id: { not: currentSessionId },
    },
    select: { id: true },
  });

  // Revocar cada sesión
  for (const session of sessionsToRevoke) {
    await revokeSession(session.id, 'revoked_by_user');
  }

  return sessionsToRevoke.length;
}

/**
 * Revoca todas las sesiones de un usuario (incluyendo la actual)
 */
export async function revokeAllUserSessions(
  userId: number,
  reason: string = 'logout_all'
): Promise<number> {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: { id: true },
  });

  for (const session of sessions) {
    await revokeSession(session.id, reason);
  }

  return sessions.length;
}

// ============================================================================
// LIMPIEZA
// ============================================================================

/**
 * Limpia sesiones expiradas o inactivas (para cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { isActive: false },
      ],
    },
  });

  return result.count;
}

// ============================================================================
// ESTADÍSTICAS
// ============================================================================

/**
 * Obtiene estadísticas de sesiones de un usuario
 */
export async function getUserSessionStats(userId: number): Promise<{
  active: number;
  total: number;
  lastActivity: Date | null;
}> {
  const [active, total, lastSession] = await Promise.all([
    prisma.session.count({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.session.count({
      where: { userId },
    }),
    prisma.session.findFirst({
      where: { userId, isActive: true },
      orderBy: { lastActivityAt: 'desc' },
      select: { lastActivityAt: true },
    }),
  ]);

  return {
    active,
    total,
    lastActivity: lastSession?.lastActivityAt || null,
  };
}
