/**
 * API: /api/discord/bot/send-dm
 *
 * POST - Enviar un mensaje directo a un usuario de Discord
 *        Puede enviarse por discordUserId o por userId de ORVIT
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isBotReady, sendDM, sendBulkDM, DISCORD_COLORS } from '@/lib/discord';

export const dynamic = 'force-dynamic';

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

    // 2. Verificar que el bot esté conectado
    if (!isBotReady()) {
      return NextResponse.json(
        { error: 'Bot no está conectado' },
        { status: 400 }
      );
    }

    // 3. Obtener datos del body
    const body = await request.json();
    const {
      // Destinatario(s)
      discordUserId,  // ID de Discord directo
      userId,         // ID de usuario ORVIT (se buscará su discordUserId)
      userIds,        // Array de IDs de usuarios ORVIT (para envío masivo)
      // Mensaje
      content,
      embed,
    } = body;

    // 4. Validar que hay contenido para enviar
    if (!content && !embed) {
      return NextResponse.json(
        { error: 'Se requiere content o embed' },
        { status: 400 }
      );
    }

    // 5. Determinar destinatarios
    let targetDiscordIds: string[] = [];

    if (discordUserId) {
      // ID de Discord proporcionado directamente
      targetDiscordIds = [discordUserId];
    } else if (userId) {
      // Buscar discordUserId del usuario ORVIT
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { discordUserId: true, name: true },
      });

      if (!user?.discordUserId) {
        return NextResponse.json(
          { error: 'Usuario no tiene Discord vinculado' },
          { status: 400 }
        );
      }

      targetDiscordIds = [user.discordUserId];
    } else if (userIds && Array.isArray(userIds)) {
      // Buscar discordUserIds de múltiples usuarios
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          discordUserId: { not: null },
        },
        select: { discordUserId: true },
      });

      targetDiscordIds = users
        .map(u => u.discordUserId)
        .filter((id): id is string => id !== null);

      if (targetDiscordIds.length === 0) {
        return NextResponse.json(
          { error: 'Ninguno de los usuarios tiene Discord vinculado' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Se requiere discordUserId, userId o userIds' },
        { status: 400 }
      );
    }

    // 6. Preparar mensaje
    const messageOptions = {
      content,
      embed: embed ? {
        title: embed.title,
        description: embed.description,
        color: embed.color || DISCORD_COLORS.INFO,
        fields: embed.fields,
        footer: embed.footer,
        timestamp: embed.timestamp,
      } : undefined,
    };

    // 7. Enviar mensaje(s)
    if (targetDiscordIds.length === 1) {
      // Envío individual
      const result = await sendDM(targetDiscordIds[0], messageOptions);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Error al enviar DM' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'DM enviado exitosamente',
      });
    } else {
      // Envío masivo
      const results = await sendBulkDM(targetDiscordIds, messageOptions);

      return NextResponse.json({
        success: true,
        message: `DMs enviados: ${results.sent} exitosos, ${results.failed} fallidos`,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors.length > 0 ? results.errors : undefined,
      });
    }

  } catch (error: any) {
    console.error('❌ Error en POST /api/discord/bot/send-dm:', error);
    return NextResponse.json(
      { error: 'Error al enviar DM', detail: error.message },
      { status: 500 }
    );
  }
}
