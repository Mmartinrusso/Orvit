import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentPortalSession,
  logoutPortalUser,
  getLogoutCookieValue,
} from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/portal/auth/logout
 * Logout de usuario del portal
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener sesión actual
    const session = await getCurrentPortalSession();

    if (session) {
      // Obtener IP y user agent
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = request.headers.get('user-agent') || undefined;

      // Invalidar sesión y registrar actividad
      await logoutPortalUser(
        session.id,
        session.portalUserId,
        session.clientId,
        session.companyId,
        ip,
        userAgent
      );
    }

    // Crear respuesta eliminando cookie
    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', getLogoutCookieValue());

    return response;
  } catch (error) {
    console.error('Error en logout del portal:', error);

    // Aún así eliminar la cookie
    const response = NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
    response.headers.set('Set-Cookie', getLogoutCookieValue());

    return response;
  }
}
