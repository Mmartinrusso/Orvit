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
import { getDiscordClient, connectBot, isBotReady, listGuilds } from '@/lib/discord/bot';

export const dynamic = 'force-dynamic';

// Cargar discord.js dinámicamente para evitar problemas con webpack
let discordModule: any = null;
async function loadDiscordModule() {
  if (!discordModule) {
    // @ts-ignore
    discordModule = await import(/* webpackIgnore: true */ 'discord.js');
  }
  return discordModule;
}

/**
 * Auto-conecta el bot si no está conectado
 */
async function ensureBotConnected(): Promise<boolean> {
  if (isBotReady()) return true;

  try {
    const company = await prisma.company.findFirst({
      where: { discordBotToken: { not: null } },
      select: { discordBotToken: true }
    });

    if (!company?.discordBotToken) {
      return false;
    }

    const result = await connectBot(company.discordBotToken);
    return result.success;
  } catch (error) {
    console.error('Error auto-conectando bot:', error);
    return false;
  }
}

/**
 * Verifica si un usuario puede ver un canal específico en Discord
 */
async function canUserViewChannel(
  guildId: string,
  channelId: string,
  discordUserId: string
): Promise<boolean> {
  try {
    const discord = await loadDiscordModule();
    const client = await getDiscordClient();
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);

    if (!channel) return false;

    // Obtener el miembro
    const member = await guild.members.fetch(discordUserId).catch(() => null);
    if (!member) return false;

    // Verificar permisos
    const permissions = channel.permissionsFor(member);
    return permissions?.has(discord.PermissionFlagsBits.ViewChannel) ?? false;
  } catch (error) {
    console.error(`Error verificando permisos para canal ${channelId}:`, error);
    return false;
  }
}

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
        companies: { some: { companyId } }
      },
      select: { id: true, discordUserId: true, name: true }
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

    // Conectar bot primero (necesitamos el bot para obtener el guildId si no existe)
    const connected = await ensureBotConnected();
    if (!connected) {
      return NextResponse.json(
        { error: 'No se pudo conectar el bot de Discord' },
        { status: 500 }
      );
    }

    // Obtener la empresa con su servidor de Discord
    let company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { discordGuildId: true }
    });

    let guildId = company?.discordGuildId;

    // Si no tiene guildId configurado, intentar auto-detectar desde el bot
    if (!guildId) {
      const guilds = listGuilds();
      if (guilds.length === 0) {
        return NextResponse.json(
          { error: 'El bot no está en ningún servidor de Discord' },
          { status: 400 }
        );
      }

      // Usar el primer servidor (o el único)
      guildId = guilds[0].id;
      console.log(`Auto-detectado servidor de Discord: ${guilds[0].name} (${guildId})`);

      // Guardar el guildId en la empresa para futuras operaciones
      await prisma.company.update({
        where: { id: companyId },
        data: { discordGuildId: guildId }
      });
    }

    // Obtener sectores con canales Discord
    const sectors = await prisma.sector.findMany({
      where: {
        companyId,
        discordCategoryId: { not: null }
      },
      select: {
        id: true,
        name: true,
        discordCategoryId: true,
        discordFallasChannelId: true,
        discordPreventivosChannelId: true,
        discordOTChannelId: true,
        discordGeneralChannelId: true,
      }
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
      // Verificar permisos en cada canal
      const canViewFallas = sector.discordFallasChannelId
        ? await canUserViewChannel(guildId, sector.discordFallasChannelId, user.discordUserId)
        : false;

      const canViewPreventivos = sector.discordPreventivosChannelId
        ? await canUserViewChannel(guildId, sector.discordPreventivosChannelId, user.discordUserId)
        : false;

      const canViewOT = sector.discordOTChannelId
        ? await canUserViewChannel(guildId, sector.discordOTChannelId, user.discordUserId)
        : false;

      const canViewGeneral = sector.discordGeneralChannelId
        ? await canUserViewChannel(guildId, sector.discordGeneralChannelId, user.discordUserId)
        : false;

      // Si tiene acceso a al menos un canal, crear/actualizar el registro
      const hasAnyAccess = canViewFallas || canViewPreventivos || canViewOT || canViewGeneral;

      if (hasAnyAccess) {
        // Verificar si ya existe el acceso
        const existingAccess = await prisma.userDiscordAccess.findUnique({
          where: {
            userId_sectorId: { userId, sectorId: sector.id }
          }
        });

        if (existingAccess) {
          // Actualizar permisos existentes
          await prisma.userDiscordAccess.update({
            where: { id: existingAccess.id },
            data: {
              canViewFallas,
              canViewPreventivos,
              canViewOT,
              canViewGeneral,
            }
          });
          updated++;
        } else {
          // Crear nuevo acceso
          await prisma.userDiscordAccess.create({
            data: {
              userId,
              sectorId: sector.id,
              grantedBy,
              canViewFallas,
              canViewPreventivos,
              canViewOT,
              canViewGeneral,
            }
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
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sincronizado: ${created} nuevos, ${updated} actualizados`,
      created,
      updated,
      details: results
    });
  } catch (error: any) {
    console.error('Error en POST /api/discord/sync-from-discord:', error);
    return NextResponse.json(
      { error: 'Error al sincronizar desde Discord', detail: error?.message },
      { status: 500 }
    );
  }
}
