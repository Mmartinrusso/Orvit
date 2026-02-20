// Utilidades para programación automática de tareas

export type TaskFrequency = 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';

// Mapeo entre formatos de base de datos y tipos de la aplicación
export const FREQUENCY_MAPPING: Record<string, TaskFrequency> = {
  'DAILY': 'diaria',
  'WEEKLY': 'semanal',
  'BIWEEKLY': 'quincenal',
  'MONTHLY': 'mensual',
  'QUARTERLY': 'trimestral',
  'SEMESTRAL': 'semestral',
  'ANNUAL': 'anual',
  // Formatos en español (retrocompatibilidad)
  'diaria': 'diaria',
  'semanal': 'semanal',
  'quincenal': 'quincenal',
  'mensual': 'mensual',
  'trimestral': 'trimestral',
  'semestral': 'semestral',
  'anual': 'anual'
};

/**
 * Normaliza la frecuencia desde cualquier formato a TaskFrequency
 */
export function normalizeFrequency(frequency: string): TaskFrequency {
  const normalized = FREQUENCY_MAPPING[frequency];
  if (!normalized) {
    console.warn(`⚠️ Frecuencia no reconocida: ${frequency}, usando 'diaria' por defecto`);
    return 'diaria';
  }
  return normalized;
}

/**
 * Calcula la próxima fecha de ejecución basada en la frecuencia de la tarea
 */
export function calculateNextExecution(frequency: TaskFrequency, lastCompleted?: Date, currentTime?: Date): Date {
  const now = currentTime || new Date();
  const baseDate = lastCompleted || now;
  
  switch (frequency) {
    case 'diaria':
      return calculateNextDaily(baseDate, now);
    
    case 'semanal':
      return calculateNextWeekly(baseDate, now);
    
    case 'quincenal':
      return calculateNextBiweekly(baseDate, now);
    
    case 'mensual':
      return calculateNextMonthly(baseDate, now);
    
    case 'trimestral':
      return calculateNextQuarterly(baseDate, now);
    
    case 'semestral':
      return calculateNextSemestral(baseDate, now);
    
    case 'anual':
      return calculateNextAnnual(baseDate, now);
    
    default:
      throw new Error(`Frecuencia no soportada: ${frequency}`);
  }
}

/**
 * Tareas diarias: Al día siguiente a la hora configurada
 */
function calculateNextDaily(baseDate: Date, now: Date): Date {
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + 1);
  nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);

  return nextDate;
}

/**
 * Tareas semanales: Próximo lunes a la hora configurada
 */
function calculateNextWeekly(baseDate: Date, now: Date): Date {
  const nextMonday = new Date(now);

  // Calcular días hasta el próximo lunes (0 = domingo, 1 = lunes)
  const currentDay = nextMonday.getDay();
  const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay);

  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);

  return nextMonday;
}

/**
 * Tareas quincenales: Día 15 del próximo mes a la hora configurada
 */
function calculateNextBiweekly(baseDate: Date, now: Date): Date {
  const nextDate = new Date(now);

  // Si estamos antes del día 15 del mes actual, usar día 15 de este mes
  if (now.getDate() < 15) {
    nextDate.setDate(15);
  } else {
    // Si ya pasó el día 15, usar día 15 del próximo mes
    nextDate.setMonth(nextDate.getMonth() + 1);
    nextDate.setDate(15);
  }

  nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);
  return nextDate;
}

/**
 * Tareas mensuales: Día 1 del próximo mes a la hora configurada
 */
function calculateNextMonthly(baseDate: Date, now: Date): Date {
  const nextDate = new Date(now);
  nextDate.setMonth(nextDate.getMonth() + 1);
  nextDate.setDate(1);
  nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);

  return nextDate;
}

/**
 * Tareas trimestrales: Cada 3 meses el día 1 a la hora configurada
 */
function calculateNextQuarterly(baseDate: Date, now: Date): Date {
  const nextDate = new Date(now);
  nextDate.setMonth(nextDate.getMonth() + 3);
  nextDate.setDate(1);
  nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);

  return nextDate;
}

/**
 * Tareas semestrales: Cada 6 meses el día 1 a la hora configurada
 */
function calculateNextSemestral(baseDate: Date, now: Date): Date {
  const nextDate = new Date(now);
  nextDate.setMonth(nextDate.getMonth() + 6);
  nextDate.setDate(1);
  nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);

  return nextDate;
}

/**
 * Tareas anuales: Mismo día y mes del próximo año a la hora configurada
 */
function calculateNextAnnual(baseDate: Date, now: Date): Date {
  const nextDate = new Date(baseDate);
  nextDate.setFullYear(nextDate.getFullYear() + 1);
  nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);

  return nextDate;
}

/**
 * Verifica si una tarea debe reiniciarse basada en la fecha actual
 */
export function shouldTaskReset(
  frequency: TaskFrequency, 
  lastCompleted: Date, 
  nextExecution: Date, 
  currentTime?: Date
): boolean {
  const now = currentTime || new Date();
  
  // Si la fecha de próxima ejecución ya pasó, la tarea debe reiniciarse
  return now >= nextExecution;
}

/**
 * Reinicia una tarea completada calculando su próxima fecha de ejecución
 */
export function resetCompletedTask(
  frequency: TaskFrequency | string,
  completedAt: Date,
  currentTime?: Date
) {
  // Normalizar frecuencia para asegurar compatibilidad
  const normalizedFrequency = typeof frequency === 'string' ? normalizeFrequency(frequency) : frequency;
  const nextExecution = calculateNextExecution(normalizedFrequency, completedAt, currentTime);
  
  return {
    isCompleted: false,
    completedAt: undefined,
    lastExecuted: completedAt.toISOString(),
    nextExecution: nextExecution.toISOString()
  };
}

/**
 * Obtiene una descripción legible de cuándo se ejecuta cada frecuencia
 */
export function getFrequencyDescription(frequency: TaskFrequency, executionTime?: string): string {
  const timeStr = executionTime || '00:00';
  const descriptions: Record<TaskFrequency, string> = {
    'diaria': `Todos los días a las ${timeStr}`,
    'semanal': `Todos los lunes a las ${timeStr}`,
    'quincenal': `El día 15 de cada mes a las ${timeStr}`,
    'mensual': `El día 1 de cada mes a las ${timeStr}`,
    'trimestral': `El día 1 cada 3 meses a las ${timeStr}`,
    'semestral': `El día 1 cada 6 meses a las ${timeStr}`,
    'anual': `El mismo día cada año a las ${timeStr}`
  };

  return descriptions[frequency] || frequency;
}

/**
 * Obtiene el próximo reset programado para mostrar en la UI
 */
export function getNextResetInfo(frequency: TaskFrequency, nextExecution: string) {
  const nextDate = new Date(nextExecution);
  const now = new Date();
  
  // Calcular días restantes
  const diffTime = nextDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { text: 'Debe reiniciarse', color: 'text-red-600 dark:text-red-400', urgent: true };
  } else if (diffDays === 0) {
    return { text: 'Se reinicia hoy', color: 'text-orange-600 dark:text-orange-400', urgent: true };
  } else if (diffDays === 1) {
    return { text: 'Se reinicia mañana', color: 'text-yellow-600 dark:text-yellow-400', urgent: false };
  } else if (diffDays <= 7) {
    return { text: `Se reinicia en ${diffDays} días`, color: 'text-blue-600 dark:text-blue-400', urgent: false };
  } else {
    return { text: `Se reinicia el ${nextDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, color: 'text-muted-foreground', urgent: false };
  }
} 