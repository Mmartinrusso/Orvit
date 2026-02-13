/**
 * Validaciones centralizadas para el módulo de tareas
 */

import { TASK_VALIDATION } from './constants';
import { purifyText } from '@/lib/validation/sanitization';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Sanitiza texto para prevenir XSS usando DOMPurify.
 * Wrapper sobre purifyText() para mantener retrocompatibilidad.
 */
export function sanitizeText(text: string): string {
  return purifyText(text);
}

/**
 * Valida los datos de creación de una tarea
 */
export function validateTaskCreate(data: {
  title?: string;
  description?: string;
  assignedToId?: string | number;
  priority?: string;
  dueDate?: string;
  tags?: string[];
  subtasks?: { title: string }[];
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Título requerido
  if (!data.title?.trim()) {
    errors.push({ field: 'title', message: 'El título es requerido' });
  } else {
    if (data.title.trim().length < TASK_VALIDATION.TITLE_MIN_LENGTH) {
      errors.push({
        field: 'title',
        message: `El título debe tener al menos ${TASK_VALIDATION.TITLE_MIN_LENGTH} caracteres`
      });
    }
    if (data.title.trim().length > TASK_VALIDATION.TITLE_MAX_LENGTH) {
      errors.push({
        field: 'title',
        message: `El título no puede exceder ${TASK_VALIDATION.TITLE_MAX_LENGTH} caracteres`
      });
    }
  }

  // Usuario asignado requerido
  if (!data.assignedToId) {
    errors.push({ field: 'assignedToId', message: 'Debe asignar la tarea a un usuario' });
  }

  // Descripción (opcional pero con límite)
  if (data.description && data.description.length > TASK_VALIDATION.DESCRIPTION_MAX_LENGTH) {
    errors.push({
      field: 'description',
      message: `La descripción no puede exceder ${TASK_VALIDATION.DESCRIPTION_MAX_LENGTH} caracteres`
    });
  }

  // Prioridad válida
  if (data.priority && !['baja', 'media', 'alta', 'urgente'].includes(data.priority)) {
    errors.push({ field: 'priority', message: 'Prioridad inválida' });
  }

  // Fecha válida
  if (data.dueDate) {
    const date = new Date(data.dueDate);
    if (isNaN(date.getTime())) {
      errors.push({ field: 'dueDate', message: 'Fecha inválida' });
    }
  }

  // Tags
  if (data.tags) {
    if (data.tags.length > TASK_VALIDATION.MAX_TAGS) {
      errors.push({
        field: 'tags',
        message: `Máximo ${TASK_VALIDATION.MAX_TAGS} etiquetas permitidas`
      });
    }
    for (const tag of data.tags) {
      if (tag.length > TASK_VALIDATION.TAG_MAX_LENGTH) {
        errors.push({
          field: 'tags',
          message: `Las etiquetas no pueden exceder ${TASK_VALIDATION.TAG_MAX_LENGTH} caracteres`
        });
        break;
      }
    }
  }

  // Subtareas
  if (data.subtasks) {
    if (data.subtasks.length > TASK_VALIDATION.MAX_SUBTASKS) {
      errors.push({
        field: 'subtasks',
        message: `Máximo ${TASK_VALIDATION.MAX_SUBTASKS} subtareas permitidas`
      });
    }
    for (const subtask of data.subtasks) {
      if (subtask.title.length > TASK_VALIDATION.SUBTASK_TITLE_MAX_LENGTH) {
        errors.push({
          field: 'subtasks',
          message: `Los títulos de subtareas no pueden exceder ${TASK_VALIDATION.SUBTASK_TITLE_MAX_LENGTH} caracteres`
        });
        break;
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valida los datos de actualización de una tarea
 */
export function validateTaskUpdate(data: {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  tags?: string[];
  progress?: number;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Título (si se proporciona)
  if (data.title !== undefined) {
    if (!data.title.trim()) {
      errors.push({ field: 'title', message: 'El título no puede estar vacío' });
    } else if (data.title.trim().length < TASK_VALIDATION.TITLE_MIN_LENGTH) {
      errors.push({
        field: 'title',
        message: `El título debe tener al menos ${TASK_VALIDATION.TITLE_MIN_LENGTH} caracteres`
      });
    } else if (data.title.trim().length > TASK_VALIDATION.TITLE_MAX_LENGTH) {
      errors.push({
        field: 'title',
        message: `El título no puede exceder ${TASK_VALIDATION.TITLE_MAX_LENGTH} caracteres`
      });
    }
  }

  // Status válido
  if (data.status && !['pendiente', 'en-curso', 'realizada', 'cancelada'].includes(data.status)) {
    errors.push({ field: 'status', message: 'Estado inválido' });
  }

  // Prioridad válida
  if (data.priority && !['baja', 'media', 'alta', 'urgente'].includes(data.priority)) {
    errors.push({ field: 'priority', message: 'Prioridad inválida' });
  }

  // Progress válido
  if (data.progress !== undefined) {
    if (data.progress < 0 || data.progress > 100) {
      errors.push({ field: 'progress', message: 'El progreso debe estar entre 0 y 100' });
    }
  }

  // Descripción (si se proporciona)
  if (data.description && data.description.length > TASK_VALIDATION.DESCRIPTION_MAX_LENGTH) {
    errors.push({
      field: 'description',
      message: `La descripción no puede exceder ${TASK_VALIDATION.DESCRIPTION_MAX_LENGTH} caracteres`
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valida los datos de creación de una tarea fija
 */
export function validateFixedTaskCreate(data: {
  title?: string;
  frequency?: string;
  nextExecution?: string;
  companyId?: number | string;
  description?: string;
  priority?: string;
  estimatedTime?: number;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Título requerido
  if (!data.title?.trim()) {
    errors.push({ field: 'title', message: 'El título es requerido' });
  } else if (data.title.trim().length > TASK_VALIDATION.TITLE_MAX_LENGTH) {
    errors.push({
      field: 'title',
      message: `El título no puede exceder ${TASK_VALIDATION.TITLE_MAX_LENGTH} caracteres`
    });
  }

  // Frecuencia requerida y válida
  const validFrequencies = ['diaria', 'semanal', 'quincenal', 'mensual', 'trimestral', 'semestral', 'anual'];
  if (!data.frequency) {
    errors.push({ field: 'frequency', message: 'La frecuencia es requerida' });
  } else if (!validFrequencies.includes(data.frequency)) {
    errors.push({ field: 'frequency', message: 'Frecuencia inválida' });
  }

  // CompanyId requerido
  if (!data.companyId) {
    errors.push({ field: 'companyId', message: 'El ID de empresa es requerido' });
  }

  // nextExecution requerido y válido
  if (!data.nextExecution) {
    errors.push({ field: 'nextExecution', message: 'La fecha de próxima ejecución es requerida' });
  } else {
    const date = new Date(data.nextExecution);
    if (isNaN(date.getTime())) {
      errors.push({ field: 'nextExecution', message: 'Fecha de próxima ejecución inválida' });
    }
  }

  // Prioridad válida
  if (data.priority && !['baja', 'media', 'alta'].includes(data.priority)) {
    errors.push({ field: 'priority', message: 'Prioridad inválida' });
  }

  // Tiempo estimado válido
  if (data.estimatedTime !== undefined && (data.estimatedTime < 0 || data.estimatedTime > 1440)) {
    errors.push({ field: 'estimatedTime', message: 'El tiempo estimado debe estar entre 0 y 1440 minutos' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Escapa caracteres especiales para uso en SQL LIKE
 */
export function escapeLikePattern(pattern: string): string {
  return pattern
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/'/g, "''");
}

/**
 * Valida que un ID sea un número válido
 */
export function validateId(id: string | number): number | null {
  const parsed = typeof id === 'number' ? id : parseInt(id);
  return isNaN(parsed) || parsed <= 0 ? null : parsed;
}
