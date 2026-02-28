import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * ✨ ENDPOINT: Configuración del sistema
 * Devuelve configuración básica del sistema (logos, etc.)
 *
 * NOTA: El modelo SystemSettings no existe en Prisma,
 * por lo que devolvemos valores por defecto.
 * En el futuro, esta info debería venir del bootstrap.
 */
export async function GET() {
  try {
    // Verificar permiso settings.view
    const { user: authUser, error: authError } = await requirePermission('settings.view');
    if (authError) return authError;
    // Devolver configuración por defecto
    // TODO: Migrar esto al endpoint /api/core/bootstrap
    return NextResponse.json({
      id: 'system-settings-default',
      systemLogoDark: null,
      systemLogoLight: null,
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'ARS',
      dateFormat: 'dd/MM/yyyy'
    });
  } catch (error) {
    console.error('[SYSTEM_SETTINGS_ERROR]', error);
    return NextResponse.json(
      { 
        id: 'system-settings-default',
        systemLogoDark: null,
        systemLogoLight: null 
      }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verificar permiso settings.edit
    const { user: authUser, error: authError } = await requirePermission('settings.edit');
    if (authError) return authError;

    const body = await request.json();
    
    // Por ahora solo devolvemos lo que nos envían
    // TODO: Implementar persistencia cuando exista el modelo
    return NextResponse.json({
      id: 'system-settings-default',
      systemLogoDark: body.systemLogoDark || null,
      systemLogoLight: body.systemLogoLight || null,
      message: 'Settings updated (in-memory only)'
    });
  } catch (error) {
    console.error('[SYSTEM_SETTINGS_UPDATE_ERROR]', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}
