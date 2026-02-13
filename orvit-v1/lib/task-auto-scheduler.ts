// Sistema interno de scheduling para reinicio automático de tareas a las 00:00

import { loggers } from '@/lib/logger';

let schedulerTimeout: NodeJS.Timeout | null = null;
let isSchedulerRunning = false;

/**
 * Inicia el scheduler interno que ejecuta el cron de reinicios todos los días a las 00:00
 */
export function startTaskAutoScheduler() {
  if (isSchedulerRunning) {
    loggers.tasks.info('Task Auto Scheduler already running');
    return;
  }

  loggers.tasks.info('Starting Task Auto Scheduler');
  isSchedulerRunning = true;
  
  // Programar la primera ejecución
  scheduleNextExecution();
}

/**
 * Detiene el scheduler interno
 */
export function stopTaskAutoScheduler() {
  if (schedulerTimeout) {
    clearTimeout(schedulerTimeout);
    schedulerTimeout = null;
  }
  isSchedulerRunning = false;
  loggers.tasks.info('Task Auto Scheduler stopped');
}

/**
 * Calcula y programa la próxima ejecución a las 00:00
 */
function scheduleNextExecution() {
  const now = new Date();
  const nextMidnight = new Date(now);
  
  // Configurar para mañana a las 00:00
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = nextMidnight.getTime() - now.getTime();
  
  loggers.tasks.info({
    nextExecution: nextMidnight.toISOString(),
    hoursRemaining: Math.floor(msUntilMidnight / (1000 * 60 * 60)),
    minutesRemaining: Math.floor((msUntilMidnight % (1000 * 60 * 60)) / (1000 * 60)),
  }, 'Next auto execution scheduled');
  
  // Programar la ejecución
  schedulerTimeout = setTimeout(async () => {
    await executeTaskReset();
    // Programar la siguiente ejecución
    scheduleNextExecution();
  }, msUntilMidnight);
}

/**
 * Ejecuta el proceso de reinicio automático de tareas
 */
async function executeTaskReset() {
  try {
    loggers.tasks.info('Executing automatic task reset');
    
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/cron/task-reset-scheduler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TaskAutoScheduler/1.0',
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`,
      }
    });

    if (response.ok) {
      const result = await response.json();
      // console.log('✅ [AUTO SCHEDULER] Reinicio automático completado exitosamente') // Log reducido;
      loggers.tasks.info({ tasksReset: result.results?.tasksReset || 0 }, 'Auto reset completed');
      
      // Log detallado si hay reinicios
      if (result.resetTasks && result.resetTasks.length > 0) {
        // console.log('📋 [AUTO SCHEDULER] Tareas reiniciadas:') // Log reducido;
        result.resetTasks.forEach((task: any) => {
          loggers.tasks.debug({ title: task.title, frequency: task.frequency, nextExecution: task.newNextExecution }, 'Task reset');
        });
      }
    } else {
      const errorText = await response.text();
      loggers.tasks.error({ errorText }, 'Auto scheduler reset endpoint error');
    }
  } catch (error) {
    loggers.tasks.error({ err: error }, 'Error executing automatic reset');
  }
}

/**
 * Obtiene el estado actual del scheduler
 */
export function getSchedulerStatus() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  
  return {
    isRunning: isSchedulerRunning,
    nextExecution: nextMidnight.toISOString(),
    timeUntilNext: nextMidnight.getTime() - now.getTime(),
    timeUntilNextFormatted: formatTimeUntilNext(nextMidnight.getTime() - now.getTime())
  };
}

/**
 * Formatea el tiempo restante hasta la próxima ejecución
 */
function formatTimeUntilNext(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Ejecuta el reinicio manualmente (para testing)
 */
export async function executeManualReset() {
  // console.log('🔧 [MANUAL RESET] Ejecutando reinicio manual...') // Log reducido;
  await executeTaskReset();
  // console.log('✅ [MANUAL RESET] Reinicio manual completado') // Log reducido;
}

// Auto-iniciar el scheduler cuando se importe este módulo en servidor
if (typeof window === 'undefined') {
  // Solo en servidor (no en cliente)
  loggers.tasks.debug('Task Auto Scheduler module loaded on server');
} 