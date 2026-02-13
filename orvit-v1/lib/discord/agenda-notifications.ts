/**
 * Agenda Notifications - Sistema de notificaciones Discord para recordatorios
 *
 * Envía recordatorios de tareas de agenda vía Discord DM
 */

import { sendDM, isBotReady, DMButtonOption } from './bot';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Colores para embeds
const COLORS = {
  REMINDER: 0x3b82f6, // Azul
  TASK_CREATED: 0x10b981, // Verde
  TASK_COMPLETED: 0x22c55e, // Verde brillante
  TASK_OVERDUE: 0xef4444, // Rojo
  URGENT: 0xf59e0b, // Ámbar
};

export interface TaskReminderData {
  taskId: number;
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  priority: string;
  assignedToName?: string | null;
  category?: string | null;
}

export interface ReminderNotificationData {
  reminderId: number;
  reminderTitle: string;
  task: TaskReminderData;
}

/**
 * Envía un recordatorio de tarea vía Discord DM
 */
export async function sendTaskReminder(
  discordUserId: string,
  data: ReminderNotificationData
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady()) {
    return { success: false, error: 'Bot no está conectado' };
  }

  const { task } = data;

  // Determinar color según prioridad
  let color = COLORS.REMINDER;
  if (task.priority === 'URGENT') color = COLORS.URGENT;
  else if (task.priority === 'HIGH') color = COLORS.TASK_OVERDUE;

  // Construir campos del embed
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (task.assignedToName) {
    fields.push({
      name: '👤 Asignada a',
      value: task.assignedToName,
      inline: true,
    });
  }

  if (task.dueDate) {
    const formattedDate = format(new Date(task.dueDate), "EEEE d 'de' MMMM", { locale: es });
    fields.push({
      name: '📅 Vence',
      value: formattedDate,
      inline: true,
    });
  }

  if (task.priority) {
    const priorityLabels: Record<string, string> = {
      LOW: '🟢 Baja',
      MEDIUM: '🟡 Media',
      HIGH: '🟠 Alta',
      URGENT: '🔴 Urgente',
    };
    fields.push({
      name: '⚡ Prioridad',
      value: priorityLabels[task.priority] || task.priority,
      inline: true,
    });
  }

  if (task.category) {
    fields.push({
      name: '📁 Categoría',
      value: task.category,
      inline: true,
    });
  }

  const result = await sendDM(discordUserId, {
    embed: {
      title: `🔔 Recordatorio: ${task.title}`,
      description: task.description || undefined,
      color,
      fields,
      footer: `Tarea #${task.taskId}`,
      timestamp: true,
    },
  });

  return result;
}

/**
 * Notifica al creador que una tarea fue creada desde Discord
 */
export async function notifyTaskCreated(
  discordUserId: string,
  task: TaskReminderData
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady()) {
    return { success: false, error: 'Bot no está conectado' };
  }

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (task.assignedToName) {
    fields.push({
      name: '👤 Asignada a',
      value: task.assignedToName,
      inline: true,
    });
  }

  if (task.dueDate) {
    const formattedDate = format(new Date(task.dueDate), "EEEE d 'de' MMMM", { locale: es });
    fields.push({
      name: '📅 Vence',
      value: formattedDate,
      inline: true,
    });
  }

  const priorityLabels: Record<string, string> = {
    LOW: '🟢 Baja',
    MEDIUM: '🟡 Media',
    HIGH: '🟠 Alta',
    URGENT: '🔴 Urgente',
  };

  fields.push({
    name: '⚡ Prioridad',
    value: priorityLabels[task.priority] || task.priority,
    inline: true,
  });

  const result = await sendDM(discordUserId, {
    embed: {
      title: `✅ Tarea creada: ${task.title}`,
      description: task.description || undefined,
      color: COLORS.TASK_CREATED,
      fields,
      footer: `Tarea #${task.taskId} | Creada desde Discord`,
      timestamp: true,
    },
  });

  return result;
}

/**
 * Notifica que una tarea está vencida
 */
export async function notifyTaskOverdue(
  discordUserId: string,
  task: TaskReminderData,
  daysOverdue: number
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady()) {
    return { success: false, error: 'Bot no está conectado' };
  }

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (task.assignedToName) {
    fields.push({
      name: '👤 Asignada a',
      value: task.assignedToName,
      inline: true,
    });
  }

  fields.push({
    name: '⚠️ Atraso',
    value: `${daysOverdue} día${daysOverdue !== 1 ? 's' : ''}`,
    inline: true,
  });

  if (task.dueDate) {
    const formattedDate = format(new Date(task.dueDate), "d 'de' MMMM", { locale: es });
    fields.push({
      name: '📅 Venció',
      value: formattedDate,
      inline: true,
    });
  }

  const result = await sendDM(discordUserId, {
    embed: {
      title: `⚠️ Tarea vencida: ${task.title}`,
      description: task.description || 'Esta tarea requiere atención inmediata.',
      color: COLORS.TASK_OVERDUE,
      fields,
      footer: `Tarea #${task.taskId}`,
      timestamp: true,
    },
  });

  return result;
}

/**
 * Notifica que una tarea fue completada
 */
export async function notifyTaskCompleted(
  discordUserId: string,
  task: TaskReminderData,
  completedNote?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady()) {
    return { success: false, error: 'Bot no está conectado' };
  }

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (task.assignedToName) {
    fields.push({
      name: '👤 Completada por',
      value: task.assignedToName,
      inline: true,
    });
  }

  if (completedNote) {
    fields.push({
      name: '📝 Nota',
      value: completedNote,
      inline: false,
    });
  }

  const result = await sendDM(discordUserId, {
    embed: {
      title: `🎉 Tarea completada: ${task.title}`,
      description: task.description || undefined,
      color: COLORS.TASK_COMPLETED,
      fields,
      footer: `Tarea #${task.taskId}`,
      timestamp: true,
    },
  });

  return result;
}

/**
 * Notifica que una tarea está por vencer (15 min antes)
 * Incluye botones para: Completar, Reprogramar, Recordar luego
 */
export async function notifyTaskDueSoon(
  discordUserId: string,
  task: TaskReminderData,
  minutesUntilDue: number
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady()) {
    return { success: false, error: 'Bot no está conectado' };
  }

  // Determinar color según prioridad
  let color = 0xf59e0b; // Ámbar por defecto (advertencia)
  if (task.priority === 'URGENT') color = 0xef4444; // Rojo
  else if (task.priority === 'HIGH') color = 0xf97316; // Naranja

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (task.assignedToName) {
    fields.push({
      name: '👤 Asignada a',
      value: task.assignedToName,
      inline: true,
    });
  }

  if (task.dueDate) {
    const dueTime = format(new Date(task.dueDate), "HH:mm 'hs'", { locale: es });
    const dueDate = format(new Date(task.dueDate), "EEEE d 'de' MMMM", { locale: es });
    fields.push({
      name: '⏰ Vence',
      value: `**${dueTime}** - ${dueDate}`,
      inline: true,
    });
  }

  const priorityLabels: Record<string, string> = {
    LOW: '🟢 Baja',
    MEDIUM: '🟡 Media',
    HIGH: '🟠 Alta',
    URGENT: '🔴 Urgente',
  };

  fields.push({
    name: '⚡ Prioridad',
    value: priorityLabels[task.priority] || task.priority,
    inline: true,
  });

  // Botones de acción
  const buttons: DMButtonOption[] = [
    {
      customId: `task_complete_${task.taskId}`,
      label: 'Completar',
      style: 'success',
      emoji: '✅',
    },
    {
      customId: `task_reschedule_${task.taskId}`,
      label: 'Reprogramar',
      style: 'primary',
      emoji: '📅',
    },
    {
      customId: `task_snooze_${task.taskId}`,
      label: '+30 min',
      style: 'secondary',
      emoji: '⏰',
    },
  ];

  const result = await sendDM(discordUserId, {
    embed: {
      title: `⏰ ¡Tarea en ${minutesUntilDue} min!`,
      description: `**${task.title}**${task.description ? `\n\n${task.description}` : ''}`,
      color,
      fields,
      footer: `Tarea #${task.taskId}`,
      timestamp: true,
    },
    buttons,
  });

  return result;
}

/**
 * Notifica que una tarea vence mañana o hoy (para tareas regulares del sistema)
 */
export async function notifyTaskDueDate(
  discordUserId: string,
  task: TaskReminderData,
  type: 'tomorrow' | 'today'
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady()) {
    return { success: false, error: 'Bot no está conectado' };
  }

  const isTomorrow = type === 'tomorrow';
  const color = isTomorrow ? 0xf59e0b : 0xef4444; // Ámbar para mañana, Rojo para hoy

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (task.assignedToName) {
    fields.push({
      name: '👤 Asignada a',
      value: task.assignedToName,
      inline: true,
    });
  }

  if (task.dueDate) {
    const dueDate = new Date(task.dueDate);
    const formattedDate = format(dueDate, "EEEE d 'de' MMMM", { locale: es });
    const formattedTime = format(dueDate, "HH:mm 'hs'", { locale: es });
    fields.push({
      name: '📅 Vence',
      value: isTomorrow ? formattedDate : `**${formattedTime}** - ${formattedDate}`,
      inline: true,
    });
  }

  if (task.priority) {
    const priorityLabels: Record<string, string> = {
      LOW: '🟢 Baja',
      MEDIUM: '🟡 Media',
      HIGH: '🟠 Alta',
      URGENT: '🔴 Urgente',
    };
    fields.push({
      name: '⚡ Prioridad',
      value: priorityLabels[task.priority] || task.priority,
      inline: true,
    });
  }

  if (task.category) {
    fields.push({
      name: '📁 Categoría',
      value: task.category,
      inline: true,
    });
  }

  const result = await sendDM(discordUserId, {
    embed: {
      title: isTomorrow
        ? `⏰ Tarea vence MAÑANA: ${task.title}`
        : `🚨 Tarea vence HOY: ${task.title}`,
      description: task.description || undefined,
      color,
      fields,
      footer: `Tarea #${task.taskId}`,
      timestamp: true,
    },
  });

  return result;
}

/**
 * Envía recordatorios múltiples de tareas pendientes (resumen diario)
 */
export async function sendDailySummary(
  discordUserId: string,
  tasks: {
    pending: TaskReminderData[];
    overdue: TaskReminderData[];
    dueToday: TaskReminderData[];
    dueTomorrow?: TaskReminderData[];
  }
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady()) {
    return { success: false, error: 'Bot no está conectado' };
  }

  const totalPending = tasks.pending.length;
  const totalOverdue = tasks.overdue.length;
  const totalDueToday = tasks.dueToday.length;
  const totalDueTomorrow = tasks.dueTomorrow?.length || 0;

  if (totalPending === 0 && totalOverdue === 0 && totalDueToday === 0 && totalDueTomorrow === 0) {
    return { success: true }; // No hay nada que reportar
  }

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (totalOverdue > 0) {
    const overdueList = tasks.overdue
      .slice(0, 5)
      .map((t) => `• ${t.title}${t.assignedToName ? ` (${t.assignedToName})` : ''}`)
      .join('\n');
    fields.push({
      name: `🔴 Vencidas (${totalOverdue})`,
      value: overdueList + (totalOverdue > 5 ? `\n...y ${totalOverdue - 5} más` : ''),
      inline: false,
    });
  }

  if (totalDueToday > 0) {
    const todayList = tasks.dueToday
      .slice(0, 5)
      .map((t) => `• ${t.title}${t.assignedToName ? ` (${t.assignedToName})` : ''}`)
      .join('\n');
    fields.push({
      name: `🟡 Para hoy (${totalDueToday})`,
      value: todayList + (totalDueToday > 5 ? `\n...y ${totalDueToday - 5} más` : ''),
      inline: false,
    });
  }

  if (totalDueTomorrow > 0) {
    const tomorrowList = tasks.dueTomorrow!
      .slice(0, 5)
      .map((t) => `• ${t.title}${t.assignedToName ? ` (${t.assignedToName})` : ''}`)
      .join('\n');
    fields.push({
      name: `🟠 Para mañana (${totalDueTomorrow})`,
      value: tomorrowList + (totalDueTomorrow > 5 ? `\n...y ${totalDueTomorrow - 5} más` : ''),
      inline: false,
    });
  }

  if (totalPending > 0 && totalPending !== totalOverdue + totalDueToday + totalDueTomorrow) {
    fields.push({
      name: '📋 Total pendientes',
      value: `${totalPending} tarea${totalPending !== 1 ? 's' : ''}`,
      inline: true,
    });
  }

  const color = totalOverdue > 0 ? COLORS.TASK_OVERDUE : totalDueToday > 0 ? COLORS.URGENT : COLORS.REMINDER;

  // Construir descripción según prioridad
  let description = '';
  if (totalOverdue > 0) {
    description = `Tienes **${totalOverdue}** tarea${totalOverdue !== 1 ? 's' : ''} vencida${totalOverdue !== 1 ? 's' : ''} que requieren atención.`;
  } else if (totalDueToday > 0) {
    description = `Tienes **${totalDueToday}** tarea${totalDueToday !== 1 ? 's' : ''} para completar hoy.`;
  } else if (totalDueTomorrow > 0) {
    description = `Tienes **${totalDueTomorrow}** tarea${totalDueTomorrow !== 1 ? 's' : ''} para mañana.`;
  }

  const result = await sendDM(discordUserId, {
    embed: {
      title: '📅 Resumen de Tareas',
      description,
      color,
      fields,
      footer: 'Resumen de tareas pendientes',
      timestamp: true,
    },
  });

  return result;
}
