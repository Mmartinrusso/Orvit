/**
 * Discord Permissions Sync
 *
 * Sincroniza los permisos de usuarios en Discord basándose en UserDiscordAccess
 * Ahora delega al bot service que corre en Railway
 */

import { prisma } from '@/lib/prisma';
import { syncBotPermissions, callBotService } from './bot-service-client';

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
    const result = await callBotService('/api/sync-permissions', {
      discordUserId,
      sectorId,
      permissions,
    });

    if (!result.success) {
      return { success: false, message: result.error || 'Error syncing permissions' };
    }

    return {
      success: true,
      message: result.message || 'Permisos actualizados',
    };
  } catch (error: any) {
    console.error('Error en syncChannelPermissions:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Sincroniza el acceso de un usuario a sectores en Discord
 * Respeta los permisos granulares por tipo de canal
 */
export async function syncUserDiscordAccess(
  userId: number,
  action: 'grant' | 'revoke',
  sectorIds: number[]
): Promise<{ success: boolean; message: string; details?: string[] }> {
  try {
    const details: string[] = [];
    let successCount = 0;

    for (const sectorId of sectorIds) {
      const result = await syncBotPermissions(userId, sectorId, action);

      if (result.success) {
        details.push(`✅ Sector ${sectorId}: ${action === 'grant' ? 'Acceso otorgado' : 'Acceso revocado'}`);
        successCount++;
      } else {
        details.push(`❌ Sector ${sectorId}: ${result.error || 'Error'}`);
      }
    }

    return {
      success: successCount > 0,
      message: `${action === 'grant' ? 'Otorgado' : 'Revocado'} acceso a ${successCount}/${sectorIds.length} sectores`,
      details,
    };
  } catch (error: any) {
    console.error('❌ Error en syncUserDiscordAccess:', error);
    return {
      success: false,
      message: `Error: ${error.message}`,
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
      select: { sectorId: true },
    });

    if (accesses.length === 0) {
      return { success: true, message: 'Usuario no tiene accesos configurados' };
    }

    const sectorIds = accesses.map((a) => a.sectorId);
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
      select: { sectorId: true },
    });

    if (accesses.length === 0) {
      return { success: true, message: 'Usuario no tenía accesos' };
    }

    const sectorIds = accesses.map((a) => a.sectorId);
    return syncUserDiscordAccess(userId, 'revoke', sectorIds);
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
