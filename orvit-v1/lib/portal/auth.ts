/**
 * Portal del Cliente - Auth Library
 *
 * Funciones de autenticación para el portal de clientes:
 * - Hash de passwords (bcrypt)
 * - Verificación de passwords
 * - Generación de tokens de sesión
 * - Validación de tokens
 */

import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// =====================================================
// CONFIGURACIÓN
// =====================================================

const SALT_ROUNDS = 12;
const SESSION_TOKEN_BYTES = 32;
const INVITE_TOKEN_BYTES = 32;
const SESSION_COOKIE_NAME = 'portal_session';

// =====================================================
// PASSWORD UTILITIES
// =====================================================

/**
 * Hash de password con bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verificar password contra hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Re-exportar validación centralizada de contraseñas
export { validatePasswordPolicy } from '@/lib/password-validation';

// =====================================================
// TOKEN UTILITIES
// =====================================================

/**
 * Generar token de sesión (raw)
 */
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('hex');
}

/**
 * Generar token de invitación
 */
export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('hex');
}

/**
 * Hash de token (para almacenar en DB)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// =====================================================
// SESSION MANAGEMENT
// =====================================================

export interface PortalUserSession {
  id: string;
  portalUserId: string;
  clientId: string;
  companyId: number;
  email: string;
  contact: {
    firstName: string;
    lastName: string;
    position: string | null;
  };
  client: {
    id: string;
    name: string | null;
    legalName: string;
  };
  company: {
    id: number;
    name: string;
    logo: string | null;
  };
  permissions: {
    canViewPrices: boolean;
    canViewQuotes: boolean;
    canAcceptQuotes: boolean;
    canCreateOrders: boolean;
    canViewHistory: boolean;
    canViewDocuments: boolean;
  };
  limits: {
    maxOrderAmount: number | null;
    requiresApprovalAbove: number | null;
  };
}

/**
 * Crear sesión para usuario del portal
 */
export async function createPortalSession(
  portalUserId: string,
  companyId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date }> {
  // Obtener configuración de sesión
  const config = await prisma.salesConfig.findUnique({
    where: { companyId },
    select: { portalSessionDays: true },
  });

  const sessionDays = config?.portalSessionDays || 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + sessionDays);

  // Generar token
  const token = generateSessionToken();
  const tokenHash = hashToken(token);

  // Crear sesión en DB
  await prisma.clientPortalSession.create({
    data: {
      portalUserId,
      companyId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  return { token, expiresAt };
}

/**
 * Obtener sesión desde token
 */
export async function getSessionFromToken(
  token: string
): Promise<PortalUserSession | null> {
  const tokenHash = hashToken(token);

  const session = await prisma.clientPortalSession.findUnique({
    where: { tokenHash },
    include: {
      portalUser: {
        include: {
          contact: true,
          client: {
            select: {
              id: true,
              name: true,
              legalName: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (!session.isActive) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.portalUser.isActive) return null;

  // Actualizar última actividad
  await prisma.clientPortalSession.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  });

  const user = session.portalUser;

  return {
    id: session.id,
    portalUserId: user.id,
    clientId: user.clientId,
    companyId: user.companyId,
    email: user.email,
    contact: {
      firstName: user.contact.firstName,
      lastName: user.contact.lastName,
      position: user.contact.position,
    },
    client: {
      id: user.client.id,
      name: user.client.name,
      legalName: user.client.legalName,
    },
    company: {
      id: user.company.id,
      name: user.company.name,
      logo: user.company.logo,
    },
    permissions: {
      canViewPrices: user.canViewPrices,
      canViewQuotes: user.canViewQuotes,
      canAcceptQuotes: user.canAcceptQuotes,
      canCreateOrders: user.canCreateOrders,
      canViewHistory: user.canViewHistory,
      canViewDocuments: user.canViewDocuments,
    },
    limits: {
      maxOrderAmount: user.maxOrderAmount ? Number(user.maxOrderAmount) : null,
      requiresApprovalAbove: user.requiresApprovalAbove
        ? Number(user.requiresApprovalAbove)
        : null,
    },
  };
}

/**
 * Obtener sesión actual desde cookies
 */
export async function getCurrentPortalSession(): Promise<PortalUserSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  return getSessionFromToken(token);
}

/**
 * Invalidar sesión
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.clientPortalSession.update({
    where: { id: sessionId },
    data: { isActive: false },
  });
}

/**
 * Invalidar todas las sesiones de un usuario
 */
export async function invalidateAllUserSessions(
  portalUserId: string
): Promise<void> {
  await prisma.clientPortalSession.updateMany({
    where: { portalUserId },
    data: { isActive: false },
  });
}

/**
 * Limpiar sesiones expiradas (para cron)
 */
export async function cleanExpiredSessions(): Promise<number> {
  const result = await prisma.clientPortalSession.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { isActive: false }],
    },
  });

  return result.count;
}

// =====================================================
// LOGIN / LOGOUT
// =====================================================

export interface LoginResult {
  success: boolean;
  error?: string;
  token?: string;
  expiresAt?: Date;
  user?: PortalUserSession;
}

/**
 * Login de usuario del portal
 */
export async function loginPortalUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LoginResult> {
  // Buscar usuario por email (puede haber varios en diferentes empresas)
  const user = await prisma.clientPortalUser.findFirst({
    where: {
      email: email.toLowerCase().trim(),
      isActive: true,
    },
    include: {
      contact: true,
      client: {
        select: { id: true, name: true, legalName: true },
      },
      company: {
        select: { id: true, name: true, logo: true },
      },
    },
  });

  if (!user) {
    return { success: false, error: 'Credenciales inválidas' };
  }

  // Verificar si está bloqueado
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000
    );
    return {
      success: false,
      error: `Cuenta bloqueada. Intente en ${minutesLeft} minutos`,
    };
  }

  // Verificar si está activado
  if (!user.isVerified) {
    return {
      success: false,
      error: 'Cuenta no activada. Revise su email para activarla',
    };
  }

  // Verificar password
  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid) {
    // Incrementar intentos fallidos
    const newAttempts = user.failedLoginAttempts + 1;
    const updateData: any = { failedLoginAttempts: newAttempts };

    // Bloquear después de 5 intentos (15 minutos)
    if (newAttempts >= 5) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 15);
      updateData.lockedUntil = lockUntil;
    }

    await prisma.clientPortalUser.update({
      where: { id: user.id },
      data: updateData,
    });

    return { success: false, error: 'Credenciales inválidas' };
  }

  // Login exitoso - resetear intentos y actualizar último login
  await prisma.clientPortalUser.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  });

  // Crear sesión
  const { token, expiresAt } = await createPortalSession(
    user.id,
    user.companyId,
    ipAddress,
    userAgent
  );

  // Log de actividad
  await prisma.clientPortalActivity.create({
    data: {
      portalUserId: user.id,
      clientId: user.clientId,
      companyId: user.companyId,
      action: 'LOGIN',
      ipAddress,
      userAgent,
    },
  });

  return {
    success: true,
    token,
    expiresAt,
    user: {
      id: '', // Se llenará con la sesión
      portalUserId: user.id,
      clientId: user.clientId,
      companyId: user.companyId,
      email: user.email,
      contact: {
        firstName: user.contact.firstName,
        lastName: user.contact.lastName,
        position: user.contact.position,
      },
      client: {
        id: user.client.id,
        name: user.client.name,
        legalName: user.client.legalName,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        logo: user.company.logo,
      },
      permissions: {
        canViewPrices: user.canViewPrices,
        canViewQuotes: user.canViewQuotes,
        canAcceptQuotes: user.canAcceptQuotes,
        canCreateOrders: user.canCreateOrders,
        canViewHistory: user.canViewHistory,
        canViewDocuments: user.canViewDocuments,
      },
      limits: {
        maxOrderAmount: user.maxOrderAmount ? Number(user.maxOrderAmount) : null,
        requiresApprovalAbove: user.requiresApprovalAbove
          ? Number(user.requiresApprovalAbove)
          : null,
      },
    },
  };
}

/**
 * Logout de usuario del portal
 */
export async function logoutPortalUser(
  sessionId: string,
  portalUserId: string,
  clientId: string,
  companyId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  // Invalidar sesión
  await invalidateSession(sessionId);

  // Log de actividad
  await prisma.clientPortalActivity.create({
    data: {
      portalUserId,
      clientId,
      companyId,
      action: 'LOGOUT',
      ipAddress,
      userAgent,
    },
  });
}

// =====================================================
// COOKIES
// =====================================================

export const SESSION_COOKIE_OPTIONS = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/', // Incluye /portal/* y /api/portal/*
};

/**
 * Crear cookie de sesión (devuelve objeto para Response)
 */
export function getSessionCookieValue(token: string, expiresAt: Date): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; ${
    process.env.NODE_ENV === 'production' ? 'Secure; ' : ''
  }SameSite=Strict; Expires=${expiresAt.toUTCString()}`;
}

/**
 * Crear cookie para eliminar sesión
 */
export function getLogoutCookieValue(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; ${
    process.env.NODE_ENV === 'production' ? 'Secure; ' : ''
  }SameSite=Strict; Max-Age=0`;
}

// =====================================================
// RATE LIMITING (Simple in-memory)
// =====================================================

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutos
const RATE_LIMIT_MAX = 10; // 10 intentos por IP

/**
 * Verificar rate limit por IP
 */
export function checkRateLimit(ip: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  // Bypass en desarrollo
  if (process.env.NODE_ENV !== 'production') {
    return { allowed: true };
  }

  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  // Limpiar si pasó la ventana
  if (now - record.lastAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  // Verificar límite
  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil(
      (RATE_LIMIT_WINDOW - (now - record.lastAttempt)) / 1000
    );
    return { allowed: false, retryAfter };
  }

  // Incrementar contador
  record.count++;
  record.lastAttempt = now;
  return { allowed: true };
}

/**
 * Limpiar rate limits expirados (para cron)
 */
export function cleanExpiredRateLimits(): void {
  const now = Date.now();
  const entries = Array.from(loginAttempts.entries());
  for (const [ip, record] of entries) {
    if (now - record.lastAttempt > RATE_LIMIT_WINDOW) {
      loginAttempts.delete(ip);
    }
  }
}
