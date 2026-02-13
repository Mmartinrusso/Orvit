import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

// Codificar el secret para jose
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Genera un nonce criptográficamente seguro para CSP
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Convertir a base64 manualmente para compatibilidad Edge Runtime
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < array.length; i += 3) {
    const a = array[i];
    const b = array[i + 1] || 0;
    const c = array[i + 2] || 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < array.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < array.length ? chars[c & 63] : '=';
  }
  return result;
}

/**
 * Construye la política CSP con nonce dinámico
 */
function buildCspHeader(nonce: string): string {
  const directives = [
    "default-src 'self'",
    // script-src: nonce para scripts inline, unsafe-eval solo en dev (hot reload)
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    // style-src: unsafe-inline necesario para Recharts, RichTextEditor y estilos dinámicos
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // img-src: self, data URIs, blob URIs, S3 bucket, Pexels
    "img-src 'self' data: blob: https://mawir-bucket.s3.us-east-2.amazonaws.com https://*.s3.us-east-2.amazonaws.com https://images.pexels.com",
    // font-src: self y Google Fonts
    "font-src 'self' https://fonts.gstatic.com",
    // connect-src: self, Sentry, S3 (uploads), dev WebSocket/HTTP
    `connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io https://mawir-bucket.s3.us-east-2.amazonaws.com https://*.s3.us-east-2.amazonaws.com${isDev ? ' ws://localhost:* http://localhost:*' : ''}`,
    // worker-src: service workers
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Reportar violaciones CSP (report-uri para navegadores legacy)
    "report-uri /api/csp-report",
  ];
  return directives.join('; ');
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
  const token = request.cookies.get('token')?.value;
  const pathname = request.nextUrl.pathname;

  // Generar nonce único para este request
  const nonce = generateNonce();
  const cspHeader = buildCspHeader(nonce);

  /**
   * Aplica headers CSP y x-nonce a la respuesta
   */
  const applyCspHeaders = (response: NextResponse): NextResponse => {
    response.headers.set('Content-Security-Policy', cspHeader);
    response.headers.set('x-nonce', nonce);
    return response;
  };

  // Helper to create response with ViewMode header injected
  const createResponseWithViewMode = async (
    response: NextResponse,
    authPayload: { userId?: number; companyId?: number } | null
  ): Promise<NextResponse> => {
    // Only inject for API routes
    if (!pathname.startsWith('/api/')) {
      return applyCspHeaders(response);
    }

    // Check if route is protected (fiscal reports) - always use Standard
    if (isProtectedRoute(pathname)) {
      response.headers.set(VM_HEADER_NAME, VM_ENCODED.S);
      return applyCspHeaders(response);
    }

    // Get mode from cookie
    const mode = await getViewModeFromCookie(request, authPayload);
    response.headers.set(VM_HEADER_NAME, VM_ENCODED[mode]);
    return applyCspHeaders(response);
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
        requestHeaders.set('x-nonce', nonce);
        const response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        return applyCspHeaders(response);
      }

      // Get mode from cookie
      const mode = await getViewModeFromCookie(request, authPayload);
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(VM_HEADER_NAME, VM_ENCODED[mode]);
      requestHeaders.set('x-nonce', nonce);
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      return applyCspHeaders(response);
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    return applyCspHeaders(response);
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
      return applyCspHeaders(NextResponse.json(
        { error: 'Debug routes require authentication in production' },
        { status: 401 }
      ));
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
      if (payload.role !== 'SUPERADMIN') {
        return applyCspHeaders(NextResponse.json(
          { error: 'Debug routes require SUPERADMIN role in production' },
          { status: 403 }
        ));
      }
      return nextWithViewMode({
        userId: payload.userId as number,
        companyId: payload.companyId as number,
      });
    } catch {
      return applyCspHeaders(NextResponse.json(
        { error: 'Invalid authentication for debug route' },
        { status: 401 }
      ));
    }
  }

  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/login'];
  const isPublicPath = publicPaths.includes(pathname);

  // Rutas de API que no requieren autenticación
  const publicApiPaths = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/whatsapp',
    // '/api/cron' removido - ahora se valida con CRON_SECRET más abajo
    '/api/webhooks',       // Webhooks externos
    '/api/telegram',       // Bot de Telegram
    '/api/google-drive/credentials', // Credenciales públicas de Google Drive
    '/api/csp-report',     // Reportes de violaciones CSP (enviados por el navegador)
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
    return applyCspHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  // Verificar si es la ruta de superadmin
  if (pathname.startsWith('/superadmin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

      if (payload.role !== 'SUPERADMIN') {
        // Si no es superadmin, redirigir según su rol
        if (payload.role === 'ADMIN') {
          return NextResponse.redirect(new URL('/empresas', request.url));
        } else {
          return NextResponse.redirect(new URL('/login', request.url));
        }
      }

      // Es superadmin, permitir acceso
      return nextWithViewMode({
        userId: payload.userId as number,
        companyId: payload.companyId as number,
      });
    } catch (error) {
      console.error('Error verifying JWT in middleware:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Para rutas de administración, verificar autenticación y permisos específicos
  if (pathname.startsWith('/administracion')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
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
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Para otras rutas protegidas, verificar que hay token válido
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
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
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Configurar las rutas que requieren middleware
// Incluye rutas frontend + rutas API de debug para protección
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/api/debug-:path*',
    '/api/test-:path*',
    '/api/diagnostico-:path*',
    '/api/verificar-:path*',
    '/api/restore-:path*',
  ],
}; 