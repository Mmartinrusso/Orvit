/**
 * POST /api/auth/refresh
 *
 * Renueva el access token usando el refresh token
 * - Valida el refresh token
 * - Verifica que la sesión esté activa
 * - Rota el refresh token (el viejo se invalida)
 * - Retorna nuevo par de tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
// Importaciones directas para evitar problemas de exportación circular
import {
  verifyRefreshToken,
  rotateRefreshToken,
  generateAccessToken,
  getAuthCookies,
  setAuthCookies,
  clearAuthCookies,
} from '@/lib/auth/tokens';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { isSessionActive, updateSessionActivity } from '@/lib/auth/sessions';
import { isBlacklisted } from '@/lib/auth/blacklist';
import { getClientIdentifier, checkRateLimit, incrementRateLimit } from '@/lib/auth/rate-limit';

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET no está definido o es demasiado corto.');
  }
  return new TextEncoder().encode(secret);
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP (5 req/min for auth endpoints)
    const clientIp = getClientIdentifier(request);
    const rl = await checkRateLimit(clientIp, 'login');
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rl.retryAfter ?? 60),
          },
        }
      );
    }
    await incrementRateLimit(clientIp, 'login');

    // Obtener refresh token de cookies
    const { refreshToken } = getAuthCookies();

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token provided' },
        { status: 401 }
      );
    }

    // Verificar si está en blacklist
    if (await isBlacklisted(refreshToken)) {
      clearAuthCookies();
      return NextResponse.json(
        { error: 'Token has been revoked' },
        { status: 401 }
      );
    }

    // Verificar refresh token
    const verification = await verifyRefreshToken(refreshToken);

    if (!verification.valid || !verification.userId || !verification.sessionId) {
      clearAuthCookies();
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    const { userId, sessionId } = verification;

    // Verificar que la sesión esté activa
    if (!(await isSessionActive(sessionId))) {
      clearAuthCookies();
      return NextResponse.json(
        { error: 'Session has been revoked' },
        { status: 401 }
      );
    }

    // Obtener datos del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        companies: {
          take: 1,
          select: {
            company: { select: { id: true } },
            role: { select: { name: true } },
          },
        },
        ownedCompanies: {
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!user || !user.isActive) {
      clearAuthCookies();
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
      );
    }

    // Determinar companyId y rol
    let companyId: number | undefined;
    let userRole = user.role;

    if (user.ownedCompanies && user.ownedCompanies.length > 0) {
      companyId = user.ownedCompanies[0].id;
    } else if (user.companies && user.companies.length > 0) {
      companyId = user.companies[0].company.id;
      if (user.companies[0].role) {
        userRole = user.companies[0].role.name as any;
      }
    }

    // Rotar refresh token
    const rotationResult = await rotateRefreshToken(refreshToken, userId, sessionId);

    if (!rotationResult) {
      clearAuthCookies();
      return NextResponse.json(
        { error: 'Failed to rotate token' },
        { status: 401 }
      );
    }

    // Generar nuevo access token
    const newAccessToken = await generateAccessToken(
      userId,
      user.email,
      userRole,
      sessionId,
      companyId
    );

    // Actualizar actividad de sesión
    await updateSessionActivity(sessionId);

    // Establecer nuevas cookies
    const accessTokenExpires = new Date(Date.now() + AUTH_CONFIG.accessToken.expiresInMs);

    setAuthCookies({
      accessToken: newAccessToken,
      refreshToken: rotationResult.newRefreshToken,
      accessTokenExpires,
      refreshTokenExpires: rotationResult.expiresAt,
    });

    // Regenerar cookie legacy para backward-compatibility con middleware
    const legacyToken = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: userRole,
      companyId: companyId || null,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(getJwtSecretKey());

    cookies().set('token', legacyToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24h
    });

    return NextResponse.json({
      success: true,
      expiresAt: accessTokenExpires.toISOString(),
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
