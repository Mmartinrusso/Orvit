/**
 * API: /api/discord/sync-from-discord
 *
 * Sincroniza los permisos de Discord a ORVIT
 * Detecta qué canales puede ver el usuario en Discord y crea los accesos correspondientes
 *
 * POST - Sincroniza un usuario específico
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  manageBotChannels,
  checkChannelAccessViaBotService,
} from '@/lib/discord/bot-service-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/discord/sync-from-discord
 * Sincroniza los permisos de un usuario desde Discord a ORVIT
 * Body: { userId: number }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const grantedBy = payload.userId as number;

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Se requiere userId' }, { status: 400 });
    }

    // Verificar que el usuario existe y tiene Discord vinculado
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        companies: { some: { companyId } },
      },
      select: { id: true, discordUserId: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!user.discordUserId) {
      return NextResponse.json(
        { error: 'El usuario no tiene Discord vinculado' },
        { status: 400 }
      );
    }

    // Obtener la empresa con su servidor de Discord
    let company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { discordGuildId: true },
    });

    let guildId = company?.discordGuildId;

    // Si no tiene guildId configurado, intentar auto-detectar desde el bot
    if (!guildId) {
      const guildsResult = await manageBotChannels('getGuilds', {});
      const guilds = guildsResult.guilds || [];

      if (guilds.length === 0) {
        return NextResponse.json(
          { error: 'El bot no está en ningún servidor de Discord' },
          { status: 400 }
        );
      }

      guildId = guilds[0].id;
      console.log(`Auto-detectado servidor de Discord: ${guilds[0].name} (${guildId})`);

      await prisma.company.update({
        where: { id: companyId },
        data: { discordGuildId: guildId },
      });
    }

    // Obtener sectores con canales Discord
    const sectors = await prisma.sector.findMany({
      where: {
        companyId,
        discordCategoryId: { not: null },
      },
      select: {
        id: true,
        name: true,
        discordCategoryId: true,
        discordFallasChannelId: true,
        discordPreventivosChannelId: true,
        discordOTChannelId: true,
        discordGeneralChannelId: true,
      },
    });

    const results: {
      sector: string;
      hadAccess: boolean;
      permissions: {
        fallas: boolean;
        preventivos: boolean;
        ot: boolean;
        general: boolean;
      };
    }[] = [];

    let created = 0;
    let updated = 0;

    for (const sector of sectors) {
      // Collect all channel IDs for this sector
      const channelIds: string[] = [];
      if (sector.discordFallasChannelId) channelIds.push(sector.discordFallasChannelId);
      if (sector.discordPreventivosChannelId) channelIds.push(sector.discordPreventivosChannelId);
      if (sector.discordOTChannelId) channelIds.push(sector.discordOTChannelId);
      if (sector.discordGeneralChannelId) channelIds.push(sector.discordGeneralChannelId);

      if (channelIds.length === 0) continue;

      // Check access via bot service (single call per sector)
      const accessResult = await checkChannelAccessViaBotService(
        guildId,
        user.discordUserId,
        channelIds
      );

      const access = accessResult.access || {};

      const canViewFallas = sector.discordFallasChannelId
        ? (access[sector.discordFallasChannelId] ?? false)
        : false;
      const canViewPreventivos = sector.discordPreventivosChannelId
        ? (access[sector.discordPreventivosChannelId] ?? false)
        : false;
      const canViewOT = sector.discordOTChannelId
        ? (access[sector.discordOTChannelId] ?? false)
        : false;
      const canViewGeneral = sector.discordGeneralChannelId
        ? (access[sector.discordGeneralChannelId] ?? false)
        : false;

      const hasAnyAccess = canViewFallas || canViewPreventivos || canViewOT || canViewGeneral;

      if (hasAnyAccess) {
        const existingAccess = await prisma.userDiscordAccess.findUnique({
          where: {
            userId_sectorId: { userId, sectorId: sector.id },
          },
        });

        if (existingAccess) {
          await prisma.userDiscordAccess.update({
            where: { id: existingAccess.id },
            data: {
              canViewFallas,
              canViewPreventivos,
              canViewOT,
              canViewGeneral,
            },
          });
          updated++;
        } else {
          await prisma.userDiscordAccess.create({
            data: {
              userId,
              sectorId: sector.id,
              grantedBy,
              canViewFallas,
              canViewPreventivos,
              canViewOT,
              canViewGeneral,
            },
          });
          created++;
        }

        results.push({
          sector: sector.name,
          hadAccess: !!existingAccess,
          permissions: {
            fallas: canViewFallas,
            preventivos: canViewPreventivos,
            ot: canViewOT,
            general: canViewGeneral,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sincronizado: ${created} nuevos, ${updated} actualizados`,
      created,
      updated,
      details: results,
    });
  } catch (error: any) {
    console.error('Error en POST /api/discord/sync-from-discord:', error);
    return NextResponse.json(
      { error: 'Error al sincronizar desde Discord', detail: error?.message },
      { status: 500 }
    );
  }
}
