/**
 * Tipo unificado para combinar AgendaTask y Task regular en una sola vista.
 * Toda la unificación es frontend - no se modifican las APIs backend.
 */

import type { AgendaTask, AgendaTaskStatus, Priority } from '@/lib/agenda/types';
import type { Task } from '@/lib/tasks/types';

// =============================================================================
// TIPOS
// =============================================================================

export type UnifiedTaskOrigin = 'agenda' | 'regular';

export type UnifiedTaskStatus = 'pending' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';

export type UnifiedTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface UnifiedTask {
  /** ID único compuesto: "agenda-123" o "regular-abc" */
  uid: string;
  /** ID original del backend */
  originalId: number | string;
  /** Origen de la tarea */
  origin: UnifiedTaskOrigin;

  // Campos comunes normalizados
  title: string;
  description: string | null;
  status: UnifiedTaskStatus;
  priority: UnifiedTaskPriority;
  dueDate: string | null;
  assigneeName: string;
  createdAt: string;
  updatedAt: string;

  // Referencia al objeto original para acceder a campos específicos
  originalAgendaTask?: AgendaTask;
  originalRegularTask?: Task;
}

// =============================================================================
// MAPEO: AgendaTask → UnifiedTask
// =============================================================================

const AGENDA_STATUS_MAP: Record<AgendaTaskStatus, UnifiedTaskStatus> = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  WAITING: 'waiting',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const AGENDA_PRIORITY_MAP: Record<Priority, UnifiedTaskPriority> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

export function mapAgendaToUnified(task: AgendaTask): UnifiedTask {
  const assigneeName =
    task.assignedToName ||
    task.assignedToUser?.name ||
    task.assignedToContact?.name ||
    'Sin asignar';

  return {
    uid: `agenda-${task.id}`,
    originalId: task.id,
    origin: 'agenda',
    title: task.title,
    description: task.description,
    status: AGENDA_STATUS_MAP[task.status],
    priority: AGENDA_PRIORITY_MAP[task.priority],
    dueDate: task.dueDate,
    assigneeName,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    originalAgendaTask: task,
  };
}

// =============================================================================
// MAPEO: Task regular → UnifiedTask
// =============================================================================

const REGULAR_STATUS_MAP: Record<Task['status'], UnifiedTaskStatus> = {
  'pendiente': 'pending',
  'en-curso': 'in_progress',
  'realizada': 'completed',
  'cancelada': 'cancelled',
};

const REGULAR_PRIORITY_MAP: Record<Task['priority'], UnifiedTaskPriority> = {
  'baja': 'low',
  'media': 'medium',
  'alta': 'high',
  'urgente': 'urgent',
};

export function mapRegularToUnified(task: Task): UnifiedTask {
  return {
    uid: `regular-${task.id}`,
    originalId: task.id,
    origin: 'regular',
    title: task.title,
    description: task.description || null,
    status: REGULAR_STATUS_MAP[task.status],
    priority: REGULAR_PRIORITY_MAP[task.priority],
    dueDate: task.dueDate || null,
    assigneeName: task.assignedTo?.name || 'Sin asignar',
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    originalRegularTask: task,
  };
}

// =============================================================================
// MAPEO INVERSO: UnifiedTaskStatus → AgendaTaskStatus
// =============================================================================

export const UNIFIED_TO_AGENDA_STATUS: Record<UnifiedTaskStatus, AgendaTaskStatus> = {
  pending: 'PENDING',
  in_progress: 'IN_PROGRESS',
  waiting: 'WAITING',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

export const UNIFIED_TO_REGULAR_STATUS: Record<UnifiedTaskStatus, Task['status']> = {
  pending: 'pendiente',
  in_progress: 'en-curso',
  waiting: 'pendiente', // Regular tasks no tienen "waiting"
  completed: 'realizada',
  cancelled: 'cancelada',
};

// =============================================================================
// CONFIGURACIÓN DE DISPLAY
// =============================================================================

export const UNIFIED_STATUS_CONFIG: Record<UnifiedTaskStatus, {
  label: string;
  labelShort: string;
  color: string;
  bgColor: string;
  dotColor: string;
}> = {
  pending: {
    label: 'Pendiente',
    labelShort: 'Pend.',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    dotColor: 'bg-amber-500',
  },
  in_progress: {
    label: 'En Progreso',
    labelShort: 'En prog.',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    dotColor: 'bg-blue-500',
  },
  waiting: {
    label: 'Esperando',
    labelShort: 'Esp.',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    dotColor: 'bg-amber-400',
  },
  completed: {
    label: 'Completada',
    labelShort: 'Comp.',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    dotColor: 'bg-green-500',
  },
  cancelled: {
    label: 'Cancelada',
    labelShort: 'Canc.',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    dotColor: 'bg-red-500',
  },
};

export const UNIFIED_PRIORITY_CONFIG: Record<UnifiedTaskPriority, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  low: {
    label: 'Baja',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
  },
  medium: {
    label: 'Media',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  },
  high: {
    label: 'Alta',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
  },
  urgent: {
    label: 'Urgente',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
  },
};

export const ORIGIN_CONFIG: Record<UnifiedTaskOrigin, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  agenda: {
    label: 'Agenda',
    color: '#6366f1',
    bgColor: '#6366f115',
  },
  regular: {
    label: 'Tarea',
    color: '#8b5cf6',
    bgColor: '#8b5cf615',
  },
};

// =============================================================================
// HELPERS
// =============================================================================

export function isUnifiedTaskOverdue(task: UnifiedTask): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  return new Date(task.dueDate) < new Date();
}

export function isUnifiedTaskDueToday(task: UnifiedTask): boolean {
  if (!task.dueDate) return false;
  const today = new Date();
  const dueDate = new Date(task.dueDate);
  return (
    dueDate.getFullYear() === today.getFullYear() &&
    dueDate.getMonth() === today.getMonth() &&
    dueDate.getDate() === today.getDate()
  );
}
