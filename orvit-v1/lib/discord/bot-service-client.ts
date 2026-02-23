/**
 * Bot Service HTTP Client
 *
 * Cliente para comunicarse con el bot de Discord que corre
 * como servicio separado en Railway.
 *
 * Reemplaza las llamadas directas a discord.js que antes
 * corrían dentro del proceso Next.js.
 */

const BOT_SERVICE_URL = process.env.BOT_SERVICE_URL;
const BOT_API_KEY = process.env.BOT_API_KEY;

interface BotServiceResponse {
  success: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Hace una llamada HTTP al bot service
 */
export async function callBotService(
  path: string,
  body?: any,
  method: 'GET' | 'POST' = 'POST'
): Promise<BotServiceResponse> {
  if (!BOT_SERVICE_URL) {
    console.warn('[BotService] BOT_SERVICE_URL no configurada');
    return { success: false, error: 'BOT_SERVICE_URL no configurada' };
  }

  try {
    const url = `${BOT_SERVICE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(BOT_API_KEY ? { 'x-api-key': BOT_API_KEY } : {}),
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    };

    if (method === 'POST' && body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.error(`[BotService] Timeout llamando ${path}`);
      return { success: false, error: 'Timeout (10s)' };
    }

    console.error(`[BotService] Error llamando ${path}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envía un DM a un usuario vía el bot service
 */
export async function sendDMViaBotService(
  userId: number,
  options: {
    content?: string;
    embed?: {
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      footer?: string;
      timestamp?: boolean;
    };
    buttons?: Array<{
      customId: string;
      label: string;
      style: 'primary' | 'secondary' | 'success' | 'danger';
      emoji?: string;
    }>;
  }
): Promise<{ success: boolean; error?: string }> {
  return callBotService('/api/send-dm', { userId, options });
}

/**
 * Envía un mensaje a un canal vía el bot service
 */
export async function sendToChannelViaBotService(
  channelId: string,
  options: {
    content?: string;
    embed?: {
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      footer?: string;
      timestamp?: boolean;
    };
  }
): Promise<{ success: boolean; error?: string }> {
  return callBotService('/api/send-channel', { channelId, options });
}

/**
 * Envía una notificación smart-routed vía el bot service
 */
export async function sendNotificationViaBotService(
  sectorId: number,
  type: string,
  embed: any,
  username?: string
): Promise<{ success: boolean; error?: string }> {
  return callBotService('/api/send-notification', { sectorId, type, embed, username });
}

/**
 * Obtiene el estado del bot
 */
export async function getBotServiceStatus(): Promise<BotServiceResponse> {
  return callBotService('/api/status', undefined, 'GET');
}

/**
 * Gestiona canales vía el bot service
 */
export async function manageBotChannels(
  action: string,
  params: any
): Promise<BotServiceResponse> {
  return callBotService('/api/manage-channels', { action, params });
}

/**
 * Sincroniza permisos de Discord vía el bot service
 */
export async function syncBotPermissions(
  userId: number,
  sectorId: number,
  action: 'grant' | 'revoke'
): Promise<BotServiceResponse> {
  return callBotService('/api/sync-permissions', { userId, sectorId, action });
}

/**
 * Envía un DM usando directamente el Discord User ID (string)
 * Útil para crons de agenda que ya tienen el discordUserId resuelto
 */
export async function sendDMByDiscordIdViaBotService(
  discordUserId: string,
  options: {
    content?: string;
    embed?: {
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      footer?: string;
      timestamp?: boolean;
    };
    buttons?: Array<{
      customId: string;
      label: string;
      style: 'primary' | 'secondary' | 'success' | 'danger';
      emoji?: string;
    }>;
  }
): Promise<{ success: boolean; error?: string }> {
  return callBotService('/api/send-dm', { discordUserId, options });
}

/**
 * Verifica acceso de un usuario a múltiples canales de Discord
 */
export async function checkChannelAccessViaBotService(
  guildId: string,
  discordUserId: string,
  channelIds: string[]
): Promise<{ success: boolean; access: Record<string, boolean>; error?: string }> {
  const result = await callBotService('/api/check-channel-access', { guildId, discordUserId, channelIds });
  return { success: result.success, access: result.access || {}, error: result.error };
}

/**
 * Operaciones de guild (check member, create invite)
 */
export async function guildOperationsViaBotService(
  action: 'checkMember' | 'createInvite',
  guildId: string,
  discordUserId?: string,
  reason?: string
): Promise<BotServiceResponse> {
  return callBotService('/api/guild-operations', { action, guildId, discordUserId, reason });
}
