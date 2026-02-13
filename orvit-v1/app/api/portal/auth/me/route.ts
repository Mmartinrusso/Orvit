import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPortalSession } from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/auth/me
 * Obtener usuario actual del portal
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentPortalSession();

    if (!session) {
      return NextResponse.json(
        { error: 'No hay sesión activa' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: session,
    });
  } catch (error) {
    console.error('Error obteniendo sesión del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
