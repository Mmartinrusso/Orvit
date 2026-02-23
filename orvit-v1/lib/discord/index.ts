/**
 * Discord Integration Module
 *
 * Exporta todas las funciones de integración con Discord
 */

// Cliente de webhooks
export {
  sendDiscordMessage,
  isValidDiscordWebhook,
  testDiscordWebhook,
  DISCORD_COLORS,
  DISCORD_EMOJIS,
  type DiscordEmbed,
  type DiscordMessage,
} from './client';

// Servicio de notificaciones
export {
  // Fallas
  notifyNewFailure,
  notifyFailureResolved,
  type NewFailureData,
  type FailureResolvedData,

  // Órdenes de Trabajo
  notifyOTCreated,
  notifyOTAssigned,
  notifyOTCompleted,
  type NewWorkOrderData,
  type OTAssignedData,
  type OTCompletedData,

  // SLA (Fase 2)
  notifySLAAtRisk,
  notifySLABreached,
  SLA_WARNING_THRESHOLDS,
  type SLAAlertData,

  // Fallas sin asignar (Fase 2)
  notifyUnassignedFailure,
  UNASSIGNED_FAILURE_THRESHOLDS,
  type UnassignedFailureData,

  // Fallas P1 a técnicos (Fase 2)
  notifyP1ToSectorTechnicians,
  type P1FailureAlertData,

  // Reincidencia (Fase 3)
  notifyRecurrence,
  type RecurrenceAlertData,

  // Downtime (Fase 3)
  notifyDowntimeStart,
  notifyDowntimeEnd,
  type DowntimeEventData,

  // Escalamiento de prioridad (Fase 3)
  notifyPriorityEscalated,
  type PriorityEscalationData,

  // Preventivos
  notifyPreventiveReminder,
  notifyPreventiveCompleted,
  type PreventiveReminderData,
  type PreventiveCompletedData,

  // Resumen
  sendDailySummary,
  type DailySummaryData,

  // Inicio del día (Fase 6)
  notifyDayStart,
  notifySectorDayStart,
  type DayStartData,
  type SectorDayStartData,

  // DM a técnicos
  sendTechnicianDM,
} from './notifications';

// Bot Service Client (bot corre como servicio separado en Railway)
export {
  callBotService,
  sendDMViaBotService,
  sendDMByDiscordIdViaBotService,
  sendToChannelViaBotService,
  sendNotificationViaBotService,
  getBotServiceStatus,
  manageBotChannels,
  syncBotPermissions,
} from './bot-service-client';

// Re-export DMMessageOptions type from notifications
export type { DMMessageOptions } from './notifications';
