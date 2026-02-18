/**
 * Rate Limiting con PostgreSQL + Cache en Memoria
 *
 * Protege contra:
 * - Ataques de fuerza bruta en login
 * - Abuso de APIs
 * - Spam en verificación 2FA
 */

import { prisma } from '@/lib/prisma';
import { AUTH_CONFIG } from './config';
import { NextRequest } from 'next/server';

// ============================================================================
// TIPOS
// ============================================================================

export type RateLimitAction = 'login' | 'loginByEmail' | '2fa' | 'api' | 'passwordReset';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // segundos hasta poder reintentar
  blocked: boolean;
  blockedUntil?: Date;
}

interface RateLimitConfig {
  window: number;      // segundos
  max: number;         // intentos máximos
  blockDuration?: number; // segundos de bloqueo
}

// ============================================================================
// CACHE EN MEMORIA
// ============================================================================

interface CacheEntry {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
  expiresAt: number;
}

const rateLimitCache = new Map<string, CacheEntry>();

// Limpiar cache cada minuto
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitCache.entries()) {
    if (now > entry.expiresAt) {
      rateLimitCache.delete(key);
    }
  }
}, 60 * 1000);

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Obtiene el identificador del cliente (IP)
 */
export function getClientIdentifier(request: NextRequest): string {
  // Intentar obtener IP real detrás de proxies
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  // Fallback
  return request.ip || 'unknown';
}

/**
 * Verifica si una acción está permitida según rate limiting
 */
export async function checkRateLimit(
  identifier: string,
  action: RateLimitAction
): Promise<RateLimitResult> {
  // Bypass rate limit en desarrollo para login
  if (process.env.NODE_ENV !== 'production' && (action === 'login' || action === 'loginByEmail')) {
    return {
      allowed: true,
      remaining: 999,
      resetAt: new Date(Date.now() + 60000),
      blocked: false,
    };
  }

  const config = getRateLimitConfig(action);
  const key = `${identifier}:${action}`;
  const now = Date.now();

  // Revisar cache primero
  const cached = rateLimitCache.get(key);

  if (cached && now < cached.expiresAt) {
    // Verificar si está bloqueado
    if (cached.blockedUntil && now < cached.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(cached.blockedUntil),
        retryAfter: Math.ceil((cached.blockedUntil - now) / 1000),
        blocked: true,
        blockedUntil: new Date(cached.blockedUntil),
      };
    }

    // Verificar si excede el límite
    if (cached.count >= config.max) {
      // Bloquear si hay blockDuration configurado
      if (config.blockDuration) {
        const blockedUntil = now + config.blockDuration * 1000;
        cached.blockedUntil = blockedUntil;
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(blockedUntil),
          retryAfter: config.blockDuration,
          blocked: true,
          blockedUntil: new Date(blockedUntil),
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(cached.firstAttempt + config.window * 1000),
        retryAfter: Math.ceil((cached.firstAttempt + config.window * 1000 - now) / 1000),
        blocked: false,
      };
    }

    // Permitido
    return {
      allowed: true,
      remaining: config.max - cached.count,
      resetAt: new Date(cached.firstAttempt + config.window * 1000),
      blocked: false,
    };
  }

  // No hay cache, consultar BD
  return await checkRateLimitFromDB(identifier, action, config);
}

/**
 * Incrementa el contador de intentos
 */
export async function incrementRateLimit(
  identifier: string,
  action: RateLimitAction
): Promise<void> {
  const config = getRateLimitConfig(action);
  const key = `${identifier}:${action}`;
  const now = Date.now();

  // Actualizar cache
  const cached = rateLimitCache.get(key);

  if (cached && now < cached.expiresAt) {
    cached.count++;
    cached.expiresAt = now + AUTH_CONFIG.rateLimit.cacheTTL;

    // Si excede el límite y hay bloqueo, aplicarlo
    if (cached.count >= config.max && config.blockDuration) {
      cached.blockedUntil = now + config.blockDuration * 1000;
    }
  } else {
    rateLimitCache.set(key, {
      count: 1,
      firstAttempt: now,
      expiresAt: now + config.window * 1000,
    });
  }

  // Actualizar BD (async, no bloquear)
  updateRateLimitInDB(identifier, action).catch(console.error);
}

/**
 * Resetea el contador de rate limit (después de login exitoso)
 */
export async function resetRateLimit(
  identifier: string,
  action: RateLimitAction
): Promise<void> {
  const key = `${identifier}:${action}`;

  // Limpiar cache
  rateLimitCache.delete(key);

  // Limpiar BD
  await prisma.rateLimitEntry.deleteMany({
    where: { identifier, action },
  }).catch(() => {});
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function getRateLimitConfig(action: RateLimitAction): RateLimitConfig {
  const configs: Record<RateLimitAction, RateLimitConfig> = {
    login: AUTH_CONFIG.rateLimit.login,
    loginByEmail: AUTH_CONFIG.rateLimit.loginByEmail,
    '2fa': AUTH_CONFIG.rateLimit['2fa'],
    api: AUTH_CONFIG.rateLimit.api,
    passwordReset: AUTH_CONFIG.rateLimit.passwordReset,
  };

  return configs[action];
}

async function checkRateLimitFromDB(
  identifier: string,
  action: RateLimitAction,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.window * 1000);

  const entry = await prisma.rateLimitEntry.findUnique({
    where: {
      identifier_action: { identifier, action },
    },
  });

  // No hay entrada, permitido
  if (!entry) {
    return {
      allowed: true,
      remaining: config.max,
      resetAt: new Date(now.getTime() + config.window * 1000),
      blocked: false,
    };
  }

  // Verificar si está bloqueado
  if (entry.blockedUntil && entry.blockedUntil > now) {
    // Actualizar cache
    rateLimitCache.set(`${identifier}:${action}`, {
      count: entry.count,
      firstAttempt: entry.firstAttempt.getTime(),
      blockedUntil: entry.blockedUntil.getTime(),
      expiresAt: entry.blockedUntil.getTime(),
    });

    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: Math.ceil((entry.blockedUntil.getTime() - now.getTime()) / 1000),
      blocked: true,
      blockedUntil: entry.blockedUntil,
    };
  }

  // Verificar si la ventana expiró
  if (entry.firstAttempt < windowStart) {
    // La ventana expiró, resetear
    await prisma.rateLimitEntry.delete({
      where: { identifier_action: { identifier, action } },
    }).catch(() => {});

    return {
      allowed: true,
      remaining: config.max,
      resetAt: new Date(now.getTime() + config.window * 1000),
      blocked: false,
    };
  }

  // Actualizar cache
  rateLimitCache.set(`${identifier}:${action}`, {
    count: entry.count,
    firstAttempt: entry.firstAttempt.getTime(),
    blockedUntil: entry.blockedUntil?.getTime(),
    expiresAt: entry.firstAttempt.getTime() + config.window * 1000,
  });

  // Verificar límite
  if (entry.count >= config.max) {
    const resetAt = config.blockDuration
      ? new Date(now.getTime() + config.blockDuration * 1000)
      : new Date(entry.firstAttempt.getTime() + config.window * 1000);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
      blocked: !!config.blockDuration,
      blockedUntil: config.blockDuration ? resetAt : undefined,
    };
  }

  return {
    allowed: true,
    remaining: config.max - entry.count,
    resetAt: new Date(entry.firstAttempt.getTime() + config.window * 1000),
    blocked: false,
  };
}

async function updateRateLimitInDB(
  identifier: string,
  action: RateLimitAction
): Promise<void> {
  const config = getRateLimitConfig(action);
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.window * 1000);

  try {
    // Check if existing entry has an expired window
    const existing = await prisma.rateLimitEntry.findUnique({
      where: { identifier_action: { identifier, action } },
    });

    if (existing && existing.firstAttempt < windowStart) {
      // Window expired, reset the entry
      await prisma.rateLimitEntry.update({
        where: { identifier_action: { identifier, action } },
        data: {
          count: 1,
          firstAttempt: now,
          lastAttempt: now,
          blockedUntil: null,
        },
      });
      return;
    }

    // Upsert: increment count or create new entry
    const entry = await prisma.rateLimitEntry.upsert({
      where: {
        identifier_action: { identifier, action },
      },
      update: {
        count: { increment: 1 },
        lastAttempt: now,
      },
      create: {
        identifier,
        action,
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      },
    });

    // Apply block if count exceeds max and blockDuration is configured
    if (entry.count >= config.max && config.blockDuration) {
      await prisma.rateLimitEntry.update({
        where: { identifier_action: { identifier, action } },
        data: {
          blockedUntil: new Date(now.getTime() + config.blockDuration * 1000),
        },
      });
    }
  } catch (error) {
    console.error('Error updating rate limit in DB:', error);
  }
}

// ============================================================================
// LIMPIEZA
// ============================================================================

/**
 * Limpia entradas expiradas (para cron job)
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const now = new Date();

  // Obtener todas las configuraciones de ventana
  const maxWindow = Math.max(
    AUTH_CONFIG.rateLimit.login.window,
    AUTH_CONFIG.rateLimit.loginByEmail.window,
    AUTH_CONFIG.rateLimit['2fa'].window,
    AUTH_CONFIG.rateLimit.api.window,
    AUTH_CONFIG.rateLimit.passwordReset.window
  );

  const expiredBefore = new Date(now.getTime() - maxWindow * 1000);

  const result = await prisma.rateLimitEntry.deleteMany({
    where: {
      AND: [
        { firstAttempt: { lt: expiredBefore } },
        {
          OR: [
            { blockedUntil: null },
            { blockedUntil: { lt: now } },
          ],
        },
      ],
    },
  });

  return result.count;
}

// ============================================================================
// MIDDLEWARE HELPER
// ============================================================================

/**
 * Helper para usar en middleware de Next.js
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  action: RateLimitAction = 'api'
): Promise<RateLimitResult> {
  const identifier = getClientIdentifier(request);
  return await checkRateLimit(identifier, action);
}
