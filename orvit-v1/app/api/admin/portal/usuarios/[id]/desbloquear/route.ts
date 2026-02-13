import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/portal/usuarios/[id]/desbloquear
 * Desbloquear usuario del portal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que el usuario existe
    const usuario = await prisma.clientPortalUser.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Desbloquear usuario
    await prisma.clientPortalUser.update({
      where: { id: params.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Usuario desbloqueado correctamente',
    });
  } catch (error) {
    console.error('Error desbloqueando usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
