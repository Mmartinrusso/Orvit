import { NextRequest, NextResponse } from 'next/server';
import {
  loginPortalUser,
  checkRateLimit,
  getSessionCookieValue,
} from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/portal/auth/login
 * Login de usuario del portal
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener IP del cliente
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Rate limiting
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Demasiados intentos. Intente más tarde',
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 60),
          },
        }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    // Validaciones básicas
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      );
    }

    // User agent
    const userAgent = request.headers.get('user-agent') || undefined;

    // Intentar login
    const result = await loginPortalUser(email, password, ip, userAgent);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // Crear respuesta con cookie de sesión
    const response = NextResponse.json({
      success: true,
      user: result.user,
    });

    // Setear cookie de sesión
    if (result.token && result.expiresAt) {
      response.headers.set(
        'Set-Cookie',
        getSessionCookieValue(result.token, result.expiresAt)
      );
    }

    return response;
  } catch (error) {
    console.error('Error en login del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
