import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  hashPassword,
  validatePasswordPolicy,
  createPortalSession,
  getSessionCookieValue,
} from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/activate/[token]
 * Verificar si el token de activación es válido
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token requerido' },
        { status: 400 }
      );
    }

    // Buscar invitación
    const invite = await prisma.clientPortalInvite.findUnique({
      where: { token },
      include: {
        portalUser: {
          include: {
            contact: true,
            company: {
              select: { id: true, name: true, logo: true },
            },
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 404 }
      );
    }

    // Verificar si ya fue usado
    if (invite.usedAt) {
      return NextResponse.json(
        { error: 'Este enlace ya fue utilizado' },
        { status: 400 }
      );
    }

    // Verificar expiración
    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Este enlace ha expirado' },
        { status: 400 }
      );
    }

    // Retornar datos del usuario para mostrar en el form
    return NextResponse.json({
      valid: true,
      user: {
        email: invite.portalUser.email,
        contact: {
          firstName: invite.portalUser.contact.firstName,
          lastName: invite.portalUser.contact.lastName,
        },
        company: {
          name: invite.portalUser.company.name,
          logo: invite.portalUser.company.logo,
        },
      },
    });
  } catch (error) {
    console.error('Error verificando token de activación:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/activate/[token]
 * Activar cuenta y setear password
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token requerido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { password, confirmPassword } = body;

    // Validaciones
    if (!password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Contraseña y confirmación son requeridas' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Las contraseñas no coinciden' },
        { status: 400 }
      );
    }

    // Validar política de contraseñas
    const policyResult = validatePasswordPolicy(password);
    if (!policyResult.valid) {
      return NextResponse.json(
        { error: policyResult.errors.join('. ') },
        { status: 400 }
      );
    }

    // Buscar invitación
    const invite = await prisma.clientPortalInvite.findUnique({
      where: { token },
      include: {
        portalUser: {
          include: {
            contact: true,
            client: {
              select: { id: true, name: true, legalName: true },
            },
            company: {
              select: { id: true, name: true, logo: true },
            },
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 404 }
      );
    }

    // Verificar si ya fue usado
    if (invite.usedAt) {
      return NextResponse.json(
        { error: 'Este enlace ya fue utilizado' },
        { status: 400 }
      );
    }

    // Verificar expiración
    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Este enlace ha expirado' },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const passwordHash = await hashPassword(password);

    // Obtener IP y user agent
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Actualizar usuario y marcar invitación como usada (transacción)
    const [updatedUser] = await prisma.$transaction([
      prisma.clientPortalUser.update({
        where: { id: invite.portalUserId },
        data: {
          passwordHash,
          isVerified: true,
          activatedAt: new Date(),
        },
      }),
      prisma.clientPortalInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Crear sesión automáticamente
    const { token: sessionToken, expiresAt } = await createPortalSession(
      updatedUser.id,
      updatedUser.companyId,
      ip,
      userAgent
    );

    // Log de actividad
    await prisma.clientPortalActivity.create({
      data: {
        portalUserId: updatedUser.id,
        clientId: updatedUser.clientId,
        companyId: updatedUser.companyId,
        action: 'LOGIN',
        details: { method: 'activation' },
        ipAddress: ip,
        userAgent,
      },
    });

    // Crear respuesta con cookie de sesión
    const response = NextResponse.json({
      success: true,
      message: 'Cuenta activada correctamente',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        contact: {
          firstName: invite.portalUser.contact.firstName,
          lastName: invite.portalUser.contact.lastName,
        },
        client: invite.portalUser.client,
        company: invite.portalUser.company,
      },
    });

    // Setear cookie de sesión
    response.headers.set(
      'Set-Cookie',
      getSessionCookieValue(sessionToken, expiresAt)
    );

    return response;
  } catch (error) {
    console.error('Error activando cuenta del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
