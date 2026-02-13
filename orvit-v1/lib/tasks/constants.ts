/**
 * Constantes y mapeos centralizados para el módulo de tareas
 * Evita duplicación de código en múltiples archivos
 */

// =============================================================================
// MAPEOS DE PRIORIDAD
// =============================================================================

export const PRIORITY_MAP = {
  'baja': 'LOW',
  'media': 'MEDIUM',
  'alta': 'HIGH',
  'urgente': 'URGENT'
} as const;

export const REVERSE_PRIORITY_MAP = {
  'LOW': 'baja',
  'MEDIUM': 'media',
  'HIGH': 'alta',
  'URGENT': 'urgente'
} as const;

// =============================================================================
// MAPEOS DE STATUS
// =============================================================================

export const STATUS_MAP = {
  'pendiente': 'TODO',
  'en-curso': 'IN_PROGRESS',
  'realizada': 'DONE',
  'cancelada': 'CANCELLED'
} as const;

export const REVERSE_STATUS_MAP = {
  'TODO': 'pendiente',
  'IN_PROGRESS': 'en-curso',
  'DONE': 'realizada',
  'CANCELLED': 'cancelada'
} as const;

// =============================================================================
// MAPEOS DE FRECUENCIA (para tareas fijas)
// =============================================================================

export const FREQUENCY_MAP = {
  'diaria': 'DAILY',
  'semanal': 'WEEKLY',
  'quincenal': 'BIWEEKLY',
  'mensual': 'MONTHLY',
  'trimestral': 'QUARTERLY',
  'semestral': 'SEMIANNUAL',
  'anual': 'ANNUAL'
} as const;

export const REVERSE_FREQUENCY_MAP = {
  'DAILY': 'diaria',
  'WEEKLY': 'semanal',
  'BIWEEKLY': 'quincenal',
  'MONTHLY': 'mensual',
  'QUARTERLY': 'trimestral',
  'SEMIANNUAL': 'semestral',
  'ANNUAL': 'anual'
} as const;

// =============================================================================
// TIPOS
// =============================================================================

export type FrontendPriority = keyof typeof PRIORITY_MAP;
export type DbPriority = keyof typeof REVERSE_PRIORITY_MAP;

export type FrontendStatus = keyof typeof STATUS_MAP;
export type DbStatus = keyof typeof REVERSE_STATUS_MAP;

export type FrontendFrequency = keyof typeof FREQUENCY_MAP;
export type DbFrequency = keyof typeof REVERSE_FREQUENCY_MAP;

// =============================================================================
// FUNCIONES DE MAPEO SEGURAS
// =============================================================================

/**
 * Convierte prioridad del frontend al formato de BD
 */
export function mapPriorityToDb(priority: string): DbPriority {
  const mapped = PRIORITY_MAP[priority as FrontendPriority];
  return mapped || 'MEDIUM';
}

/**
 * Convierte prioridad de BD al formato frontend
 */
export function mapPriorityToFrontend(priority: string): FrontendPriority {
  const mapped = REVERSE_PRIORITY_MAP[priority as DbPriority];
  return mapped || 'media';
}

/**
 * Convierte status del frontend al formato de BD
 */
export function mapStatusToDb(status: string): DbStatus {
  const mapped = STATUS_MAP[status as FrontendStatus];
  return mapped || 'TODO';
}

/**
 * Convierte status de BD al formato frontend
 */
export function mapStatusToFrontend(status: string): FrontendStatus {
  const mapped = REVERSE_STATUS_MAP[status as DbStatus];
  return mapped || 'pendiente';
}

/**
 * Convierte frecuencia del frontend al formato de BD
 */
export function mapFrequencyToDb(frequency: string): DbFrequency {
  const mapped = FREQUENCY_MAP[frequency as FrontendFrequency];
  return mapped || 'MONTHLY';
}

/**
 * Convierte frecuencia de BD al formato frontend
 */
export function mapFrequencyToFrontend(frequency: string): FrontendFrequency {
  const mapped = REVERSE_FREQUENCY_MAP[frequency as DbFrequency];
  return mapped || 'mensual';
}

// =============================================================================
// CONSTANTES DE VALIDACIÓN
// =============================================================================

export const TASK_VALIDATION = {
  TITLE_MAX_LENGTH: 200,
  TITLE_MIN_LENGTH: 3,
  DESCRIPTION_MAX_LENGTH: 5000,
  MAX_TAGS: 10,
  TAG_MAX_LENGTH: 50,
  MAX_SUBTASKS: 50,
  SUBTASK_TITLE_MAX_LENGTH: 200,
  MAX_ATTACHMENTS: 10,
  MAX_ATTACHMENT_SIZE_MB: 10,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// =============================================================================
// COLORES Y ESTILOS
// =============================================================================

export const PRIORITY_COLORS = {
  baja: 'text-green-500',
  media: 'text-yellow-500',
  alta: 'text-orange-500',
  urgente: 'text-red-500',
} as const;

export const STATUS_COLORS = {
  pendiente: 'text-gray-500',
  'en-curso': 'text-blue-500',
  realizada: 'text-green-500',
  cancelada: 'text-red-500',
} as const;

export const PRIORITY_BADGES = {
  baja: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  media: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  alta: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgente: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
} as const;

export const STATUS_BADGES = {
  pendiente: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  'en-curso': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  realizada: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelada: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
} as const;
