/**
 * Discord Webhook Client
 * Cliente simple para enviar mensajes a Discord usando webhooks
 *
 * Los webhooks de Discord son URLs únicas que permiten enviar mensajes
 * a un canal específico sin necesidad de un bot o autenticación OAuth.
 *
 * Formato de URL: https://discord.com/api/webhooks/{webhook_id}/{webhook_token}
 */

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number; // Color en formato decimal (ej: 0xFF0000 para rojo)
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
    icon_url?: string;
  };
  timestamp?: string; // ISO 8601 timestamp
  thumbnail?: {
    url: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
}

export interface DiscordMessage {
  content?: string; // Mensaje de texto plano (opcional si hay embeds)
  embeds?: DiscordEmbed[]; // Array de embeds (máximo 10)
  username?: string; // Nombre personalizado del webhook
  avatar_url?: string; // Avatar personalizado del webhook
}

// Colores predefinidos para diferentes tipos de notificaciones
export const DISCORD_COLORS = {
  ERROR: 0xED4245,      // Rojo
  WARNING: 0xFEE75C,    // Amarillo
  SUCCESS: 0x57F287,    // Verde
  INFO: 0x5865F2,       // Azul Discord
  CRITICAL: 0x992D22,   // Rojo oscuro
  PREVENTIVE: 0x3498DB, // Azul claro
  WORK_ORDER: 0xE67E22, // Naranja
  SUMMARY: 0x9B59B6,    // Púrpura
};

// Emojis para diferentes tipos de notificaciones
export const DISCORD_EMOJIS = {
  FALLA: '🔴',
  PREVENTIVO: '🔧',
  OT_NUEVA: '📋',
  OT_ASIGNADA: '👤',
  OT_COMPLETADA: '✅',
  OT_EN_ESPERA: '⏸️',
  URGENTE: '🚨',
  ALTA: '🔶',
  MEDIA: '🔵',
  BAJA: '⚪',
  RESUMEN: '📊',
  DOWNTIME: '⏱️',
  MAQUINA: '🏭',
};

/**
 * Envía un mensaje a un webhook de Discord
 *
 * @param webhookUrl - URL completa del webhook de Discord
 * @param message - Mensaje a enviar (texto plano o con embeds)
 * @returns Promise con el resultado de la operación
 */
export async function sendDiscordMessage(
  webhookUrl: string,
  message: DiscordMessage
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl || !webhookUrl.includes('discord.com/api/webhooks')) {
    return { success: false, error: 'URL de webhook inválida' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (response.ok) {
      return { success: true };
    }

    // Discord puede retornar 204 No Content en éxito
    if (response.status === 204) {
      return { success: true };
    }

    // Manejar errores de Discord
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.message || `Error ${response.status}`;

    console.error('[Discord] Error enviando mensaje:', errorMessage);
    return { success: false, error: errorMessage };

  } catch (error: any) {
    console.error('[Discord] Error de red:', error.message);
    return { success: false, error: error.message || 'Error de conexión' };
  }
}

/**
 * Valida que una URL sea un webhook de Discord válido
 *
 * @param webhookUrl - URL a validar
 * @returns true si la URL es válida
 */
export function isValidDiscordWebhook(webhookUrl: string): boolean {
  if (!webhookUrl) return false;

  // Patrón: https://discord.com/api/webhooks/{id}/{token}
  const pattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
  return pattern.test(webhookUrl);
}

/**
 * Prueba un webhook de Discord enviando un mensaje de prueba
 *
 * @param webhookUrl - URL del webhook a probar
 * @returns Promise con el resultado del test
 */
export async function testDiscordWebhook(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidDiscordWebhook(webhookUrl)) {
    return { success: false, error: 'URL de webhook inválida' };
  }

  return sendDiscordMessage(webhookUrl, {
    content: '✅ **Webhook conectado exitosamente**\n\nEste canal recibirá notificaciones del sistema de mantenimiento.',
    username: 'ORVIT Mantenimiento',
  });
}
