import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateInviteToken } from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/portal/usuarios/[id]/reinvitar
 * Reenviar invitación a un usuario del portal
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

    // Verificar que el usuario existe y no está verificado
    const usuario = await prisma.clientPortalUser.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      include: {
        contact: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (usuario.isVerified) {
      return NextResponse.json(
        { error: 'El usuario ya está verificado' },
        { status: 400 }
      );
    }

    // Obtener configuración del portal
    const config = await prisma.salesConfig.findUnique({
      where: { companyId: auth.companyId },
      select: { portalInviteDays: true },
    });

    const inviteDays = config?.portalInviteDays || 7;

    // Generar nuevo token de invitación
    const inviteToken = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + inviteDays);

    // Invalidar invitaciones anteriores y crear nueva
    await prisma.$transaction([
      prisma.clientPortalInvite.updateMany({
        where: {
          portalUserId: params.id,
          usedAt: null,
        },
        data: {
          expiresAt: new Date(0), // Expirar inmediatamente
        },
      }),
      prisma.clientPortalInvite.create({
        data: {
          portalUserId: params.id,
          companyId: auth.companyId,
          token: inviteToken,
          expiresAt,
          invitedById: auth.userId,
        },
      }),
    ]);

    // Construir URL de activación
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const activationUrl = `${baseUrl}/portal/activate/${inviteToken}`;

    return NextResponse.json({
      success: true,
      message: 'Invitación reenviada correctamente',
      invite: {
        token: inviteToken,
        expiresAt,
        activationUrl,
        email: usuario.email,
        nombre: `${usuario.contact.firstName} ${usuario.contact.lastName}`,
      },
    });
  } catch (error) {
    console.error('Error reenviando invitación:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
