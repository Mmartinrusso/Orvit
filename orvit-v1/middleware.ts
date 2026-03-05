import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

// Codificar el secret para jose
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// CORS: origins permitidos para la app móvil
const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:19006',
  'https://orvit.app',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// Config constants (obfuscated for security)
const VM_COOKIE_NAME = '_vm';
const VM_MODE_STANDARD = 'S';
const VM_MODE_EXTENDED = 'E';
const VM_HEADER_NAME = 'X-Prf';  // Obfuscated header name
const VM_ENCODED = { S: 'p3q8n', E: 'x7k2m' };  // Encoded values

// Routes that ALWAYS use Standard mode (fiscal/regulatory reports)
const ALWAYS_STANDARD_ROUTES = [
  '/api/arca',
  '/api/compras/reportes/libro-iva',
  '/api/compras/reportes/iva-compras',
  '/api/compras/reportes/iva-ventas',
  '/api/compras/reportes/percepciones',
  '/api/compras/reportes/retenciones',
  '/api/compras/exportar/afip',
  '/api/compras/exportar/citi',
  '/api/compras/exportar/contable',
  '/api/compras/exportar/asientos',
  '/api/ventas/reportes/libro-iva',
  '/api/ventas/reportes/facturacion',
  '/api/ventas/exportar/afip',
];

/**
 * Check if route should always use Standard mode
 */
function isProtectedRoute(pathname: string): boolean {
  const normalizedPath = pathname.toLowerCase();
  return ALWAYS_STANDARD_ROUTES.some(route =>
    normalizedPath === route || normalizedPath.startsWith(route + '/')
  );
}

/**
 * Verify ViewMode cookie and extract mode
 * Returns 'S' (Standard) if invalid or expired
 */
async function getViewModeFromCookie(
  request: NextRequest,
  authPayload: { userId?: number; companyId?: number } | null
): Promise<'S' | 'E'> {
  try {
    const vmToken = request.cookies.get(VM_COOKIE_NAME)?.value;
    if (!vmToken) return VM_MODE_STANDARD;

    const { payload } = await jwtVerify(vmToken, JWT_SECRET_KEY);
    const vmPayload = payload as { m?: string; u?: number; c?: number; x?: number };

    // Verify required fields
    if (!vmPayload.m || !vmPayload.u || !vmPayload.c || !vmPayload.x) {
      return VM_MODE_STANDARD;
    }

    // Verify not expired
    const now = Math.floor(Date.now() / 1000);
    if (vmPayload.x < now) {
      return VM_MODE_STANDARD;
    }

    // Verify user/company match with auth token
    if (authPayload) {
      if (vmPayload.u !== authPayload.userId || vmPayload.c !== authPayload.companyId) {
        return VM_MODE_STANDARD;
      }
    }

    // Verify mode is valid
    if (vmPayload.m !== VM_MODE_STANDARD && vmPayload.m !== VM_MODE_EXTENDED) {
      return VM_MODE_STANDARD;
    }

    return vmPayload.m as 'S' | 'E';
  } catch {
    return VM_MODE_STANDARD;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const origin = request.headers.get('origin');

  // CORS: responder preflight OPTIONS sin pasar por auth
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  // Leer token: Bearer header (mobile) → cookie accessToken → cookie token (legacy)
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const accessToken = request.cookies.get('accessToken')?.value;
  const legacyToken = request.cookies.get('token')?.value;
  const token = bearerToken || accessToken || legacyToken;

  // Helper: intentar refresh inline antes de redirigir a /login
  // Para API routes: devolver 401 JSON (no redirect, para evitar CORS issues)
  // Para páginas: intentar refresh, si falla redirigir a /login
  const tryRefreshOrLogin = async (): Promise<NextResponse> => {
    // API routes: nunca redirigir, devolver 401
    if (pathname.startsWith('/api/')) {
      return addCors(NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      ));
    }

    const refreshCookie = request.cookies.get('refreshToken')?.value;
    if (refreshCookie) {
      try {
        const refreshRes = await fetch(new URL('/api/auth/refresh', request.url), {
          method: 'POST',
          headers: { Cookie: request.headers.get('cookie') || '' },
        });
        if (refreshRes.ok) {
          const response = NextResponse.redirect(request.url);
          for (const cookie of refreshRes.headers.getSetCookie()) {
            response.headers.append('Set-Cookie', cookie);
          }
          return response;
        }
      } catch {
        // Refresh falló, continuar al redirect a /login
      }
    }
    return NextResponse.redirect(new URL('/login', request.url));
  };

  // Helper to create response with ViewMode header injected
  const createResponseWithViewMode = async (
    response: NextResponse,
    authPayload: { userId?: number; companyId?: number } | null
  ): Promise<NextResponse> => {
    // Only inject for API routes
    if (!pathname.startsWith('/api/')) {
      return response;
    }

    // Check if route is protected (fiscal reports) - always use Standard
    if (isProtectedRoute(pathname)) {
      response.headers.set(VM_HEADER_NAME, VM_ENCODED.S);
      return response;
    }

    // Get mode from cookie
    const mode = await getViewModeFromCookie(request, authPayload);
    response.headers.set(VM_HEADER_NAME, VM_ENCODED[mode]);
    return response;
  };

  // Helper: add CORS headers to a response
  const addCors = (response: NextResponse): NextResponse => {
    if (pathname.startsWith('/api/') && origin) {
      const corsHeaders = getCorsHeaders(origin);
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
    }
    return response;
  };

  // Helper to create next response with ViewMode header
  const nextWithViewMode = async (
    authPayload: { userId?: number; companyId?: number } | null = null
  ): Promise<NextResponse> => {
    // For API routes, we need to forward the header
    if (pathname.startsWith('/api/')) {
      // Check if route is protected (fiscal reports)
      if (isProtectedRoute(pathname)) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set(VM_HEADER_NAME, VM_ENCODED.S);
        return addCors(NextResponse.next({
          request: { headers: requestHeaders },
        }));
      }

      // Get mode from cookie
      const mode = await getViewModeFromCookie(request, authPayload);
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(VM_HEADER_NAME, VM_ENCODED[mode]);
      return addCors(NextResponse.next({
        request: { headers: requestHeaders },
      }));
    }

    return NextResponse.next();
  };

  // 🔒 PROTECCIÓN: Rutas de debug/test solo permitidas en desarrollo o para SUPERADMIN
  const isDebugRoute = pathname.startsWith('/api/debug-') ||
                       pathname.startsWith('/api/test-') ||
                       pathname.startsWith('/api/diagnostico-') ||
                       pathname.startsWith('/api/verificar-') ||
                       pathname.startsWith('/api/restore-');

  if (isDebugRoute) {
    // En desarrollo, permitir acceso
    if (process.env.NODE_ENV === 'development') {
      return nextWithViewMode();
    }

    // En producción, requiere SUPERADMIN
    if (!token) {
      return addCors(NextResponse.json(
        { error: 'Debug routes require authentication in production' },
        { status: 401 }
      ));
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
      if (payload.role !== 'SUPERADMIN') {
        return addCors(NextResponse.json(
          { error: 'Debug routes require SUPERADMIN role in production' },
          { status: 403 }
        ));
      }
      return nextWithViewMode({
        userId: payload.userId as number,
        companyId: payload.companyId as number,
      });
    } catch {
      return NextResponse.json(
        { error: 'Invalid authentication for debug route' },
        { status: 401 }
      );
    }
  }

  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/login'];
  const isPublicPath = publicPaths.includes(pathname);

  // Rutas de API que no requieren autenticación
  const publicApiPaths = [
    '/api/auth/login',
    '/api/auth/mobile-login',
    '/api/auth/logout',
    '/api/auth/refresh',
    // '/api/cron' removido - ahora se valida con CRON_SECRET más abajo
    '/api/webhooks',       // Webhooks externos
    '/api/telegram',       // Bot de Telegram
    '/api/google-drive/credentials', // Credenciales públicas de Google Drive
    '/api/notifications/reminders-check', // Llamado interno por cron/reminder-check
    '/api/tasks/check-overdue',           // Llamado interno por cron/task-due-check
  ];
  const isPublicApiPath = publicApiPaths.some(path => pathname.startsWith(path));

  // Si estamos en una ruta pública, permitir acceso
  if (isPublicPath || isPublicApiPath) {
    return nextWithViewMode();
  }

  // Validar cron routes con CRON_SECRET
  if (pathname.startsWith('/api/cron')) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return nextWithViewMode();
    }
    return addCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  // Verificar si es la ruta de superadmin
  if (pathname.startsWith('/superadmin')) {
    if (!token) {
      return tryRefreshOrLogin();
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

      if (payload.role !== 'SUPERADMIN') {
        // Si no es superadmin, redirigir según su rol
        if (payload.role === 'ADMIN') {
          return NextResponse.redirect(new URL('/empresas', request.url));
        } else {
          return tryRefreshOrLogin();
        }
      }

      // Es superadmin, permitir acceso
      return nextWithViewMode({
        userId: payload.userId as number,
        companyId: payload.companyId as number,
      });
    } catch (error) {
      console.error('Error verifying JWT in middleware:', error);
      return tryRefreshOrLogin();
    }
  }

  // Para rutas de administración, verificar autenticación y permisos específicos
  if (pathname.startsWith('/administracion')) {
    if (!token) {
      return tryRefreshOrLogin();
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

      // SUPERADMIN solo puede acceder a /superadmin
      if (payload.role === 'SUPERADMIN') {
        return NextResponse.redirect(new URL('/superadmin', request.url));
      }

      // Verificación específica de permisos se hace en el componente usando el sistema granular

      // Importante:
      // A partir de aquí NO hacemos más checks por rol estático (USER, ADMIN, etc.)
      // para /administracion/usuarios o /administracion/permisos.
      // Esas pantallas se protegen usando el sistema granular de permisos
      // vía `PermissionGuard` + `/api/permissions/check`, que sí respeta
      // el rol específico de la empresa (por ejemplo "Administrador").

      return nextWithViewMode({
        userId: payload.userId as number,
        companyId: payload.companyId as number,
      });
    } catch (error) {
      console.error('❌ [MIDDLEWARE] Error verificando JWT para administración:', error);
      return tryRefreshOrLogin();
    }
  }

  // Para otras rutas protegidas, verificar que hay token válido
  if (!token) {
    return tryRefreshOrLogin();
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    // SUPERADMIN solo puede acceder a /superadmin (excepto API routes)
    if (payload.role === 'SUPERADMIN' && !pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/superadmin', request.url));
    }

    return nextWithViewMode({
      userId: payload.userId as number,
      companyId: payload.companyId as number,
    });
  } catch (error) {
    console.error('Invalid JWT in middleware:', error);
    return tryRefreshOrLogin();
  }
}

// Configurar las rutas que requieren middleware
// Incluye rutas frontend + rutas API de debug para protección
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)',
    '/api/debug-:path*',
    '/api/test-:path*',
    '/api/diagnostico-:path*',
    '/api/verificar-:path*',
    '/api/restore-:path*',
  ],
}; 