/**
 * Discord Permissions Sync
 *
 * Sincroniza los permisos de usuarios en Discord basándose en UserDiscordAccess
 * Soporta control granular por tipo de canal (fallas, preventivos, OT, general)
 */

import { prisma } from '@/lib/prisma';
import { getDiscordClient, connectBot, isBotReady } from './bot';

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
      console.warn('⚠️ No hay token de bot Discord configurado');
      return false;
    }

    console.log('🔄 Auto-conectando bot para sync de permisos...');
    const result = await connectBot(company.discordBotToken);

    return result.success;
  } catch (error) {
    console.error('❌ Error auto-conectando bot:', error);
    return false;
  }
}

/**
 * Da o quita permisos a un usuario en un canal específico
 */
async function setChannelPermission(
  channelId: string,
  discordUserId: string,
  allow: boolean
): Promise<boolean> {
  try {
    const client = await getDiscordClient();
    const channel = await client.channels.fetch(channelId);

    if (!channel) return false;

    if (allow) {
      // type: 1 = member/user (required for discord.js v14 when passing string ID)
      await (channel as any).permissionOverwrites.create(discordUserId, {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: true,
      }, { type: 1 });
    } else {
      // Eliminar el override (el usuario no verá el canal si la categoría es privada)
      await (channel as any).permissionOverwrites.delete(discordUserId).catch(() => {});
    }

    return true;
  } catch (error) {
    console.error(`Error setting permission for channel ${channelId}:`, error);
    return false;
  }
}

/**
 * Sincroniza permisos de canales individuales para un usuario en un sector
 */
export async function syncChannelPermissions(
  discordUserId: string,
  sectorId: number,
  permissions: {
    fallas: boolean;
    preventivos: boolean;
    ot: boolean;
    general: boolean;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    // Conectar bot
    const connected = await ensureBotConnected();
    if (!connected) {
      return { success: false, message: 'No se pudo conectar el bot' };
    }

    // Obtener sector con IDs de canales
    const sector = await prisma.sector.findUnique({
      where: { id: sectorId },
      select: {
        name: true,
        discordFallasChannelId: true,
        discordPreventivosChannelId: true,
        discordOTChannelId: true,
        discordGeneralChannelId: true,
      }
    });

    if (!sector) {
      return { success: false, message: 'Sector no encontrado' };
    }

    let updated = 0;

    // Sincronizar cada canal
    if (sector.discordFallasChannelId) {
      if (await setChannelPermission(sector.discordFallasChannelId, discordUserId, permissions.fallas)) {
        updated++;
      }
    }

    if (sector.discordPreventivosChannelId) {
      if (await setChannelPermission(sector.discordPreventivosChannelId, discordUserId, permissions.preventivos)) {
        updated++;
      }
    }

    if (sector.discordOTChannelId) {
      if (await setChannelPermission(sector.discordOTChannelId, discordUserId, permissions.ot)) {
        updated++;
      }
    }

    if (sector.discordGeneralChannelId) {
      if (await setChannelPermission(sector.discordGeneralChannelId, discordUserId, permissions.general)) {
        updated++;
      }
    }

    return {
      success: updated > 0,
      message: `Permisos actualizados en ${updated} canales de ${sector.name}`
    };
  } catch (error: any) {
    console.error('Error en syncChannelPermissions:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Sincroniza el acceso de un usuario a sectores en Discord
 * Respeta los permisos granulares por tipo de canal
 *
 * @param userId - ID del usuario en ORVIT
 * @param action - 'grant' para otorgar, 'revoke' para revocar
 * @param sectorIds - IDs de sectores a modificar
 */
export async function syncUserDiscordAccess(
  userId: number,
  action: 'grant' | 'revoke',
  sectorIds: number[]
): Promise<{ success: boolean; message: string; details?: string[] }> {
  try {
    // Obtener usuario con su discordUserId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { discordUserId: true, name: true }
    });

    if (!user?.discordUserId) {
      return {
        success: false,
        message: 'Usuario no tiene Discord vinculado'
      };
    }

    // Obtener sectores con sus canales de Discord
    const sectors = await prisma.sector.findMany({
      where: { id: { in: sectorIds } },
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

    const sectorsWithDiscord = sectors.filter(s => s.discordCategoryId);

    console.log(`🔄 [Discord Sync] Usuario ${user.name} (${user.discordUserId}), action=${action}, sectores=${sectorIds.join(',')}`);
    console.log(`🔄 [Discord Sync] Sectores con Discord: ${sectorsWithDiscord.map(s => `${s.name}(${s.discordCategoryId})`).join(', ')}`);

    if (sectorsWithDiscord.length === 0) {
      console.warn(`⚠️ [Discord Sync] Ningún sector tiene Discord configurado`);
      return {
        success: false,
        message: 'Ningún sector tiene Discord configurado'
      };
    }

    // Conectar bot
    const connected = await ensureBotConnected();
    if (!connected) {
      return {
        success: false,
        message: 'No se pudo conectar el bot de Discord'
      };
    }

    const client = await getDiscordClient();
    const details: string[] = [];
    let successCount = 0;

    for (const sector of sectorsWithDiscord) {
      try {
        // Si es grant, obtener los permisos específicos del usuario para este sector
        let channelPerms = {
          fallas: action === 'grant',
          preventivos: action === 'grant',
          ot: action === 'grant',
          general: action === 'grant',
        };

        if (action === 'grant') {
          // Obtener permisos granulares de la DB
          const access = await prisma.userDiscordAccess.findUnique({
            where: {
              userId_sectorId: { userId, sectorId: sector.id }
            },
            select: {
              canViewFallas: true,
              canViewPreventivos: true,
              canViewOT: true,
              canViewGeneral: true,
            }
          });

          if (access) {
            channelPerms = {
              fallas: access.canViewFallas,
              preventivos: access.canViewPreventivos,
              ot: access.canViewOT,
              general: access.canViewGeneral,
            };
          }
        }

        // Sincronizar la categoría primero
        if (sector.discordCategoryId) {
          console.log(`🔄 [Discord Sync] Aplicando permisos a categoría ${sector.discordCategoryId} para usuario ${user.discordUserId}`);
          const category = await client.channels.fetch(sector.discordCategoryId);
          if (category) {
            if (action === 'grant') {
              console.log(`🔄 [Discord Sync] Creando permiso ViewChannel en categoría ${sector.name}`);
              // type: 1 = member/user (required for discord.js v14 when passing string ID)
              await (category as any).permissionOverwrites.create(user.discordUserId, {
                ViewChannel: true,
                ReadMessageHistory: true,
              }, { type: 1 });
              console.log(`✅ [Discord Sync] Permiso creado en categoría ${sector.name}`);
            } else {
              await (category as any).permissionOverwrites.delete(user.discordUserId).catch(() => {});
            }
          } else {
            console.warn(`⚠️ [Discord Sync] Categoría no encontrada: ${sector.discordCategoryId}`);
          }
        }

        // Sincronizar cada canal según los permisos
        if (sector.discordFallasChannelId) {
          await setChannelPermission(sector.discordFallasChannelId, user.discordUserId, channelPerms.fallas);
        }
        if (sector.discordPreventivosChannelId) {
          await setChannelPermission(sector.discordPreventivosChannelId, user.discordUserId, channelPerms.preventivos);
        }
        if (sector.discordOTChannelId) {
          await setChannelPermission(sector.discordOTChannelId, user.discordUserId, channelPerms.ot);
        }
        if (sector.discordGeneralChannelId) {
          await setChannelPermission(sector.discordGeneralChannelId, user.discordUserId, channelPerms.general);
        }

        details.push(`✅ ${sector.name}: ${action === 'grant' ? 'Acceso otorgado' : 'Acceso revocado'}`);
        successCount++;
      } catch (sectorError: any) {
        details.push(`❌ ${sector.name}: ${sectorError.message}`);
      }
    }

    return {
      success: successCount > 0,
      message: `${action === 'grant' ? 'Otorgado' : 'Revocado'} acceso a ${successCount}/${sectorsWithDiscord.length} sectores`,
      details
    };
  } catch (error: any) {
    console.error('❌ Error en syncUserDiscordAccess:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Sincroniza todos los accesos de un usuario
 * Útil cuando se vincula Discord por primera vez
 */
export async function syncAllUserAccess(userId: number): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const accesses = await prisma.userDiscordAccess.findMany({
      where: { userId },
      select: { sectorId: true }
    });

    if (accesses.length === 0) {
      return { success: true, message: 'Usuario no tiene accesos configurados' };
    }

    const sectorIds = accesses.map(a => a.sectorId);
    return syncUserDiscordAccess(userId, 'grant', sectorIds);
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Revoca TODOS los accesos de un usuario en Discord
 * Útil cuando se desvincula Discord o se desactiva el usuario
 */
export async function revokeAllUserAccess(userId: number): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const accesses = await prisma.userDiscordAccess.findMany({
      where: { userId },
      select: { sectorId: true }
    });

    if (accesses.length === 0) {
      return { success: true, message: 'Usuario no tenía accesos' };
    }

    const sectorIds = accesses.map(a => a.sectorId);
    return syncUserDiscordAccess(userId, 'revoke', sectorIds);
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
