/**
 * POST /api/auth/login
 *
 * Sistema de Login con Seguridad Avanzada:
 * - Rate limiting por IP (5 intentos/min, bloqueo 15 min)
 * - Rate limiting por email (10 intentos/5min, bloqueo 15 min) - previene ataques distribuidos
 * - Logging de intentos fallidos para detección de ataques
 * - Registro de intentos de login en BD
 * - Sesiones multi-dispositivo
 * - Access + Refresh tokens
 * - Compatibilidad con sistema anterior
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { loggers } from '@/lib/logger';
import { getUserPermissions } from '@/lib/permissions-helpers';
import { SignJWT } from 'jose';
import { trackCount } from '@/lib/metrics';

// Importaciones directas para evitar problemas de exportación circular
import { generateTokenPair, setAuthCookies } from '@/lib/auth/tokens';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { createSession, DeviceInfo } from '@/lib/auth/sessions';
import {
  checkRateLimit,
  incrementRateLimit,
  resetRateLimit,
  getClientIdentifier,
} from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET no está definido o es demasiado corto. ' +
      'Debe tener al menos 32 caracteres.'
    );
  }
  return new TextEncoder().encode(secret);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extrae información del dispositivo del request
 */
function extractDeviceInfo(request: NextRequest): DeviceInfo {
  const userAgent = request.headers.get('user-agent') || '';

  // Parseo simple del User-Agent
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';

  // Detectar browser
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  // Detectar OS
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  // Detectar tipo de dispositivo
  if (userAgent.includes('Mobile')) deviceType = 'mobile';
  else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) deviceType = 'tablet';

  return {
    deviceName: `${browser} en ${os}`,
    deviceType,
    browser,
    os,
    ipAddress: getClientIdentifier(request),
    userAgent,
  };
}

/**
 * Registra un intento de login
 */
async function logLoginAttempt(
  email: string,
  ipAddress: string,
  userAgent: string | null,
  success: boolean,
  failReason?: string,
  userId?: number
): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        email,
        ipAddress,
        userAgent,
        success,
        failReason,
        userId,
      },
    });
  } catch (error) {
    loggers.auth.error({ err: error }, 'Error logging login attempt');
  }
}

// ============================================================================
// ENDPOINT
// ============================================================================

export async function POST(request: NextRequest) {
  const ipAddress = getClientIdentifier(request);
  const userAgent = request.headers.get('user-agent');

  try {
    const body = await request.json();
    const identifier = (body.email || '').trim();

    // Validaciones básicas
    if (!identifier || !body.password) {
      return NextResponse.json(
        { error: 'Usuario/email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // ====== RATE LIMITING POR IP ======
    const rateLimitResult = await checkRateLimit(ipAddress, 'login');

    if (!rateLimitResult.allowed) {
      loggers.auth.warn(
        { ip: ipAddress, email: identifier, action: 'rate_limit_ip' },
        `Rate limit por IP excedido: ${ipAddress} bloqueado hasta ${rateLimitResult.blockedUntil?.toISOString()}`
      );
      await logLoginAttempt(identifier, ipAddress, userAgent, false, 'rate_limited_ip');

      return NextResponse.json(
        {
          error: 'Demasiados intentos de inicio de sesión. Intentá de nuevo más tarde.',
          retryAfter: rateLimitResult.retryAfter,
          blockedUntil: rateLimitResult.blockedUntil?.toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
          },
        }
      );
    }

    // ====== RATE LIMITING POR EMAIL (prevenir ataque distribuido a una cuenta) ======
    const emailNormalized = identifier.toLowerCase();
    const emailRateLimitResult = await checkRateLimit(emailNormalized, 'loginByEmail');

    if (!emailRateLimitResult.allowed) {
      loggers.auth.warn(
        { ip: ipAddress, email: identifier, action: 'rate_limit_email' },
        `Rate limit por email excedido: cuenta ${identifier} bloqueada hasta ${emailRateLimitResult.blockedUntil?.toISOString()}`
      );
      await logLoginAttempt(identifier, ipAddress, userAgent, false, 'rate_limited_email');

      return NextResponse.json(
        {
          error: 'Demasiados intentos de inicio de sesión para esta cuenta. Intentá de nuevo más tarde.',
          retryAfter: emailRateLimitResult.retryAfter,
          blockedUntil: emailRateLimitResult.blockedUntil?.toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(emailRateLimitResult.retryAfter || 60),
          },
        }
      );
    }

    // Buscar usuario
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { name: identifier }],
      },
      include: {
        companies: {
          include: {
            company: true,
            role: true,
          },
        },
        ownedCompanies: true,
        twoFactor: true, // Para verificar si tiene 2FA habilitado
      },
    });

    if (!user) {
      await incrementRateLimit(ipAddress, 'login');
      await incrementRateLimit(emailNormalized, 'loginByEmail');
      await logLoginAttempt(identifier, ipAddress, userAgent, false, 'user_not_found');
      loggers.auth.warn({ ip: ipAddress, email: identifier, reason: 'user_not_found' }, 'Login fallido: usuario no encontrado');

      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      await incrementRateLimit(ipAddress, 'login');
      await incrementRateLimit(emailNormalized, 'loginByEmail');
      await logLoginAttempt(identifier, ipAddress, userAgent, false, 'inactive', user.id);
      loggers.auth.warn({ ip: ipAddress, email: identifier, userId: user.id, reason: 'inactive' }, 'Login fallido: usuario inactivo');

      return NextResponse.json({ error: 'Usuario inactivo' }, { status: 401 });
    }

    // Verificar contraseña
    if (!user.password) {
      await incrementRateLimit(ipAddress, 'login');
      await incrementRateLimit(emailNormalized, 'loginByEmail');
      await logLoginAttempt(identifier, ipAddress, userAgent, false, 'no_password', user.id);
      loggers.auth.warn({ ip: ipAddress, email: identifier, userId: user.id, reason: 'no_password' }, 'Login fallido: sin contraseña configurada');

      return NextResponse.json({ error: 'Usuario sin contraseña configurada' }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(body.password, user.password);

    if (!isValidPassword) {
      await incrementRateLimit(ipAddress, 'login');
      await incrementRateLimit(emailNormalized, 'loginByEmail');
      await logLoginAttempt(identifier, ipAddress, userAgent, false, 'invalid_password', user.id);
      loggers.auth.warn({ ip: ipAddress, email: identifier, userId: user.id, reason: 'invalid_password' }, 'Login fallido: contraseña inválida');

      // Métrica: failed_logins (fire-and-forget, usa primera empresa del usuario)
      const failedCompanyId = user.companies?.[0]?.company?.id;
      if (failedCompanyId) {
        trackCount('failed_logins', failedCompanyId, {
          tags: { reason: 'invalid_password' },
          userId: user.id,
        }).catch(() => {});
      }

      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // ====== LOGIN EXITOSO ======

    // Resetear rate limits después de login exitoso (IP + email)
    await resetRateLimit(ipAddress, 'login');
    await resetRateLimit(emailNormalized, 'loginByEmail');

    // Actualizar último acceso
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Obtener companyId y rol
    let companyId: number | undefined;
    let userRoleInCompany: string = user.role || 'USER';
    let userSectorId: number | null = null;

    if (user.ownedCompanies && user.ownedCompanies.length > 0) {
      companyId = user.ownedCompanies[0].id;
    } else if (user.companies && user.companies.length > 0) {
      const userOnCompany = user.companies[0];
      companyId = userOnCompany.company.id;
      if (userOnCompany.role) {
        userRoleInCompany = userOnCompany.role.name;
        if (userOnCompany.role.sectorId) {
          userSectorId = userOnCompany.role.sectorId;
        }
      }
    }

    // Verificar si tiene 2FA habilitado
    const has2FA = user.twoFactor?.isEnabled ?? false;

    // Crear sesión
    const deviceInfo = extractDeviceInfo(request);
    const sessionId = await createSession(user.id, deviceInfo);

    // Generar tokens
    const tokens = await generateTokenPair(
      user.id,
      user.email,
      userRoleInCompany,
      sessionId,
      companyId,
      has2FA // requires2FA - si tiene 2FA, el access token indica que falta verificar
    );

    // Establecer cookies de nuevo sistema
    setAuthCookies(tokens);

    // ====== COMPATIBILIDAD CON SISTEMA ANTERIOR ======
    // También establecer la cookie legacy para componentes que aún la usen
    const legacyToken = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: userRoleInCompany,  // Usar rol en la empresa, no el rol global
      companyId: companyId || null,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(getJwtSecretKey());

    cookies().set('token', legacyToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
    });

    // Registrar login exitoso
    await logLoginAttempt(identifier, ipAddress, userAgent, true, undefined, user.id);

    // Métrica: successful_logins (fire-and-forget)
    if (companyId) {
      trackCount('successful_logins', companyId, {
        userId: user.id,
      }).catch(() => {});
    }

    // Obtener permisos
    const permissions = await getUserPermissions(
      user.id,
      userRoleInCompany,
      companyId || 1
    );

    loggers.auth.info({ userId: user.id, email: user.email, sessionId, role: userRoleInCompany, has2FA }, 'Login successful');

    // Respuesta
    const { password, twoFactor, ...userWithoutSensitive } = user;

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: userRoleInCompany,
        systemRole: user.role,
        sectorId: userSectorId,
        avatar: user.avatar,
        permissions,
      },
      hasCompany: !!companyId,
      sessionId,
      requires2FA: has2FA,
      expiresAt: tokens.accessTokenExpires.toISOString(),
    });
  } catch (error) {
    console.error('[LOGIN] Error:', error);
    loggers.auth.error({ err: error }, 'Login error');
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
  }
}
