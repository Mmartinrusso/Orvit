/**
 * POST /api/auth/logout
 *
 * Cierra la sesión del usuario:
 * - Agrega tokens a blacklist
 * - Revoca la sesión actual
 * - Limpia todas las cookies
 *
 * Query params:
 * - all=true: Cierra todas las sesiones del usuario
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loggers } from '@/lib/logger';
import {
  getAuthCookies,
  clearAuthCookies,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/lib/auth/tokens';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { addToBlacklist } from '@/lib/auth/blacklist';
import { revokeSession, revokeAllUserSessions } from '@/lib/auth/sessions';
import { invalidateCache } from '@/lib/cache/cache-manager';
import { invalidationPatterns } from '@/lib/cache/cache-keys';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logoutAll = searchParams.get('all') === 'true';

    // Obtener tokens de cookies
    const { accessToken, refreshToken, legacyToken } = getAuthCookies();

    let userId: number | undefined;
    let sessionId: string | undefined;

    // Intentar obtener userId y sessionId del access token
    if (accessToken) {
      const payload = await verifyAccessToken(accessToken);
      if (payload) {
        userId = payload.userId;
        sessionId = payload.sessionId;
      }
    }

    // Si no hay access token válido, intentar con refresh token
    if (!userId && refreshToken) {
      const verification = await verifyRefreshToken(refreshToken);
      if (verification.valid) {
        userId = verification.userId;
        sessionId = verification.sessionId;
      }
    }

    // Agregar tokens a blacklist (si existen)
    const now = new Date();

    if (accessToken && userId) {
      const accessExpires = new Date(now.getTime() + AUTH_CONFIG.accessToken.expiresInMs);
      await addToBlacklist(accessToken, 'access', userId, 'logout', accessExpires).catch(() => {});
    }

    if (refreshToken && userId) {
      const refreshExpires = new Date(now.getTime() + AUTH_CONFIG.refreshToken.expiresInMs);
      await addToBlacklist(refreshToken, 'refresh', userId, 'logout', refreshExpires).catch(() => {});
    }

    // Revocar sesión(es)
    if (userId) {
      if (logoutAll) {
        // Cerrar todas las sesiones del usuario
        await revokeAllUserSessions(userId, 'logout_all');
      } else if (sessionId) {
        // Solo cerrar la sesión actual
        await revokeSession(sessionId, 'logout');
      }
    }

    // Invalidar cache de auth y permisos para el usuario
    if (userId) {
      // Use companyId=1 as default since we don't have it in logout context
      // The pattern-based invalidation will clean up all user-related keys
      await invalidateCache(invalidationPatterns.userLogout(userId, 1)).catch(() => {});
    }

    // Limpiar cookies
    clearAuthCookies();

    // También limpiar cookie legacy
    cookies().delete('token');

    return NextResponse.json(
      {
        message: logoutAll
          ? 'Todas las sesiones cerradas exitosamente'
          : 'Sesión cerrada exitosamente',
      },
      { status: 200 }
    );
  } catch (error) {
    loggers.auth.error({ err: error }, 'Logout error');

    // Incluso si hay error, limpiar cookies
    try {
      clearAuthCookies();
      cookies().delete('token');
    } catch {}

    return NextResponse.json({ error: 'Error al cerrar sesión' }, { status: 500 });
  }
}
