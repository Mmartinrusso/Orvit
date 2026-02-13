import { createAndSendInstantNotification } from './instant-notifications';

// Store de jobs programados
const scheduledJobs = new Map<string, {
  timeoutId: NodeJS.Timeout;
  reminderId: string;
  userId: number;
  companyId: number;
  type: 'overdue' | 'due_today' | 'due_soon';
  scheduledFor: Date;
}>();

// Función para cancelar un job programado
export function cancelScheduledReminder(reminderId: string, type?: string) {
  const jobKey = type ? `${reminderId}_${type}` : reminderId;
  
  // Si no se especifica tipo, cancelar todos los jobs para ese reminder
  if (!type) {
    const keysToCancel = Array.from(scheduledJobs.keys()).filter(key => key.startsWith(`${reminderId}_`));
    keysToCancel.forEach(key => {
      const job = scheduledJobs.get(key);
      if (job) {
        clearTimeout(job.timeoutId);
        scheduledJobs.delete(key);
        console.log(`⏰ Cancelado job programado: ${key}`);
      }
    });
    return keysToCancel.length;
  } else {
    const job = scheduledJobs.get(jobKey);
    if (job) {
      clearTimeout(job.timeoutId);
      scheduledJobs.delete(jobKey);
      console.log(`⏰ Cancelado job programado: ${jobKey}`);
      return 1;
    }
  }
  return 0;
}

// Función para programar notificaciones de un recordatorio
export function scheduleReminderNotifications(
  reminderId: string,
  userId: number,
  companyId: number,
  title: string,
  dueDate: Date,
  priority: 'baja' | 'media' | 'alta' = 'media',
  contactName?: string
) {
  const now = new Date();
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Cancelar jobs anteriores para este recordatorio
  cancelScheduledReminder(reminderId);

  console.log(`📅 Programando notificaciones para recordatorio: ${title} (vence: ${dueDateOnly.toDateString()})`);

  // Mapear prioridad
  const notificationPriority = priority === 'alta' ? 'high' : priority === 'baja' ? 'low' : 'medium';

  // 1. Programar notificación para "mañana" (si el recordatorio vence en más de 1 día)
  if (dueDateOnly > tomorrow) {
    const notifyTomorrowDate = new Date(dueDateOnly);
    notifyTomorrowDate.setDate(notifyTomorrowDate.getDate() - 1);
    notifyTomorrowDate.setHours(9, 0, 0, 0); // 9 AM del día anterior
    
    if (notifyTomorrowDate > now) {
      const timeUntilTomorrow = notifyTomorrowDate.getTime() - now.getTime();
      
      const timeoutId = setTimeout(async () => {
        console.log(`🔔 Ejecutando notificación "due_soon" para recordatorio ${reminderId}`);
        
        await createAndSendInstantNotification(
          'REMINDER_DUE_SOON',
          userId,
          companyId,
          null,
          reminderId,
          'Recordatorio para mañana',
          `El recordatorio "${title}"${contactName ? ` para ${contactName}` : ''} vence mañana`,
          notificationPriority,
          {
            priority,
            contactName,
            daysUntilDue: 1
          }
        );

        scheduledJobs.delete(`${reminderId}_due_soon`);
      }, timeUntilTomorrow);

      scheduledJobs.set(`${reminderId}_due_soon`, {
        timeoutId,
        reminderId,
        userId,
        companyId,
        type: 'due_soon',
        scheduledFor: notifyTomorrowDate
      });

      console.log(`⏰ Job "due_soon" programado para ${notifyTomorrowDate.toISOString()} (en ${Math.round(timeUntilTomorrow / 60000)} minutos)`);
    }
  }

  // 2. Programar notificación para "hoy" (el día que vence)
  if (dueDateOnly >= today) {
    const notifyTodayDate = new Date(dueDateOnly);
    notifyTodayDate.setHours(8, 0, 0, 0); // 8 AM del día que vence
    
    if (notifyTodayDate > now) {
      const timeUntilToday = notifyTodayDate.getTime() - now.getTime();
      
      const timeoutId = setTimeout(async () => {
        console.log(`🔔 Ejecutando notificación "due_today" para recordatorio ${reminderId}`);
        
        await createAndSendInstantNotification(
          'REMINDER_DUE_TODAY',
          userId,
          companyId,
          null,
          reminderId,
          'Recordatorio para hoy',
          `El recordatorio "${title}"${contactName ? ` para ${contactName}` : ''} vence hoy`,
          notificationPriority,
          {
            priority,
            contactName,
            daysUntilDue: 0
          }
        );

        scheduledJobs.delete(`${reminderId}_due_today`);
      }, timeUntilToday);

      scheduledJobs.set(`${reminderId}_due_today`, {
        timeoutId,
        reminderId,
        userId,
        companyId,
        type: 'due_today',
        scheduledFor: notifyTodayDate
      });

      console.log(`⏰ Job "due_today" programado para ${notifyTodayDate.toISOString()} (en ${Math.round(timeUntilToday / 60000)} minutos)`);
    } else if (dueDateOnly.getTime() === today.getTime()) {
      // Si ya pasó la hora de notificación pero es hoy, enviar inmediatamente
      console.log(`🔔 Enviando notificación "due_today" inmediata para recordatorio ${reminderId}`);
      
      createAndSendInstantNotification(
        'REMINDER_DUE_TODAY',
        userId,
        companyId,
        null,
        reminderId,
        'Recordatorio para hoy',
        `El recordatorio "${title}"${contactName ? ` para ${contactName}` : ''} vence hoy`,
        notificationPriority,
        {
          priority,
          contactName,
          daysUntilDue: 0
        }
      );
    }
  }

  // 3. Programar notificación para "vencido" (el día después de vencer)
  if (dueDateOnly >= today) {
    const notifyOverdueDate = new Date(dueDateOnly);
    notifyOverdueDate.setDate(notifyOverdueDate.getDate() + 1);
    notifyOverdueDate.setHours(10, 0, 0, 0); // 10 AM del día siguiente
    
    const timeUntilOverdue = notifyOverdueDate.getTime() - now.getTime();
    
    const timeoutId = setTimeout(async () => {
      console.log(`🔔 Ejecutando notificación "overdue" para recordatorio ${reminderId}`);
      
      await createAndSendInstantNotification(
        'REMINDER_OVERDUE',
        userId,
        companyId,
        null,
        reminderId,
        'Recordatorio vencido',
        `El recordatorio "${title}"${contactName ? ` para ${contactName}` : ''} está vencido desde ayer`,
        'high', // Los vencidos siempre son alta prioridad
        {
          priority,
          contactName,
          daysOverdue: 1
        }
      );

      scheduledJobs.delete(`${reminderId}_overdue`);
    }, timeUntilOverdue);

    scheduledJobs.set(`${reminderId}_overdue`, {
      timeoutId,
      reminderId,
      userId,
      companyId,
      type: 'overdue',
      scheduledFor: notifyOverdueDate
    });

    console.log(`⏰ Job "overdue" programado para ${notifyOverdueDate.toISOString()} (en ${Math.round(timeUntilOverdue / 60000)} minutos)`);
  } else {
    // Si ya está vencido, enviar notificación inmediatamente
    const daysOverdue = Math.floor((today.getTime() - dueDateOnly.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`🔔 Enviando notificación "overdue" inmediata para recordatorio ${reminderId} (${daysOverdue} días vencido)`);
    
    createAndSendInstantNotification(
      'REMINDER_OVERDUE',
      userId,
      companyId,
      null,
      reminderId,
      'Recordatorio vencido',
      `El recordatorio "${title}"${contactName ? ` para ${contactName}` : ''} está vencido desde hace ${daysOverdue} día${daysOverdue > 1 ? 's' : ''}`,
      'high',
      {
        priority,
        contactName,
        daysOverdue
      }
    );
  }

  const scheduledJobsForReminder = Array.from(scheduledJobs.keys()).filter(key => key.startsWith(`${reminderId}_`));
  // console.log(`✅ ${scheduledJobsForReminder.length} jobs programados para recordatorio ${reminderId}: ${scheduledJobsForReminder.join(', ')}`) // Log reducido;
}

// Función para obtener estadísticas de jobs programados
export function getScheduledJobsStats() {
  const jobsByType = {
    due_soon: 0,
    due_today: 0,
    overdue: 0
  };

  const jobsList: any[] = [];

  for (const [key, job] of Array.from(scheduledJobs.entries())) {
    jobsByType[job.type]++;
    jobsList.push({
      key,
      reminderId: job.reminderId,
      userId: job.userId,
      type: job.type,
      scheduledFor: job.scheduledFor.toISOString(),
      timeUntilExecution: Math.round((job.scheduledFor.getTime() - Date.now()) / 60000) // minutos
    });
  }

  return {
    totalJobs: scheduledJobs.size,
    jobsByType,
    jobs: jobsList
  };
}

// Función para limpiar jobs expirados
export function cleanupExpiredJobs() {
  const now = Date.now();
  const expiredKeys: string[] = [];

  for (const [key, job] of Array.from(scheduledJobs.entries())) {
    // Si el job debería haber ejecutado hace más de 1 hora, considerarlo expirado
    if (job.scheduledFor.getTime() < now - (60 * 60 * 1000)) {
      clearTimeout(job.timeoutId);
      expiredKeys.push(key);
    }
  }

  expiredKeys.forEach(key => scheduledJobs.delete(key));

  if (expiredKeys.length > 0) {
    console.log(`🧹 Limpiados ${expiredKeys.length} jobs expirados: ${expiredKeys.join(', ')}`);
  }

  return expiredKeys.length;
} 