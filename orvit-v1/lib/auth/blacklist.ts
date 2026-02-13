/**
 * Token Blacklist con Cache en Memoria
 *
 * Permite invalidar tokens inmediatamente (logout, cambio de password, etc.)
 * Usa cache en memoria para evitar consultas a BD en cada request
 */

import { prisma } from '@/lib/prisma';
import { AUTH_CONFIG } from './config';
import { hashToken } from './tokens';

// ============================================================================
// CACHE EN MEMORIA
// ============================================================================

interface CacheEntry {
  isBlacklisted: boolean;
  expiresAt: number; // timestamp
}

const blacklistCache = new Map<string, CacheEntry>();

// Limpiar cache periódicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of blacklistCache.entries()) {
    if (now > entry.expiresAt) {
      blacklistCache.delete(key);
    }
  }
}, 60 * 1000); // Cada minuto

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Agrega un token a la blacklist
 */
export async function addToBlacklist(
  token: string,
  tokenType: 'access' | 'refresh',
  userId: number,
  reason: 'logout' | 'password_change' | 'admin_revoke' | 'security',
  tokenExpiresAt: Date
): Promise<void> {
  const tokenHash = hashToken(token);

  // Agregar a BD
  await prisma.tokenBlacklist.create({
    data: {
      tokenHash,
      tokenType,
      userId,
      reason,
      expiresAt: tokenExpiresAt,
    },
  });

  // Actualizar cache
  blacklistCache.set(tokenHash, {
    isBlacklisted: true,
    expiresAt: Date.now() + AUTH_CONFIG.blacklist.cacheTTL,
  });
}

/**
 * Verifica si un token está en la blacklist
 * Primero revisa cache, luego BD si es necesario
 */
export async function isBlacklisted(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);

  // Revisar cache primero
  const cached = blacklistCache.get(tokenHash);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.isBlacklisted;
  }

  // Consultar BD
  const entry = await prisma.tokenBlacklist.findUnique({
    where: { tokenHash },
  });

  const isBlacklistedResult = !!entry;

  // Actualizar cache
  blacklistCache.set(tokenHash, {
    isBlacklisted: isBlacklistedResult,
    expiresAt: Date.now() + AUTH_CONFIG.blacklist.cacheTTL,
  });

  return isBlacklistedResult;
}

/**
 * Agrega múltiples tokens a la blacklist (para logout de todas las sesiones)
 */
export async function addMultipleToBlacklist(
  tokens: Array<{
    token: string;
    tokenType: 'access' | 'refresh';
    expiresAt: Date;
  }>,
  userId: number,
  reason: 'logout' | 'password_change' | 'admin_revoke' | 'security'
): Promise<void> {
  const entries = tokens.map(t => ({
    tokenHash: hashToken(t.token),
    tokenType: t.tokenType,
    userId,
    reason,
    expiresAt: t.expiresAt,
  }));

  // Crear todos en BD
  await prisma.tokenBlacklist.createMany({
    data: entries,
    skipDuplicates: true,
  });

  // Actualizar cache
  for (const entry of entries) {
    blacklistCache.set(entry.tokenHash, {
      isBlacklisted: true,
      expiresAt: Date.now() + AUTH_CONFIG.blacklist.cacheTTL,
    });
  }
}

/**
 * Invalida todos los tokens de un usuario
 * Útil para cambio de password o compromiso de cuenta
 */
export async function blacklistAllUserTokens(
  userId: number,
  reason: 'password_change' | 'admin_revoke' | 'security'
): Promise<void> {
  // Obtener todos los refresh tokens activos del usuario
  const activeTokens = await prisma.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      token: true,
      expiresAt: true,
    },
  });

  // Agregar a blacklist
  if (activeTokens.length > 0) {
    await prisma.tokenBlacklist.createMany({
      data: activeTokens.map(t => ({
        tokenHash: t.token, // Ya está hasheado en BD
        tokenType: 'refresh',
        userId,
        reason,
        expiresAt: t.expiresAt,
      })),
      skipDuplicates: true,
    });
  }

  // Revocar todos los refresh tokens
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  // Invalidar todas las sesiones
  await prisma.session.updateMany({
    where: {
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokeReason: reason,
    },
  });
}

/**
 * Limpia tokens expirados de la blacklist (para cron job)
 */
export async function cleanupExpiredBlacklistEntries(): Promise<number> {
  const result = await prisma.tokenBlacklist.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}

/**
 * Obtiene estadísticas de la blacklist
 */
export async function getBlacklistStats(): Promise<{
  total: number;
  byReason: Record<string, number>;
  cacheSize: number;
}> {
  const total = await prisma.tokenBlacklist.count();

  const byReasonRaw = await prisma.tokenBlacklist.groupBy({
    by: ['reason'],
    _count: { reason: true },
  });

  const byReason: Record<string, number> = {};
  for (const item of byReasonRaw) {
    byReason[item.reason || 'unknown'] = item._count.reason;
  }

  return {
    total,
    byReason,
    cacheSize: blacklistCache.size,
  };
}
