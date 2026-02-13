/**
 * API: /api/discord/users/link
 *
 * POST - Vincular un usuario de ORVIT con su cuenta de Discord
 * DELETE - Desvincular la cuenta de Discord de un usuario
 * GET - Obtener el estado de vinculación de un usuario
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendDM, getDiscordClient, isBotReady } from '@/lib/discord/bot';

export const dynamic = 'force-dynamic';

// Vincular cuenta de Discord
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Obtener datos del body
    const body = await request.json();
    const { userId, discordUserId } = body;

    // El usuario puede vincular su propia cuenta o un admin puede vincular otras
    const targetUserId = userId || payload.userId;

    if (targetUserId !== payload.userId) {
      // Verificar que sea admin
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { role: true },
      });

      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
        return NextResponse.json(
          { error: 'Solo administradores pueden vincular cuentas de otros usuarios' },
          { status: 403 }
        );
      }
    }

    if (!discordUserId) {
      return NextResponse.json(
        { error: 'Se requiere discordUserId' },
        { status: 400 }
      );
    }

    // 3. Verificar que el discordUserId no esté ya vinculado a otro usuario
    const existingLink = await prisma.user.findFirst({
      where: {
        discordUserId,
        id: { not: targetUserId },
      },
    });

    if (existingLink) {
      return NextResponse.json(
        { error: 'Este ID de Discord ya está vinculado a otro usuario' },
        { status: 400 }
      );
    }

    // 4. Vincular la cuenta
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { discordUserId },
      select: {
        id: true,
        name: true,
        email: true,
        discordUserId: true,
        companies: {
          select: {
            company: {
              select: {
                id: true,
                name: true,
                discordGuildId: true,
              },
            },
          },
        },
      },
    });

    // 5. Enviar invitación al servidor de Discord de la empresa (si existe)
    let inviteSent = false;
    let inviteError: string | undefined;

    const company = updatedUser.companies?.[0]?.company;
    if (company?.discordGuildId && isBotReady()) {
      try {
        const discordClient = await getDiscordClient();
        if (discordClient) {
          const guild = await discordClient.guilds.fetch(company.discordGuildId);

          if (guild) {
            // Verificar si el usuario ya está en el servidor
            try {
              await guild.members.fetch(discordUserId);
              // Si llegamos aquí, el usuario ya está en el servidor
              console.log(`[Discord Link] Usuario ${discordUserId} ya está en el servidor ${guild.name}`);
            } catch {
              // Usuario no está en el servidor, crear invitación
              // Buscar el canal de sistema o el primer canal de texto disponible
              const inviteChannel = guild.systemChannel ||
                guild.channels.cache.find(ch => ch.isTextBased() && !ch.isThread() && !ch.isVoiceBased());

              if (inviteChannel && 'createInvite' in inviteChannel) {
                const invite = await (inviteChannel as any).createInvite({
                  maxAge: 604800, // 7 días
                  maxUses: 1, // Un solo uso
                  unique: true,
                  reason: `Invitación automática para ${updatedUser.name} al vincular Discord`,
                });

                // Enviar DM con la invitación
                const dmResult = await sendDM(discordUserId, {
                  embed: {
                    title: '🎉 ¡Cuenta vinculada exitosamente!',
                    description: `Tu cuenta de Discord ha sido vinculada a ORVIT.\n\nPara recibir notificaciones y usar todas las funciones, únete al servidor de **${company.name}**:`,
                    color: 0x5865f2,
                    fields: [
                      {
                        name: '🔗 Link de invitación',
                        value: `[Unirte al servidor](${invite.url})`,
                        inline: false,
                      },
                      {
                        name: '⏰ Válido por',
                        value: '7 días (un solo uso)',
                        inline: true,
                      },
                    ],
                    footer: 'ORVIT - Sistema de Gestión',
                    timestamp: true,
                  },
                });

                inviteSent = dmResult.success;
                if (!dmResult.success) {
                  inviteError = dmResult.error;
                  console.warn(`[Discord Link] No se pudo enviar DM con invitación: ${dmResult.error}`);
                } else {
                  console.log(`[Discord Link] Invitación enviada a ${discordUserId} para servidor ${guild.name}`);
                }
              } else {
                console.warn('[Discord Link] No se encontró canal válido para crear invitación');
                inviteError = 'No se encontró canal para crear invitación';
              }
            }
          }
        }
      } catch (error: any) {
        console.error('[Discord Link] Error al enviar invitación:', error.message);
        inviteError = error.message;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cuenta de Discord vinculada exitosamente',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        discordUserId: updatedUser.discordUserId,
      },
      invite: {
        sent: inviteSent,
        alreadyInServer: !inviteSent && !inviteError,
        error: inviteError,
      },
    });

  } catch (error: any) {
    console.error('❌ Error en POST /api/discord/users/link:', error);
    return NextResponse.json(
      { error: 'Error al vincular cuenta', detail: error.message },
      { status: 500 }
    );
  }
}

// Desvincular cuenta de Discord
export async function DELETE(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Obtener userId del query param o usar el propio
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId')
      ? parseInt(searchParams.get('userId')!)
      : payload.userId;

    if (userId !== payload.userId) {
      // Verificar que sea admin
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { role: true },
      });

      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
        return NextResponse.json(
          { error: 'Solo administradores pueden desvincular cuentas de otros usuarios' },
          { status: 403 }
        );
      }
    }

    // 3. Desvincular la cuenta
    await prisma.user.update({
      where: { id: userId },
      data: { discordUserId: null },
    });

    return NextResponse.json({
      success: true,
      message: 'Cuenta de Discord desvinculada',
    });

  } catch (error: any) {
    console.error('❌ Error en DELETE /api/discord/users/link:', error);
    return NextResponse.json(
      { error: 'Error al desvincular cuenta', detail: error.message },
      { status: 500 }
    );
  }
}

// Obtener estado de vinculación
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Obtener userId del query param o usar el propio
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId')
      ? parseInt(searchParams.get('userId')!)
      : payload.userId;

    // 3. Obtener el usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        discordUserId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      userId: user.id,
      name: user.name,
      email: user.email,
      linked: !!user.discordUserId,
      discordUserId: user.discordUserId,
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/discord/users/link:', error);
    return NextResponse.json(
      { error: 'Error al obtener estado de vinculación', detail: error.message },
      { status: 500 }
    );
  }
}
