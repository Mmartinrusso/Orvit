/**
 * withGuards - Reusable API route middleware for authentication and authorization
 *
 * Provides:
 * - JWT authentication via cookies (token, accessToken)
 * - Optional granular permission checking via getUserPermissions
 * - Per-endpoint rate limiting (defaults by HTTP method, overridable)
 * - Security audit logging via loggers.auth
 * - Consistent error responses (401/403/429)
 *
 * Usage:
 *   // Auth only (default rate limits: GET=300/min, others=100/min)
 *   export const GET = withGuards(async (req, ctx) => { ... });
 *
 *   // Auth + permission + custom rate limit
 *   export const POST = withGuards(async (req, ctx) => { ... }, {
 *     requiredPermissions: ['costs.edit'],
 *     rateLimitOverride: 10, // 10 req/min instead of default 100
 *   });
 *
 *   // Auth + any of multiple permissions (OR logic)
 *   export const DELETE = withGuards(async (req, ctx) => { ... }, {
 *     requiredPermissions: ['costs.admin', 'costs.delete'],
 *     permissionMode: 'any',
 *   });
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions-helpers';
import { loggers } from '@/lib/logger';
import type { Permission } from '@/lib/permissions';
import * as Sentry from '@sentry/nextjs';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuardedUser {
  userId: number;
  companyId: number;
  role: string;
  email: string;
  name: string;
  permissions: string[];
}

export interface GuardedContext {
  user: GuardedUser;
  params?: Record<string, string>;
}

type GuardedHandler = (
  request: NextRequest,
  context: GuardedContext,
  routeContext?: { params: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

export interface WithGuardsOptions {
  /** Permissions required to access this endpoint. */
  requiredPermissions?: Permission[];
  /**
   * 'all' = user must have ALL listed permissions (AND).
   * 'any' = user must have at least ONE of the listed permissions (OR).
   * Default: 'any'
   */
  permissionMode?: 'all' | 'any';
  /**
   * Override the default rate limit (requests per minute) for this endpoint.
   * Defaults: GET = 300/min, others = 100/min.
   * Set to 0 to disable rate limiting for this endpoint.
   */
  rateLimitOverride?: number;
}

// ─── Rate limiting in-memory store ──────────────────────────────────────────

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

// Default rate limits per HTTP method (requests per minute)
const DEFAULT_RATE_LIMITS: Record<string, number> = {
  GET: 300,
  HEAD: 300,
  OPTIONS: 300,
  POST: 100,
  PUT: 100,
  PATCH: 100,
  DELETE: 100,
};

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

// Cleanup expired buckets every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60_000);

function checkAndIncrementRateLimit(
  key: string,
  maxRequests: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  bucket.count++;
  const remaining = Math.max(0, maxRequests - bucket.count);
  const resetAt = bucket.windowStart + RATE_LIMIT_WINDOW_MS;

  if (bucket.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining, resetAt };
}

// ─── Cache for user lookups (per-request dedup via global WeakMap) ───────────

const userCache = new Map<number, { data: any; ts: number }>();
const USER_CACHE_TTL = 30_000; // 30 seconds

async function resolveUser(userId: number) {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.ts < USER_CACHE_TTL) {
    return cached.data;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companies: {
          where: { isActive: true },
          select: { companyId: true },
          take: 1,
        },
      },
    });

    if (user) {
      userCache.set(userId, { data: user, ts: Date.now() });
      // Evict old entries periodically
      if (userCache.size > 200) {
        const now = Date.now();
        const keysToDelete: number[] = [];
        userCache.forEach((v, k) => {
          if (now - v.ts > USER_CACHE_TTL) keysToDelete.push(k);
        });
        keysToDelete.forEach((k) => userCache.delete(k));
      }
    }

    return user;
  } catch (err) {
    loggers.auth.error(
      { userId, err },
      'Database error in resolveUser'
    );
    return null;
  }
}

// ─── Core middleware ─────────────────────────────────────────────────────────

export function withGuards(
  handler: GuardedHandler,
  options: WithGuardsOptions = {}
) {
  const { requiredPermissions = [], permissionMode = 'any', rateLimitOverride } = options;

  return async function guardedHandler(
    request: NextRequest,
    routeContext?: { params: Record<string, string> }
  ): Promise<NextResponse> {
    const endpoint = `${request.method} ${request.nextUrl.pathname}`;

    // ── 1. Extract JWT token ─────────────────────────────────────────────
    let token: string | undefined;
    try {
      const cookieStore = await cookies();
      token =
        cookieStore.get('accessToken')?.value ||
        cookieStore.get('token')?.value;
    } catch {
      // cookies() can throw outside of request context
    }

    if (!token) {
      loggers.auth.warn(
        { endpoint, reason: 'no_token' },
        'Unauthorized access attempt: no token'
      );
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // ── 2. Verify JWT ────────────────────────────────────────────────────
    let payload: any;
    try {
      const result = await jwtVerify(token, JWT_SECRET_KEY);
      payload = result.payload;
    } catch (err) {
      loggers.auth.warn(
        { endpoint, reason: 'invalid_token' },
        'Unauthorized access attempt: invalid/expired token'
      );
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      );
    }

    const userId = payload.userId as number;
    if (!userId) {
      loggers.auth.warn(
        { endpoint, reason: 'missing_userId' },
        'Unauthorized access attempt: token missing userId'
      );
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    // ── 3. Resolve user from DB ──────────────────────────────────────────
    const user = await resolveUser(userId);
    if (!user) {
      loggers.auth.warn(
        { endpoint, userId, reason: 'user_not_found' },
        'Unauthorized access attempt: user not found in DB'
      );
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 401 }
      );
    }

    const companyId =
      (payload.companyId as number) ||
      user.companies?.[0]?.companyId;

    if (!companyId) {
      loggers.auth.warn(
        { endpoint, userId, reason: 'no_company' },
        'Unauthorized access attempt: user has no company'
      );
      return NextResponse.json(
        { error: 'Usuario sin empresa asociada' },
        { status: 401 }
      );
    }

    // ── 4. Rate limiting ────────────────────────────────────────────────
    const maxReqs = rateLimitOverride !== undefined
      ? rateLimitOverride
      : (DEFAULT_RATE_LIMITS[request.method] ?? 100);

    if (maxReqs > 0) {
      const rlKey = `rl:${userId}:${request.nextUrl.pathname}`;
      const rl = checkAndIncrementRateLimit(rlKey, maxReqs);

      if (!rl.allowed) {
        const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);

        loggers.api.warn(
          {
            endpoint,
            userId,
            companyId,
            maxReqs,
            reason: 'rate_limit_exceeded',
          },
          `Rate limit exceeded: ${endpoint}`
        );

        Sentry.captureMessage(`Rate limit exceeded: ${endpoint}`, {
          level: 'warning',
          extra: { userId, companyId, maxReqs },
        });

        return NextResponse.json(
          { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(maxReqs),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
            },
          }
        );
      }
    }

    // ── 5. Permission check (if required) ────────────────────────────────
    let userPermissions: string[] = [];

    if (requiredPermissions.length > 0) {
      userPermissions = await getUserPermissions(
        userId,
        user.role,
        companyId
      );

      const hasAccess =
        permissionMode === 'all'
          ? requiredPermissions.every((p) => userPermissions.includes(p))
          : requiredPermissions.some((p) => userPermissions.includes(p));

      if (!hasAccess) {
        loggers.auth.warn(
          {
            endpoint,
            userId,
            companyId,
            role: user.role,
            requiredPermissions,
            permissionMode,
            userPermissions: userPermissions.filter((p) =>
              requiredPermissions.includes(p as Permission)
            ),
            reason: 'insufficient_permissions',
          },
          `Permission denied: ${endpoint}`
        );
        return NextResponse.json(
          {
            error: 'No tienes permisos para realizar esta acción',
            requiredPermissions,
          },
          { status: 403 }
        );
      }
    }

    // ── 6. Build context and call handler ────────────────────────────────
    const guardedCtx: GuardedContext = {
      user: {
        userId,
        companyId,
        role: user.role,
        email: user.email,
        name: user.name,
        permissions: userPermissions,
      },
      params: routeContext?.params,
    };

    try {
      return await handler(request, guardedCtx, routeContext);
    } catch (err) {
      loggers.auth.error(
        {
          endpoint,
          userId,
          companyId,
          err,
        },
        `Unhandled error in guarded handler: ${endpoint}`
      );
      return NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
    }
  };
}
