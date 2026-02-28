/**
 * Configuración de Seguridad Avanzada
 *
 * Este archivo centraliza toda la configuración del sistema de autenticación
 */

export const AUTH_CONFIG = {
  // Access Token (JWT corto)
  accessToken: {
    expiresIn: '15m',           // 15 minutos
    expiresInMs: 15 * 60 * 1000,
    cookieName: 'accessToken',
  },

  // Refresh Token (largo, rotativo)
  refreshToken: {
    expiresIn: '1d',            // 1 día
    expiresInMs: 24 * 60 * 60 * 1000,
    cookieName: 'refreshToken',
  },

  // Sesiones
  session: {
    maxPerUser: 5,              // Máximo 5 sesiones simultáneas
    inactivityTimeout: 24 * 60 * 60 * 1000, // 1 día sin actividad
  },

  // 2FA
  twoFactor: {
    required: false,            // Opcional para todos
    issuer: 'ORVIT',            // Nombre que aparece en la app de autenticación
    trustedDeviceDays: 30,      // Días que un dispositivo confiable puede skip 2FA
    backupCodesCount: 10,       // Cantidad de códigos de respaldo
    codeWindow: 1,              // Ventana de tiempo para códigos (1 = 30 segundos antes/después)
  },

  // Rate Limiting
  rateLimit: {
    storage: 'postgresql' as const, // Usar PostgreSQL (Neon)
    cacheTTL: 60 * 1000,        // Cache en memoria por 1 minuto

    // Límites por acción
    login: {
      window: 60,               // 1 minuto
      max: 5,                   // 5 intentos por IP por minuto
      blockDuration: 15 * 60,   // Bloquear IP por 15 minutos
    },
    // Rate limit por email (prevenir ataque distribuido a una cuenta)
    loginByEmail: {
      window: 5 * 60,           // 5 minutos
      max: 10,                  // 10 intentos por email
      blockDuration: 15 * 60,   // Bloquear email por 15 minutos
    },
    '2fa': {
      window: 15 * 60,
      max: 5,
      blockDuration: 30 * 60,
    },
    api: {
      window: 60,               // 1 minuto
      max: 100,                 // 100 requests
    },
    passwordReset: {
      window: 60 * 60,          // 1 hora
      max: 3,                   // 3 intentos
      blockDuration: 60 * 60,   // Bloquear 1 hora
    },
  },

  // Blacklist de tokens
  blacklist: {
    cacheTTL: 5 * 60 * 1000,    // Cache en memoria por 5 minutos
    cleanupInterval: 60 * 60 * 1000, // Limpiar tokens expirados cada hora
  },

  // Cookies
  cookies: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  },

  // Compatibilidad con sistema anterior
  legacy: {
    // Aceptar token viejo durante transición
    acceptLegacyToken: true,
    legacyCookieName: 'token',
  },
} as const;

// Tipos para TypeScript
export type RateLimitAction = keyof typeof AUTH_CONFIG.rateLimit & string;
export type SecurityEventType =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'password_change'
  | '2fa_enabled'
  | '2fa_disabled'
  | 'session_revoked'
  | 'session_revoked_all'
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'token_refresh'
  | 'new_device';

export type SecurityEventSeverity = 'info' | 'warning' | 'critical';
