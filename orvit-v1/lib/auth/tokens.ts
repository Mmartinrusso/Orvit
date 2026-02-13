/**
 * Sistema de Tokens (Access + Refresh)
 *
 * - Access Token: JWT corto (15 min), contiene datos del usuario
 * - Refresh Token: Token largo (7 días), solo para renovar access token
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { AUTH_CONFIG } from './config';
import { createHash, randomBytes } from 'crypto';

// Secret para JWT (usar variable de entorno en producción)
const JWT_SECRET = process.env.JWT_SECRET || 'Messi';
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// ============================================================================
// TIPOS
// ============================================================================

export interface AccessTokenPayload {
  userId: number;
  email: string;
  role: string;
  companyId?: number;
  sessionId: string;
  requires2FA?: boolean;
}

export interface RefreshTokenPayload {
  userId: number;
  sessionId: string;
  tokenId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: Date;
  refreshTokenExpires: Date;
}

// ============================================================================
// GENERACIÓN DE TOKENS
// ============================================================================

/**
 * Genera un nuevo par de tokens (access + refresh)
 */
export async function generateTokenPair(
  userId: number,
  email: string,
  role: string,
  sessionId: string,
  companyId?: number,
  requires2FA: boolean = false
): Promise<TokenPair> {
  const now = new Date();
  const accessTokenExpires = new Date(now.getTime() + AUTH_CONFIG.accessToken.expiresInMs);
  const refreshTokenExpires = new Date(now.getTime() + AUTH_CONFIG.refreshToken.expiresInMs);

  // Generar Access Token (JWT)
  const accessToken = await new SignJWT({
    userId,
    email,
    role,
    companyId,
    sessionId,
    requires2FA,
  } satisfies AccessTokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(AUTH_CONFIG.accessToken.expiresIn)
    .sign(JWT_SECRET_KEY);

  // Generar Refresh Token (token opaco + almacenar en BD)
  const refreshTokenId = randomBytes(32).toString('hex');
  const refreshTokenValue = randomBytes(64).toString('hex');
  const refreshTokenHash = hashToken(refreshTokenValue);

  // Guardar refresh token en BD
  await prisma.refreshToken.create({
    data: {
      id: refreshTokenId,
      token: refreshTokenHash,
      userId,
      sessionId,
      expiresAt: refreshTokenExpires,
    },
  });

  // El refresh token que enviamos al cliente incluye el ID y el valor
  const refreshToken = `${refreshTokenId}.${refreshTokenValue}`;

  return {
    accessToken,
    refreshToken,
    accessTokenExpires,
    refreshTokenExpires,
  };
}

/**
 * Genera solo un nuevo access token (cuando el refresh es válido)
 */
export async function generateAccessToken(
  userId: number,
  email: string,
  role: string,
  sessionId: string,
  companyId?: number
): Promise<string> {
  return await new SignJWT({
    userId,
    email,
    role,
    companyId,
    sessionId,
    requires2FA: false,
  } satisfies AccessTokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(AUTH_CONFIG.accessToken.expiresIn)
    .sign(JWT_SECRET_KEY);
}

// ============================================================================
// VERIFICACIÓN DE TOKENS
// ============================================================================

/**
 * Verifica un access token y retorna el payload
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Verifica un refresh token y retorna los datos
 */
export async function verifyRefreshToken(
  refreshToken: string
): Promise<{ valid: boolean; userId?: number; sessionId?: string; tokenId?: string }> {
  try {
    // El refresh token tiene formato: tokenId.tokenValue
    const [tokenId, tokenValue] = refreshToken.split('.');
    if (!tokenId || !tokenValue) {
      return { valid: false };
    }

    const tokenHash = hashToken(tokenValue);

    // Buscar en BD
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        id: tokenId,
        token: tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedToken) {
      return { valid: false };
    }

    return {
      valid: true,
      userId: storedToken.userId,
      sessionId: storedToken.sessionId,
      tokenId: storedToken.id,
    };
  } catch {
    return { valid: false };
  }
}

// ============================================================================
// ROTACIÓN DE TOKENS
// ============================================================================

/**
 * Rota el refresh token (invalida el anterior, genera uno nuevo)
 */
export async function rotateRefreshToken(
  oldRefreshToken: string,
  userId: number,
  sessionId: string
): Promise<{ newRefreshToken: string; expiresAt: Date } | null> {
  const [oldTokenId, oldTokenValue] = oldRefreshToken.split('.');
  if (!oldTokenId || !oldTokenValue) {
    return null;
  }

  const oldTokenHash = hashToken(oldTokenValue);

  // Verificar y revocar el token viejo
  const oldToken = await prisma.refreshToken.findFirst({
    where: {
      id: oldTokenId,
      token: oldTokenHash,
      revokedAt: null,
    },
  });

  if (!oldToken) {
    return null;
  }

  // Generar nuevo refresh token
  const newTokenId = randomBytes(32).toString('hex');
  const newTokenValue = randomBytes(64).toString('hex');
  const newTokenHash = hashToken(newTokenValue);
  const expiresAt = new Date(Date.now() + AUTH_CONFIG.refreshToken.expiresInMs);

  // Transacción: revocar viejo + crear nuevo
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: oldTokenId },
      data: {
        revokedAt: new Date(),
        replacedBy: newTokenId,
      },
    }),
    prisma.refreshToken.create({
      data: {
        id: newTokenId,
        token: newTokenHash,
        userId,
        sessionId,
        expiresAt,
      },
    }),
  ]);

  return {
    newRefreshToken: `${newTokenId}.${newTokenValue}`,
    expiresAt,
  };
}

// ============================================================================
// COOKIES
// ============================================================================

/**
 * Establece las cookies de autenticación
 */
export function setAuthCookies(tokens: TokenPair): void {
  const cookieStore = cookies();

  // Access Token cookie
  cookieStore.set(AUTH_CONFIG.accessToken.cookieName, tokens.accessToken, {
    ...AUTH_CONFIG.cookies,
    maxAge: Math.floor(AUTH_CONFIG.accessToken.expiresInMs / 1000),
  });

  // Refresh Token cookie
  cookieStore.set(AUTH_CONFIG.refreshToken.cookieName, tokens.refreshToken, {
    ...AUTH_CONFIG.cookies,
    maxAge: Math.floor(AUTH_CONFIG.refreshToken.expiresInMs / 1000),
  });
}

/**
 * Obtiene los tokens de las cookies
 */
export function getAuthCookies(): { accessToken?: string; refreshToken?: string; legacyToken?: string } {
  const cookieStore = cookies();

  return {
    accessToken: cookieStore.get(AUTH_CONFIG.accessToken.cookieName)?.value,
    refreshToken: cookieStore.get(AUTH_CONFIG.refreshToken.cookieName)?.value,
    legacyToken: AUTH_CONFIG.legacy.acceptLegacyToken
      ? cookieStore.get(AUTH_CONFIG.legacy.legacyCookieName)?.value
      : undefined,
  };
}

/**
 * Limpia las cookies de autenticación
 */
export function clearAuthCookies(): void {
  const cookieStore = cookies();

  cookieStore.delete(AUTH_CONFIG.accessToken.cookieName);
  cookieStore.delete(AUTH_CONFIG.refreshToken.cookieName);

  // También limpiar cookie legacy si existe
  if (AUTH_CONFIG.legacy.acceptLegacyToken) {
    cookieStore.delete(AUTH_CONFIG.legacy.legacyCookieName);
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Hash de token para almacenar en BD (no guardar tokens en texto plano)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Revoca todos los refresh tokens de un usuario
 */
export async function revokeAllUserTokens(userId: number, reason?: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

/**
 * Revoca todos los refresh tokens de una sesión específica
 */
export async function revokeSessionTokens(sessionId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      sessionId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

/**
 * Limpia tokens expirados de la BD (para cron job)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } },
      ],
    },
  });

  return result.count;
}
