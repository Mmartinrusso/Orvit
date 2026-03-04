/**
 * Servicio de Notificaciones Discord
 *
 * Funciones para enviar notificaciones a Discord para diferentes eventos:
 * - Nueva falla reportada
 * - Falla resuelta
 * - Nueva orden de trabajo
 * - OT asignada
 * - OT completada
 * - Preventivos del día
 * - Resumen del día
 *
 * Soporta:
 * - Webhooks (sin necesidad de bot)
 * - Canal directo via bot (cuando channel IDs están configurados)
 * - DMs a técnicos via bot
 */

import { prisma } from '@/lib/prisma';
import {
  sendDiscordMessage,
  DISCORD_COLORS,
  DISCORD_EMOJIS,
  type DiscordEmbed,
} from './client';
import {
  sendDMViaBotService,
  sendNotificationViaBotService,
  sendToChannelViaBotService,
} from './bot-service-client';

// Re-export DMMessageOptions type for backward compatibility
export interface DMMessageOptions {
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

// Tipos de notificación
type NotificationType =
  | 'FALLA_NUEVA'
  | 'FALLA_RESUELTA'
  | 'OT_CREADA'
  | 'OT_ASIGNADA'
  | 'OT_COMPLETADA'
  | 'PREVENTIVO_RECORDATORIO'
  | 'PREVENTIVO_COMPLETADO'
  | 'RESUMEN_DIA'
  | 'RUTINA_RECORDATORIO';

interface DiscordDestination {
  webhookUrl: string | null;
  channelId: string | null;
}

/**
 * Obtiene el webhook y/o channel ID de Discord para un sector y tipo de notificación
 */
async function getDiscordDestination(
  sectorId: number,
  type: NotificationType
): Promise<DiscordDestination> {
  const sector = await prisma.sector.findUnique({
    where: { id: sectorId },
    select: {
      discordFallasWebhook: true,
      discordPreventivosWebhook: true,
      discordOrdenesTrabajoWebhook: true,
      discordResumenDiaWebhook: true,
      discordFallasChannelId: true,
      discordPreventivosChannelId: true,
      discordOTChannelId: true,
      discordGeneralChannelId: true,
    },
  });

  if (!sector) return { webhookUrl: null, channelId: null };

  switch (type) {
    case 'FALLA_NUEVA':
    case 'FALLA_RESUELTA':
      return {
        webhookUrl: sector.discordFallasWebhook,
        channelId: sector.discordFallasChannelId,
      };
    case 'PREVENTIVO_RECORDATORIO':
    case 'PREVENTIVO_COMPLETADO':
      return {
        webhookUrl: sector.discordPreventivosWebhook,
        channelId: sector.discordPreventivosChannelId,
      };
    case 'OT_CREADA':
    case 'OT_ASIGNADA':
    case 'OT_COMPLETADA':
      return {
        webhookUrl: sector.discordOrdenesTrabajoWebhook,
        channelId: sector.discordOTChannelId,
      };
    case 'RESUMEN_DIA':
    case 'INICIO_DIA':
      return {
        webhookUrl: null, // Ya no usamos webhooks para estos
        channelId: sector.discordGeneralChannelId,
      };
    case 'RUTINA_RECORDATORIO':
      return {
        webhookUrl: null,
        channelId: sector.discordGeneralChannelId,
      };
    default:
      return { webhookUrl: null, channelId: null };
  }
}

/**
 * Envía un mensaje a Discord usando bot service o webhook según disponibilidad
 * Prioridad: Bot service (Railway) > Webhook (local)
 */
async function sendNotification(
  sectorId: number,
  type: NotificationType,
  embed: DiscordEmbed,
  username: string
): Promise<void> {
  const destination = await getDiscordDestination(sectorId, type);

  console.log(`📤 [Discord] sendNotification tipo=${type}, sectorId=${sectorId}`);

  // Intentar enviar via bot service (Railway) si hay channel ID
  if (destination.channelId) {
    console.log(`📨 [Discord] Enviando via bot service a canal ${destination.channelId}...`);
    const result = await sendToChannelViaBotService(destination.channelId, {
      embed: {
        title: embed.title,
        description: embed.description,
        color: embed.color,
        fields: embed.fields,
        footer: embed.footer?.text,
        timestamp: !!embed.timestamp,
      },
    });

    if (result.success) {
      console.log('✅ [Discord] Mensaje enviado via bot service');
      return;
    }
    console.warn(`⚠️ [Discord] Fallo envío via bot service: ${result.error}`);
    // Si falla, intentar con webhook
  }

  // Fallback: enviar via webhook (stateless, no necesita bot)
  if (destination.webhookUrl) {
    console.log('📨 [Discord] Enviando via webhook (fallback)...');
    await sendDiscordMessage(destination.webhookUrl, {
      embeds: [embed],
      username,
    });
    console.log('✅ [Discord] Mensaje enviado via webhook');
    return;
  }

  // Sin medio disponible
  if (!destination.channelId && !destination.webhookUrl) {
    console.warn(`⚠️ [Discord] Sector ${sectorId} no tiene Discord configurado para ${type}`);
  }
}

/**
 * Envía una notificación de recordatorio de rutina al canal de un sector
 */
export async function sendNotificationToSector(
  sectorId: number,
  embed: { title: string; description: string; color: number }
): Promise<void> {
  await sendNotification(sectorId, 'RUTINA_RECORDATORIO', {
    title: embed.title,
    description: embed.description,
    color: embed.color,
    timestamp: new Date().toISOString(),
  }, 'ORVIT — Rutinas');
}

/**
 * Envía un DM a un técnico por su userId de ORVIT
 * Usa el bot service externo (Railway) para enviar el DM
 */
export async function sendTechnicianDM(
  userId: number,
  options: DMMessageOptions
): Promise<{ success: boolean; error?: string }> {
  return sendDMViaBotService(userId, options);
}

/**
 * Mapea prioridad a emoji y color
 */
function getPriorityStyle(priority: string): { emoji: string; color: number } {
  switch (priority?.toUpperCase()) {
    case 'P1':
    case 'URGENT':
    case 'CRITICAL':
      return { emoji: DISCORD_EMOJIS.URGENTE, color: DISCORD_COLORS.CRITICAL };
    case 'P2':
    case 'HIGH':
      return { emoji: DISCORD_EMOJIS.ALTA, color: DISCORD_COLORS.ERROR };
    case 'P3':
    case 'MEDIUM':
      return { emoji: DISCORD_EMOJIS.MEDIA, color: DISCORD_COLORS.WARNING };
    default:
      return { emoji: DISCORD_EMOJIS.BAJA, color: DISCORD_COLORS.INFO };
  }
}

// ============================================================================
// NOTIFICACIONES DE FALLAS
// ============================================================================

export interface NewFailureData {
  id: number;
  title: string;
  machineName: string;
  machineId: number;
  sectorId: number;
  priority: string;
  category?: string;
  component?: string;
  subComponent?: string;
  reportedBy: string;
  causedDowntime?: boolean;
  description?: string;
}

/**
 * Notifica una nueva falla reportada
 */
export async function notifyNewFailure(data: NewFailureData): Promise<void> {
  const { emoji, color } = getPriorityStyle(data.priority);
  const downtimeText = data.causedDowntime
    ? `\n\n⚠️ Producción detenida`
    : '';

  // URL base de la app (usar env o default)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://orvit.app';
  const failureUrl = `${baseUrl}/mantenimiento/incidentes/${data.id}`;

  // Construir ubicación: Máquina > Componente > Subcomponente
  let ubicacion = data.machineName;
  if (data.component) {
    ubicacion += ` › ${data.component}`;
    if (data.subComponent) {
      ubicacion += ` › ${data.subComponent}`;
    }
  }

  const embed: DiscordEmbed = {
    title: `🔴 Nueva Falla — ${data.machineName}`,
    description: `**${data.title}**${downtimeText}`,
    color,
    fields: [
      { name: '🏭 Ubicación', value: ubicacion, inline: false },
      { name: `${emoji} Prioridad`, value: data.priority, inline: true },
      { name: '📂 Categoría', value: data.category || 'Sin categoría', inline: true },
      { name: '👤 Reportó', value: data.reportedBy, inline: true },
      { name: '🔗 Ver falla', value: `[Abrir en ORVIT](${failureUrl})` },
    ],
    footer: { text: `Falla #${data.id}` },
    timestamp: new Date().toISOString(),
  };

  if (data.description) {
    // Insertar descripción antes del link
    embed.fields?.splice(4, 0, { name: '📝 Descripción', value: data.description.substring(0, 200) });
  }

  await sendNotification(data.sectorId, 'FALLA_NUEVA', embed, 'ORVIT - Fallas');
}

export interface FailureResolvedData {
  id: number;
  title: string;
  machineName: string;
  sectorId: number;
  resolvedBy: string;
  resolutionTime?: string;
  solution?: string;
  component?: string;
  subComponent?: string;
}

/**
 * Notifica que una falla fue resuelta
 */
export async function notifyFailureResolved(data: FailureResolvedData): Promise<void> {
  // URL base de la app
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://orvit.app';
  const failureUrl = `${baseUrl}/mantenimiento/incidentes/${data.id}`;

  // Construir ubicación: Máquina > Componente > Subcomponente
  let ubicacion = data.machineName;
  if (data.component) {
    ubicacion += ` › ${data.component}`;
    if (data.subComponent) {
      ubicacion += ` › ${data.subComponent}`;
    }
  }

  const embed: DiscordEmbed = {
    title: `✅ Falla Resuelta — ${data.machineName}`,
    description: `**${data.title}**`,
    color: DISCORD_COLORS.SUCCESS,
    fields: [
      { name: '🏭 Ubicación', value: ubicacion, inline: false },
      { name: '👤 Resuelto por', value: data.resolvedBy, inline: true },
    ],
    footer: { text: `Falla #${data.id}` },
    timestamp: new Date().toISOString(),
  };

  if (data.resolutionTime) {
    embed.fields?.push({ name: '⏱️ Tiempo resolución', value: data.resolutionTime, inline: true });
  }

  if (data.solution) {
    embed.fields?.push({ name: '🔨 Solución', value: data.solution.substring(0, 300) });
  }

  embed.fields?.push({ name: '🔗 Ver falla', value: `[Abrir en ORVIT](${failureUrl})` });

  await sendNotification(data.sectorId, 'FALLA_RESUELTA', embed, 'ORVIT - Fallas');
}

// ============================================================================
// NOTIFICACIONES DE ÓRDENES DE TRABAJO
// ============================================================================

export interface NewWorkOrderData {
  id: number;
  title: string;
  type: string;
  priority: string;
  machineName?: string;
  sectorId: number;
  assignedTo?: string;
  scheduledDate?: string;
  origin?: string;
}

/**
 * Notifica una nueva orden de trabajo creada
 */
export async function notifyOTCreated(data: NewWorkOrderData): Promise<void> {
  const { emoji, color } = getPriorityStyle(data.priority);

  const embed: DiscordEmbed = {
    title: `${DISCORD_EMOJIS.OT_NUEVA} Nueva Orden de Trabajo`,
    description: `**${data.title}**`,
    color,
    fields: [
      { name: '📂 Tipo', value: data.type, inline: true },
      { name: `${emoji} Prioridad`, value: data.priority, inline: true },
    ],
    footer: { text: `OT #${data.id}` },
    timestamp: new Date().toISOString(),
  };

  if (data.machineName) {
    embed.fields?.push({ name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true });
  }

  if (data.assignedTo) {
    embed.fields?.push({ name: `${DISCORD_EMOJIS.OT_ASIGNADA} Asignado a`, value: data.assignedTo, inline: true });
  }

  if (data.scheduledDate) {
    embed.fields?.push({ name: '📅 Programado', value: data.scheduledDate, inline: true });
  }

  if (data.origin) {
    embed.fields?.push({ name: '🔗 Origen', value: data.origin, inline: true });
  }

  await sendNotification(data.sectorId, 'OT_CREADA', embed, 'ORVIT - Órdenes de Trabajo');
}

export interface OTAssignedData {
  id: number;
  title: string;
  priority: string;
  machineName?: string;
  sectorId: number;
  assignedTo: string;
  assignedToId?: number; // ID del usuario para enviar DM
  assignedBy: string;
  scheduledDate?: string;
  slaDeadline?: string;
  description?: string;
}

/**
 * Notifica que una OT fue asignada
 * - Envía notificación al canal de OTs
 * - Envía DM al técnico asignado (si tiene Discord vinculado)
 */
export async function notifyOTAssigned(data: OTAssignedData): Promise<void> {
  const { emoji, color } = getPriorityStyle(data.priority);

  const embed: DiscordEmbed = {
    title: `${DISCORD_EMOJIS.OT_ASIGNADA} OT Asignada`,
    description: `**${data.title}**`,
    color,
    fields: [
      { name: `${emoji} Prioridad`, value: data.priority, inline: true },
      { name: '👤 Asignado a', value: data.assignedTo, inline: true },
      { name: '👤 Asignado por', value: data.assignedBy, inline: true },
    ],
    footer: { text: `OT #${data.id}` },
    timestamp: new Date().toISOString(),
  };

  if (data.machineName) {
    embed.fields?.push({ name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true });
  }

  if (data.scheduledDate) {
    embed.fields?.push({ name: '📅 Programado', value: data.scheduledDate, inline: true });
  }

  if (data.slaDeadline) {
    embed.fields?.push({ name: '⏰ SLA', value: data.slaDeadline, inline: true });
  }

  // 1. Enviar a canal de OTs
  await sendNotification(data.sectorId, 'OT_ASIGNADA', embed, 'ORVIT - Órdenes de Trabajo');

  // 2. Enviar DM al técnico asignado
  if (data.assignedToId) {
    try {
      const dmEmbed = {
        title: `📋 Nueva asignación - OT #${data.id}`,
        description: data.description?.substring(0, 300) || data.title,
        color,
        fields: [
          ...(data.machineName ? [{ name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true }] : []),
          { name: `${emoji} Prioridad`, value: data.priority, inline: true },
          ...(data.scheduledDate ? [{ name: '📅 Programado', value: data.scheduledDate, inline: true }] : []),
          ...(data.slaDeadline ? [{ name: '⏰ SLA', value: data.slaDeadline, inline: true }] : []),
        ],
        footer: `Asignado por ${data.assignedBy}`,
        timestamp: true,
      };

      const dmResult = await sendTechnicianDM(data.assignedToId, { embed: dmEmbed });
      if (!dmResult.success) {
        console.warn(`⚠️ [notifyOTAssigned] DM falló para técnico ${data.assignedToId} (OT #${data.id}): ${dmResult.error}`);
      }
    } catch (dmError) {
      console.warn(`⚠️ [notifyOTAssigned] Error enviando DM a técnico ${data.assignedToId} (OT #${data.id}):`, dmError);
    }
  }
}

export interface OTCompletedData {
  id: number;
  title: string;
  machineName?: string;
  sectorId: number;
  completedBy: string;
  diagnosis?: string;
  solution?: string;
  result?: string;
  duration?: string;
}

/**
 * Notifica que una OT fue completada
 */
export async function notifyOTCompleted(data: OTCompletedData): Promise<void> {
  const embed: DiscordEmbed = {
    title: `${DISCORD_EMOJIS.OT_COMPLETADA} OT Completada`,
    description: `**${data.title}**`,
    color: DISCORD_COLORS.SUCCESS,
    fields: [
      { name: '👤 Completado por', value: data.completedBy, inline: true },
    ],
    footer: { text: `OT #${data.id}` },
    timestamp: new Date().toISOString(),
  };

  if (data.machineName) {
    embed.fields?.push({ name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true });
  }

  if (data.duration) {
    embed.fields?.push({ name: '⏱️ Duración', value: data.duration, inline: true });
  }

  if (data.result) {
    embed.fields?.push({ name: '📊 Resultado', value: data.result, inline: true });
  }

  if (data.diagnosis) {
    embed.fields?.push({ name: '🔍 Diagnóstico', value: data.diagnosis.substring(0, 300) });
  }

  if (data.solution) {
    embed.fields?.push({ name: '🔨 Solución', value: data.solution.substring(0, 300) });
  }

  await sendNotification(data.sectorId, 'OT_COMPLETADA', embed, 'ORVIT - Órdenes de Trabajo');
}

// ============================================================================
// NOTIFICACIONES DE PREVENTIVOS
// ============================================================================

export interface PreventiveReminderData {
  title: string;
  machineName: string;
  sectorId: number;
  scheduledDate: string;
  daysUntil: number;
  assignedTo?: string;
}

/**
 * Notifica un recordatorio de mantenimiento preventivo
 */
export async function notifyPreventiveReminder(data: PreventiveReminderData): Promise<void> {
  const urgencyEmoji = data.daysUntil <= 1 ? '🚨' : data.daysUntil <= 3 ? '⚠️' : '📅';
  const urgencyColor = data.daysUntil <= 1 ? DISCORD_COLORS.ERROR : data.daysUntil <= 3 ? DISCORD_COLORS.WARNING : DISCORD_COLORS.PREVENTIVE;

  const embed: DiscordEmbed = {
    title: `${DISCORD_EMOJIS.PREVENTIVO} Recordatorio de Preventivo`,
    description: `**${data.title}**`,
    color: urgencyColor,
    fields: [
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
      { name: `${urgencyEmoji} Días restantes`, value: `${data.daysUntil} día(s)`, inline: true },
      { name: '📅 Fecha programada', value: data.scheduledDate, inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  if (data.assignedTo) {
    embed.fields?.push({ name: '👤 Asignado a', value: data.assignedTo, inline: true });
  }

  await sendNotification(data.sectorId, 'PREVENTIVO_RECORDATORIO', embed, 'ORVIT - Preventivos');
}

export interface PreventiveCompletedData {
  templateId: number;
  title: string;
  machineName: string;
  sectorId: number;
  completedBy: string;
  nextDate: string;
  notes?: string;
}

/**
 * Notifica que un mantenimiento preventivo fue completado
 */
export async function notifyPreventiveCompleted(data: PreventiveCompletedData): Promise<void> {
  const embed: DiscordEmbed = {
    title: `${DISCORD_EMOJIS.OT_COMPLETADA} Preventivo Completado`,
    description: `**${data.title}**`,
    color: DISCORD_COLORS.SUCCESS,
    fields: [
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
      { name: '👤 Completado por', value: data.completedBy, inline: true },
      { name: '📅 Próximo', value: data.nextDate, inline: true },
    ],
    footer: { text: `Template #${data.templateId}` },
    timestamp: new Date().toISOString(),
  };

  if (data.notes) {
    embed.fields?.push({ name: '📝 Notas', value: data.notes.substring(0, 300) });
  }

  await sendNotification(data.sectorId, 'PREVENTIVO_COMPLETADO', embed, 'ORVIT - Preventivos');
}

// ============================================================================
// RESUMEN DEL DÍA
// ============================================================================

export interface DailySummaryData {
  sectorId: number;
  sectorName: string;
  date: string;
  stats: {
    newFailures: number;
    resolvedFailures: number;
    pendingFailures: number;
    completedOTs: number;
    pendingOTs: number;
    waitingOTs: number;
    completedPreventives: number;
    scheduledPreventives: number;
    totalDowntimeMinutes?: number;
  };
  pendingItems?: Array<{ type: string; title: string }>;
}

/**
 * Envía el resumen diario a Discord
 */
export async function sendDailySummary(data: DailySummaryData): Promise<void> {
  const preventiveCumplimiento = data.stats.scheduledPreventives > 0
    ? Math.round((data.stats.completedPreventives / data.stats.scheduledPreventives) * 100)
    : 100;

  const embed: DiscordEmbed = {
    title: `${DISCORD_EMOJIS.RESUMEN} Resumen del Día - ${data.date}`,
    description: `**Sector: ${data.sectorName}**`,
    color: DISCORD_COLORS.SUMMARY,
    fields: [
      {
        name: `${DISCORD_EMOJIS.FALLA} Fallas`,
        value: `📥 Nuevas: ${data.stats.newFailures}\n✅ Resueltas: ${data.stats.resolvedFailures}\n⏳ Pendientes: ${data.stats.pendingFailures}`,
        inline: true,
      },
      {
        name: `${DISCORD_EMOJIS.OT_NUEVA} Órdenes de Trabajo`,
        value: `✅ Completadas: ${data.stats.completedOTs}\n⏳ En progreso: ${data.stats.pendingOTs}\n${DISCORD_EMOJIS.OT_EN_ESPERA} En espera: ${data.stats.waitingOTs}`,
        inline: true,
      },
      {
        name: `${DISCORD_EMOJIS.PREVENTIVO} Preventivos`,
        value: `✅ Completados: ${data.stats.completedPreventives}/${data.stats.scheduledPreventives}\n📊 Cumplimiento: ${preventiveCumplimiento}%`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  if (data.stats.totalDowntimeMinutes && data.stats.totalDowntimeMinutes > 0) {
    const hours = Math.floor(data.stats.totalDowntimeMinutes / 60);
    const mins = data.stats.totalDowntimeMinutes % 60;
    embed.fields?.push({
      name: `${DISCORD_EMOJIS.DOWNTIME} Downtime Total`,
      value: `${hours}h ${mins}min`,
      inline: true,
    });
  }

  if (data.pendingItems && data.pendingItems.length > 0) {
    const pendingList = data.pendingItems
      .slice(0, 5)
      .map(item => `• ${item.type}: ${item.title}`)
      .join('\n');
    embed.fields?.push({
      name: '📌 Pendientes para mañana',
      value: pendingList + (data.pendingItems.length > 5 ? `\n...y ${data.pendingItems.length - 5} más` : ''),
    });
  }

  await sendNotification(data.sectorId, 'RESUMEN_DIA', embed, 'ORVIT - Resumen');
}

// ============================================================================
// NOTIFICACIONES DE SLA (Fase 2)
// ============================================================================

/**
 * Umbrales de alerta SLA según prioridad (en horas)
 * P1: < 1 hora para vencer
 * P2: < 4 horas para vencer
 * P3: < 24 horas para vencer
 * P4: Solo en resumen diario
 */
export const SLA_WARNING_THRESHOLDS = {
  P1: 1,
  P2: 4,
  P3: 24,
  P4: null, // No alertar, solo resumen
};

/**
 * Umbrales para fallas sin asignar (en minutos)
 * P1: > 15 minutos
 * P2: > 60 minutos
 * P3: Solo en resumen
 * P4: No avisar
 */
export const UNASSIGNED_FAILURE_THRESHOLDS = {
  P1: 15,
  P2: 60,
  P3: null, // Solo resumen
  P4: null, // No avisar
};

export interface SLAAlertData {
  workOrderId: number;
  title: string;
  machineName?: string;
  sectorId: number;
  priority: string;
  assignedTo?: string;
  assignedToId?: number;
  hoursRemaining?: number;  // Para AT_RISK
  hoursOverdue?: number;    // Para BREACHED
  slaDueAt: string;
}

/**
 * Notifica SLA en riesgo (próximo a vencer)
 * Canal: #ordenes-trabajo
 * DM: Técnico asignado
 */
export async function notifySLAAtRisk(data: SLAAlertData): Promise<void> {
  const { emoji, color } = getPriorityStyle(data.priority);
  const hoursText = data.hoursRemaining !== undefined
    ? data.hoursRemaining < 1
      ? `${Math.round(data.hoursRemaining * 60)} minutos`
      : `${Math.round(data.hoursRemaining * 10) / 10} horas`
    : 'poco tiempo';

  const embed: DiscordEmbed = {
    title: `⚠️ SLA en Riesgo - OT #${data.workOrderId}`,
    description: `**${data.title}**\n\n⏳ Quedan **${hoursText}** para el vencimiento`,
    color: DISCORD_COLORS.WARNING,
    fields: [
      { name: `${emoji} Prioridad`, value: data.priority, inline: true },
      { name: '⏰ Vence', value: new Date(data.slaDueAt).toLocaleString('es-AR'), inline: true },
    ],
    footer: { text: `OT #${data.workOrderId}` },
    timestamp: new Date().toISOString(),
  };

  if (data.machineName) {
    embed.fields?.push({ name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true });
  }

  if (data.assignedTo) {
    embed.fields?.push({ name: '👤 Asignado a', value: data.assignedTo, inline: true });
  }

  // 1. Enviar a canal de OTs
  await sendNotification(data.sectorId, 'OT_ASIGNADA', embed, 'ORVIT - SLA');

  // 2. Enviar DM al técnico asignado
  if (data.assignedToId) {
    const dmEmbed = {
      title: `⚠️ SLA en Riesgo - OT #${data.workOrderId}`,
      description: `Tu orden "${data.title}" está por vencer.\n\n⏳ **${hoursText}** restantes`,
      color: DISCORD_COLORS.WARNING,
      fields: [
        { name: `${emoji} Prioridad`, value: data.priority, inline: true },
        { name: '⏰ Vence', value: new Date(data.slaDueAt).toLocaleString('es-AR'), inline: true },
        ...(data.machineName ? [{ name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true }] : []),
      ],
      footer: 'Acción requerida',
      timestamp: true,
    };

    await sendTechnicianDM(data.assignedToId, { embed: dmEmbed });
  }
}

/**
 * Notifica SLA vencido (excedido)
 * Canal: #ordenes-trabajo
 * DM: Técnico + Supervisor
 */
export async function notifySLABreached(data: SLAAlertData): Promise<void> {
  const { emoji } = getPriorityStyle(data.priority);
  const overdueText = data.hoursOverdue !== undefined
    ? data.hoursOverdue < 1
      ? `${Math.round(data.hoursOverdue * 60)} minutos`
      : `${Math.round(data.hoursOverdue * 10) / 10} horas`
    : 'tiempo';

  const embed: DiscordEmbed = {
    title: `⛔ SLA Vencido - OT #${data.workOrderId}`,
    description: `**${data.title}**\n\n🚨 Vencido hace **${overdueText}**`,
    color: DISCORD_COLORS.CRITICAL,
    fields: [
      { name: `${emoji} Prioridad`, value: data.priority, inline: true },
      { name: '⏰ Venció', value: new Date(data.slaDueAt).toLocaleString('es-AR'), inline: true },
    ],
    footer: { text: `OT #${data.workOrderId}` },
    timestamp: new Date().toISOString(),
  };

  if (data.machineName) {
    embed.fields?.push({ name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true });
  }

  if (data.assignedTo) {
    embed.fields?.push({ name: '👤 Asignado a', value: data.assignedTo, inline: true });
  }

  // 1. Enviar a canal de OTs
  await sendNotification(data.sectorId, 'OT_ASIGNADA', embed, 'ORVIT - SLA');

  // 2. Enviar DM al técnico asignado
  if (data.assignedToId) {
    const dmEmbed = {
      title: `⛔ SLA Vencido - OT #${data.workOrderId}`,
      description: `Tu orden "${data.title}" **ha vencido**.\n\n🚨 Excedido hace **${overdueText}**`,
      color: DISCORD_COLORS.CRITICAL,
      fields: [
        { name: `${emoji} Prioridad`, value: data.priority, inline: true },
        ...(data.machineName ? [{ name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true }] : []),
      ],
      footer: '⚡ Atención urgente requerida',
      timestamp: true,
    };

    await sendTechnicianDM(data.assignedToId, { embed: dmEmbed });
  }
}

// ============================================================================
// NOTIFICACIONES DE FALLAS SIN ASIGNAR (Fase 2)
// ============================================================================

export interface UnassignedFailureData {
  failureId: number;
  title: string;
  machineName: string;
  sectorId: number;
  priority: string;
  minutesWaiting: number;
  reportedBy: string;
  causedDowntime?: boolean;
}

/**
 * Notifica falla sin asignar después del umbral
 * Canal: #fallas
 * DM: Supervisor del sector
 */
export async function notifyUnassignedFailure(data: UnassignedFailureData): Promise<void> {
  const { emoji, color } = getPriorityStyle(data.priority);
  const waitText = data.minutesWaiting < 60
    ? `${data.minutesWaiting} minutos`
    : `${Math.round(data.minutesWaiting / 60 * 10) / 10} horas`;

  const downtimeText = data.causedDowntime ? `\n\n${DISCORD_EMOJIS.DOWNTIME} **PRODUCCIÓN PARADA**` : '';

  const embed: DiscordEmbed = {
    title: `⏱️ Falla Sin Asignar - F-${data.failureId}`,
    description: `**${data.title}**${downtimeText}\n\n⚠️ Esperando asignación hace **${waitText}**`,
    color: data.priority === 'P1' ? DISCORD_COLORS.CRITICAL : DISCORD_COLORS.WARNING,
    fields: [
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
      { name: `${emoji} Prioridad`, value: data.priority, inline: true },
      { name: '👤 Reportado por', value: data.reportedBy, inline: true },
    ],
    footer: { text: `Falla #${data.failureId}` },
    timestamp: new Date().toISOString(),
  };

  // Enviar a canal de fallas
  await sendNotification(data.sectorId, 'FALLA_NUEVA', embed, 'ORVIT - Alertas');
}

// ============================================================================
// NOTIFICACIONES P1 A TÉCNICOS DEL SECTOR (Fase 2)
// ============================================================================

export interface P1FailureAlertData {
  failureId: number;
  title: string;
  machineName: string;
  sectorId: number;
  category?: string;
  reportedBy: string;
  causedDowntime?: boolean;
  description?: string;
}

/**
 * Envía DM a todos los técnicos del sector cuando hay una falla P1
 */
export async function notifyP1ToSectorTechnicians(
  data: P1FailureAlertData,
  technicianIds: number[]
): Promise<{ sent: number; failed: number }> {
  if (technicianIds.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const downtimeText = data.causedDowntime ? '\n\n🔥 **PRODUCCIÓN PARADA**' : '';

  const dmEmbed = {
    title: `🚨 FALLA CRÍTICA P1 - F-${data.failureId}`,
    description: `**${data.title}**${downtimeText}\n\nSe requiere atención inmediata en tu sector.`,
    color: DISCORD_COLORS.CRITICAL,
    fields: [
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
      { name: '📂 Categoría', value: data.category || 'Sin categoría', inline: true },
      { name: '👤 Reportó', value: data.reportedBy, inline: true },
    ],
    footer: `Falla #${data.failureId}`,
    timestamp: true,
  };

  if (data.description) {
    dmEmbed.fields.push({ name: '📝 Descripción', value: data.description.substring(0, 200), inline: false });
  }

  let sent = 0;
  let failed = 0;

  for (const techId of technicianIds) {
    const result = await sendTechnicianDM(techId, { embed: dmEmbed });
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

// ============================================================================
// NOTIFICACIONES DE REINCIDENCIA (Fase 3)
// ============================================================================

export interface RecurrenceAlertData {
  machineId: number;
  machineName: string;
  sectorId: number;
  category: string;
  component?: string;
  occurrenceCount: number;
  windowDays: number;
  relatedFailureIds: number[];
  latestFailureId: number;
  latestTitle: string;
}

/**
 * Notifica patrón de reincidencia detectado
 * Canal: #fallas
 * DM: Jefe de Mantenimiento
 */
export async function notifyRecurrence(data: RecurrenceAlertData): Promise<void> {
  const failureLinks = data.relatedFailureIds
    .map(id => `F-${id}`)
    .join(', ');

  const embed: DiscordEmbed = {
    title: `♻️ Reincidencia Detectada - ${data.machineName}`,
    description: `Se detectaron **${data.occurrenceCount} fallas** similares en los últimos **${data.windowDays} días**.\n\n⚠️ **Evaluar causa raíz**`,
    color: DISCORD_COLORS.WARNING,
    fields: [
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
      { name: '📂 Categoría', value: data.category, inline: true },
      { name: '🔢 Ocurrencias', value: `${data.occurrenceCount} en ${data.windowDays} días`, inline: true },
      { name: '🔗 Fallas relacionadas', value: failureLinks },
    ],
    footer: { text: `Última: F-${data.latestFailureId}` },
    timestamp: new Date().toISOString(),
  };

  if (data.component) {
    embed.fields?.splice(2, 0, { name: '🔩 Componente', value: data.component, inline: true });
  }

  await sendNotification(data.sectorId, 'FALLA_NUEVA', embed, 'ORVIT - Reincidencias');
}

// ============================================================================
// NOTIFICACIONES DE DOWNTIME (Fase 3)
// ============================================================================

export interface DowntimeEventData {
  machineId: number;
  machineName: string;
  sectorId: number;
  failureId?: number;
  failureTitle?: string;
  startedAt?: Date;
  endedAt?: Date;
  durationMinutes?: number;
  cause?: string;
}

/**
 * Notifica inicio de downtime (producción parada)
 * Canal: #fallas
 * DM: Supervisor
 */
export async function notifyDowntimeStart(data: DowntimeEventData): Promise<void> {
  const embed: DiscordEmbed = {
    title: `🔥 DOWNTIME INICIADO - ${data.machineName}`,
    description: data.failureTitle
      ? `**${data.failureTitle}**\n\n⚠️ Producción detenida`
      : '⚠️ **Producción detenida**',
    color: DISCORD_COLORS.CRITICAL,
    fields: [
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
      { name: '⏰ Inicio', value: (data.startedAt || new Date()).toLocaleString('es-AR'), inline: true },
    ],
    footer: data.failureId ? { text: `Falla #${data.failureId}` } : undefined,
    timestamp: new Date().toISOString(),
  };

  if (data.cause) {
    embed.fields?.push({ name: '📝 Causa', value: data.cause.substring(0, 200), inline: false });
  }

  await sendNotification(data.sectorId, 'FALLA_NUEVA', embed, 'ORVIT - Downtime');
}

/**
 * Notifica fin de downtime
 * Canal: #fallas
 */
export async function notifyDowntimeEnd(data: DowntimeEventData): Promise<void> {
  let durationText = '';
  if (data.durationMinutes) {
    const hours = Math.floor(data.durationMinutes / 60);
    const mins = data.durationMinutes % 60;
    durationText = hours > 0 ? `${hours}h ${mins}min` : `${mins} minutos`;
  }

  const embed: DiscordEmbed = {
    title: `✅ DOWNTIME FINALIZADO - ${data.machineName}`,
    description: `Producción restablecida${durationText ? `\n\n⏱️ Duración total: **${durationText}**` : ''}`,
    color: DISCORD_COLORS.SUCCESS,
    fields: [
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
      { name: '⏰ Fin', value: (data.endedAt || new Date()).toLocaleString('es-AR'), inline: true },
    ],
    footer: data.failureId ? { text: `Falla #${data.failureId}` } : undefined,
    timestamp: new Date().toISOString(),
  };

  if (data.cause) {
    embed.fields?.push({ name: '📝 Causa', value: data.cause.substring(0, 200), inline: false });
  }

  await sendNotification(data.sectorId, 'FALLA_RESUELTA', embed, 'ORVIT - Downtime');
}

// ============================================================================
// NOTIFICACIÓN DE ESCALAMIENTO DE PRIORIDAD (Fase 3)
// ============================================================================

export interface PriorityEscalationData {
  failureId: number;
  title: string;
  machineName: string;
  sectorId: number;
  previousPriority: string;
  newPriority: string;
  reason?: string;
  assignedToId?: number;
  assignedTo?: string;
}

/**
 * Notifica escalamiento de prioridad
 * Canal: #fallas
 * DM: Técnico asignado (si existe)
 */
export async function notifyPriorityEscalated(data: PriorityEscalationData): Promise<void> {
  const { emoji: newEmoji, color } = getPriorityStyle(data.newPriority);

  const embed: DiscordEmbed = {
    title: `🆙 Prioridad Escalada - F-${data.failureId}`,
    description: `**${data.title}**\n\n${data.previousPriority} → **${data.newPriority}** ${newEmoji}`,
    color,
    fields: [
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
      { name: `${newEmoji} Nueva Prioridad`, value: data.newPriority, inline: true },
    ],
    footer: { text: `Falla #${data.failureId}` },
    timestamp: new Date().toISOString(),
  };

  if (data.reason) {
    embed.fields?.push({ name: '📝 Motivo', value: data.reason.substring(0, 200), inline: false });
  }

  if (data.assignedTo) {
    embed.fields?.push({ name: '👤 Asignado a', value: data.assignedTo, inline: true });
  }

  // 1. Enviar a canal de fallas
  await sendNotification(data.sectorId, 'FALLA_NUEVA', embed, 'ORVIT - Escalamiento');

  // 2. Enviar DM al técnico asignado
  if (data.assignedToId) {
    const dmEmbed = {
      title: `🆙 Prioridad Escalada - F-${data.failureId}`,
      description: `Tu falla asignada ha sido escalada.\n\n**${data.title}**\n\n${data.previousPriority} → **${data.newPriority}** ${newEmoji}`,
      color,
      fields: [
        { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
        ...(data.reason ? [{ name: '📝 Motivo', value: data.reason.substring(0, 200), inline: false }] : []),
      ],
      footer: 'Atención requerida',
      timestamp: true,
    };

    await sendTechnicianDM(data.assignedToId, { embed: dmEmbed });
  }
}

// ============================================================================
// NOTIFICACIÓN INICIO DEL DÍA (Fase 6) - DM Personal
// ============================================================================

export interface DayStartData {
  userId: number;
  userName: string;
  assignedOTs: Array<{
    id: number;
    title: string;
    priority: string;
    machineName?: string;
    scheduledDate?: Date;
  }>;
  preventives: Array<{
    id: number;
    title: string;
    machineName: string;
    scheduledDate?: Date;
  }>;
  overdueOTs: Array<{
    id: number;
    title: string;
    priority: string;
    daysOverdue: number;
  }>;
  sectorP1Count: number;
  sectorName?: string;
}

/**
 * Envía DM de inicio del día a un técnico con su agenda
 */
export async function notifyDayStart(data: DayStartData): Promise<{ success: boolean; error?: string }> {
  // Si no hay nada que mostrar, no enviar
  if (
    data.assignedOTs.length === 0 &&
    data.preventives.length === 0 &&
    data.overdueOTs.length === 0 &&
    data.sectorP1Count === 0
  ) {
    return { success: true }; // Sin contenido, no enviar
  }

  // Construir descripción del mensaje
  let description = '';

  // OTs asignadas para hoy
  if (data.assignedOTs.length > 0) {
    description += '**🔧 OTs para hoy:**\n';
    for (const ot of data.assignedOTs.slice(0, 5)) {
      const { emoji } = getPriorityStyle(ot.priority);
      description += `├ OT-${ot.id} (${ot.priority}) ${emoji} - ${ot.machineName || ot.title.substring(0, 30)}\n`;
    }
    if (data.assignedOTs.length > 5) {
      description += `└ ...y ${data.assignedOTs.length - 5} más\n`;
    }
    description += '\n';
  }

  // Preventivos programados
  if (data.preventives.length > 0) {
    description += '**📋 Preventivos programados:**\n';
    for (const prev of data.preventives.slice(0, 5)) {
      description += `├ PRV-${prev.id} - ${prev.machineName}\n`;
    }
    if (data.preventives.length > 5) {
      description += `└ ...y ${data.preventives.length - 5} más\n`;
    }
    description += '\n';
  }

  // OTs vencidas
  if (data.overdueOTs.length > 0) {
    description += '**⚠️ Vencidas:**\n';
    for (const ot of data.overdueOTs.slice(0, 3)) {
      description += `├ OT-${ot.id} (venció hace ${ot.daysOverdue} día${ot.daysOverdue !== 1 ? 's' : ''})\n`;
    }
    if (data.overdueOTs.length > 3) {
      description += `└ ...y ${data.overdueOTs.length - 3} más\n`;
    }
    description += '\n';
  }

  // P1 abiertas en el sector
  if (data.sectorP1Count > 0) {
    description += `**🚨 P1 abiertas${data.sectorName ? ` en ${data.sectorName}` : ''}:** ${data.sectorP1Count}\n`;
  }

  const dmEmbed = {
    title: `📌 Buenos días ${data.userName}!`,
    description: description.trim(),
    color: data.overdueOTs.length > 0 || data.sectorP1Count > 0
      ? DISCORD_COLORS.WARNING
      : DISCORD_COLORS.INFO,
    footer: 'ORVIT - Tu agenda del día',
    timestamp: true,
  };

  return sendTechnicianDM(data.userId, { embed: dmEmbed });
}

// ============================================================================
// NOTIFICACIÓN INICIO DEL DÍA - CANAL DE SECTOR (Fase 6)
// ============================================================================

export interface SectorDayStartData {
  sectorId: number;
  sectorName: string;
  date: Date;
  // OTs del día agrupadas por técnico
  assignmentsByTech: Array<{
    techName: string;
    techId: number;
    ots: Array<{
      id: number;
      title: string;
      priority: string;
      machineName?: string;
    }>;
    preventives: Array<{
      id: number;
      title: string;
      machineName: string;
    }>;
  }>;
  // OTs sin asignar del sector
  unassignedOTs: Array<{
    id: number;
    title: string;
    priority: string;
    machineName?: string;
  }>;
  // OTs vencidas del sector
  overdueOTs: Array<{
    id: number;
    title: string;
    priority: string;
    daysOverdue: number;
    assignedTo?: string;
  }>;
  // Fallas P1 abiertas
  openP1Count: number;
  // Estadísticas
  stats: {
    totalOTs: number;
    totalPreventives: number;
    totalOverdue: number;
  };
}

/**
 * Envía resumen del día al canal del sector (visible para todos)
 */
export async function notifySectorDayStart(data: SectorDayStartData): Promise<{ success: boolean; error?: string }> {
  const { webhookUrl, channelId } = await getDiscordDestination(data.sectorId, 'RESUMEN_DIA');

  if (!webhookUrl && !channelId) {
    return { success: false, error: 'No hay webhook ni canal configurado para resumen' };
  }

  // Formatear fecha
  const dateStr = data.date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  // Construir descripción
  let description = '';

  // Estadísticas rápidas
  description += `📊 **Resumen:** ${data.stats.totalOTs} OTs | ${data.stats.totalPreventives} Preventivos`;
  if (data.stats.totalOverdue > 0) {
    description += ` | ⚠️ ${data.stats.totalOverdue} vencidas`;
  }
  if (data.openP1Count > 0) {
    description += ` | 🚨 ${data.openP1Count} P1`;
  }
  description += '\n\n';

  // OTs vencidas primero (importante)
  if (data.overdueOTs.length > 0) {
    description += '**⚠️ VENCIDAS (requieren atención):**\n';
    for (const ot of data.overdueOTs.slice(0, 5)) {
      const { emoji } = getPriorityStyle(ot.priority);
      description += `├ OT-${ot.id} ${emoji} - ${ot.machineName || ot.title.substring(0, 25)}`;
      if (ot.assignedTo) description += ` → ${ot.assignedTo}`;
      description += ` (${ot.daysOverdue}d)\n`;
    }
    if (data.overdueOTs.length > 5) {
      description += `└ ...y ${data.overdueOTs.length - 5} más\n`;
    }
    description += '\n';
  }

  // OTs sin asignar
  if (data.unassignedOTs.length > 0) {
    description += '**❓ SIN ASIGNAR:**\n';
    for (const ot of data.unassignedOTs.slice(0, 5)) {
      const { emoji } = getPriorityStyle(ot.priority);
      description += `├ OT-${ot.id} ${emoji} - ${ot.machineName || ot.title.substring(0, 30)}\n`;
    }
    if (data.unassignedOTs.length > 5) {
      description += `└ ...y ${data.unassignedOTs.length - 5} más\n`;
    }
    description += '\n';
  }

  // Asignaciones por técnico
  if (data.assignmentsByTech.length > 0) {
    description += '**👷 ASIGNACIONES DEL DÍA:**\n';
    for (const tech of data.assignmentsByTech) {
      const otCount = tech.ots.length;
      const prevCount = tech.preventives.length;
      description += `\n**${tech.techName}** (${otCount} OT${otCount !== 1 ? 's' : ''}, ${prevCount} prev)\n`;

      // OTs del técnico
      for (const ot of tech.ots.slice(0, 3)) {
        const { emoji } = getPriorityStyle(ot.priority);
        description += `├ OT-${ot.id} ${emoji} ${ot.machineName || ot.title.substring(0, 25)}\n`;
      }
      if (tech.ots.length > 3) {
        description += `├ ...+${tech.ots.length - 3} OTs más\n`;
      }

      // Preventivos del técnico
      for (const prev of tech.preventives.slice(0, 2)) {
        description += `├ 📋 PRV-${prev.id} - ${prev.machineName}\n`;
      }
      if (tech.preventives.length > 2) {
        description += `├ ...+${tech.preventives.length - 2} preventivos más\n`;
      }
    }
  }

  // Determinar color según urgencia
  let color = DISCORD_COLORS.INFO;
  if (data.overdueOTs.length > 0 || data.openP1Count > 0) {
    color = DISCORD_COLORS.WARNING;
  }
  if (data.openP1Count >= 3 || data.overdueOTs.length >= 5) {
    color = DISCORD_COLORS.ERROR;
  }

  // Para webhook: formato estándar de Discord
  const webhookEmbed: DiscordEmbed = {
    title: `📌 Inicio del Día — ${data.sectorName}`,
    description: description.trim(),
    color,
    footer: { text: `${dateStr} | ORVIT` },
    timestamp: new Date().toISOString(),
  };

  // Enviar al canal via bot service
  if (channelId) {
    try {
      const result = await sendToChannelViaBotService(channelId, {
        embed: {
          title: `📌 Inicio del Día — ${data.sectorName}`,
          description: description.trim(),
          color,
          footer: `${dateStr} | ORVIT`,
          timestamp: true,
        }
      });
      if (result.success) {
        return { success: true };
      }
      console.warn('⚠️ Error enviando a canal via bot service:', result.error);
    } catch (channelError) {
      console.warn('⚠️ Error enviando a canal, intentando webhook:', channelError);
    }
  }

  // Fallback a webhook
  if (webhookUrl) {
    try {
      await sendDiscordMessage(webhookUrl, { embeds: [webhookEmbed] });
      return { success: true };
    } catch (webhookError) {
      return { success: false, error: (webhookError as Error).message };
    }
  }

  return { success: false, error: 'No se pudo enviar mensaje' };
}

// ============================================================================
// NOTIFICACIONES DE TAREAS DEL SISTEMA (DM directo al asignado)
// ============================================================================

export interface TaskAssignedData {
  assigneeUserId: number;
  taskId: number;
  taskTitle: string;
  description?: string | null;
  priority: string;
  dueDate?: Date | null;
  createdByName: string;
  source: 'DISCORD_TEXT' | 'DISCORD_VOICE';
}

/**
 * Envía un DM de Discord al usuario asignado cuando se le crea una tarea desde Discord.
 * Reutiliza sendTechnicianDM que ya maneja el lookup de discordUserId.
 */
export async function notifyTaskAssignedDiscord(data: TaskAssignedData): Promise<void> {
  const { emoji, color } = getPriorityStyle(data.priority);
  const sourceLabel = data.source === 'DISCORD_VOICE' ? '🎙️ Mensaje de voz' : '💬 Mensaje de texto';

  const dueDateText = data.dueDate
    ? new Date(data.dueDate).toLocaleDateString('es-AR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : 'Sin fecha';

  const result = await sendTechnicianDM(data.assigneeUserId, {
    embed: {
      title: '📋 Nueva tarea asignada',
      description: `**${data.taskTitle}**`,
      color,
      fields: [
        ...(data.description
          ? [{ name: '📝 Descripción', value: data.description.substring(0, 200), inline: false }]
          : []),
        { name: `${emoji} Prioridad`, value: data.priority, inline: true },
        { name: '📅 Vence', value: dueDateText, inline: true },
        { name: '👤 Asignada por', value: data.createdByName, inline: true },
        { name: '📌 Fuente', value: sourceLabel, inline: true },
      ],
      footer: `Tarea #${data.taskId} | ORVIT`,
      timestamp: true,
    },
  });

  if (!result.success) {
    console.warn(`[notifyTaskAssignedDiscord] No se pudo enviar DM al usuario ${data.assigneeUserId}: ${result.error}`);
  }
}

// ============================================================================
// NOTIFICACIÓN DE CAMBIO DE ESTADO DE MÁQUINA
// ============================================================================

export interface MachineStatusChangeData {
  machineId: number;
  machineName: string;
  oldStatus: string;
  newStatus: string;
  sectorId: number;
  sectorName?: string;
  changedByName?: string;
}

/**
 * Traduce un estado de máquina a su label en español
 */
function getMachineStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Activa';
    case 'OUT_OF_SERVICE': return 'Fuera de servicio';
    case 'MAINTENANCE': return 'En mantenimiento';
    case 'DECOMMISSIONED': return 'Dada de baja';
    default: return status;
  }
}

/**
 * Notifica un cambio de estado de máquina a OUT_OF_SERVICE o MAINTENANCE
 * Canal: #fallas (el más relevante para cambios de disponibilidad)
 */
export async function notifyMachineStatusChange(data: MachineStatusChangeData): Promise<void> {
  const isOutOfService = data.newStatus === 'OUT_OF_SERVICE';
  const color = isOutOfService ? DISCORD_COLORS.ERROR : DISCORD_COLORS.WARNING;
  const emoji = isOutOfService ? '🔴' : '🟡';

  const embed: DiscordEmbed = {
    title: `${emoji} Cambio de Estado — ${data.machineName}`,
    description: `La máquina **${data.machineName}** cambió de estado`,
    color,
    fields: [
      { name: '📌 Estado anterior', value: getMachineStatusLabel(data.oldStatus), inline: true },
      { name: '➡️ Estado nuevo', value: getMachineStatusLabel(data.newStatus), inline: true },
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
    ],
    footer: { text: `Máquina #${data.machineId}` },
    timestamp: new Date().toISOString(),
  };

  if (data.changedByName) {
    embed.fields?.push({ name: '👤 Modificado por', value: data.changedByName, inline: true });
  }

  await sendNotification(data.sectorId, 'FALLA_NUEVA', embed, 'ORVIT - Máquinas');
}

// ============================================================================
// NOTIFICACIONES DE CONTROLES DE SEGUIMIENTO DE SOLUCIONES
// ============================================================================

export interface SolutionControlDueData {
  controlInstanceId: number;
  controlOrder: number;
  controlDescription: string;
  solutionTitle: string;
  machineName: string;
  technicianName: string;
  scheduledAt: Date;
  sectorId: number;
}

export interface SolutionControlOverdueData {
  controlInstanceId: number;
  controlOrder: number;
  controlDescription: string;
  solutionTitle: string;
  machineName: string;
  scheduledAt: Date;
  sectorId: number;
}

/**
 * Notifica que un control de seguimiento de solución venció (debe realizarse)
 */
export async function notifySolutionControlDue(data: SolutionControlDueData): Promise<void> {
  const scheduledStr = data.scheduledAt.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  const embed: DiscordEmbed = {
    title: `⏰ Control de Solución — Paso #${data.controlOrder}`,
    description: `**${data.controlDescription}**\n\nSolución: ${data.solutionTitle}`,
    color: DISCORD_COLORS.WARNING,
    fields: [
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
      { name: '👤 Técnico', value: data.technicianName, inline: true },
      { name: '🕐 Programado', value: scheduledStr, inline: true },
    ],
    footer: { text: `Control #${data.controlInstanceId} · Paso ${data.controlOrder}` },
    timestamp: new Date().toISOString(),
  };

  await sendNotification(data.sectorId, 'FALLA_NUEVA', embed, 'ORVIT - Controles');
}

/**
 * Notifica que un control de seguimiento lleva >2h vencido sin completar
 */
export async function notifySolutionControlOverdue(data: SolutionControlOverdueData): Promise<void> {
  const scheduledStr = data.scheduledAt.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  const embed: DiscordEmbed = {
    title: `🔴 Control Vencido — Paso #${data.controlOrder}`,
    description: `**${data.controlDescription}** no fue completado.\n\nSolución: ${data.solutionTitle}`,
    color: DISCORD_COLORS.ERROR,
    fields: [
      { name: `${DISCORD_EMOJIS.MAQUINA} Máquina`, value: data.machineName, inline: true },
      { name: '📅 Debía realizarse', value: scheduledStr, inline: true },
    ],
    footer: { text: `Control #${data.controlInstanceId} · Paso ${data.controlOrder} — VENCIDO` },
    timestamp: new Date().toISOString(),
  };

  await sendNotification(data.sectorId, 'FALLA_NUEVA', embed, 'ORVIT - Controles');
}
