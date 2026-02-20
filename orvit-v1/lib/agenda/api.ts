/**
 * Funciones de API para el módulo de Agenda
 */

import type {
  AgendaTask,
  AgendaReminder,
  AgendaStats,
  AgendaTaskFilters,
  CreateAgendaTaskInput,
  UpdateAgendaTaskInput,
  CreateReminderInput,
} from './types';

const BASE_URL = '/api/agenda';

// =============================================================================
// TAREAS
// =============================================================================

/**
 * Obtener lista de tareas con filtros
 */
export async function fetchAgendaTasks(
  companyId: number,
  filters?: AgendaTaskFilters
): Promise<AgendaTask[]> {
  const params = new URLSearchParams();
  params.append('companyId', String(companyId));

  if (filters) {
    if (filters.status && filters.status !== 'all') {
      params.append('status', filters.status);
    }
    if (filters.priority && filters.priority !== 'all') {
      params.append('priority', filters.priority);
    }
    if (filters.assigneeId) {
      params.append('assigneeId', String(filters.assigneeId));
    }
    if (filters.assigneeType) {
      params.append('assigneeType', filters.assigneeType);
    }
    if (filters.startDate) {
      params.append('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params.append('endDate', filters.endDate);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }
    if (filters.category) {
      params.append('category', filters.category);
    }
  }

  const res = await fetch(`${BASE_URL}/tasks?${params.toString()}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error al obtener tareas');
  }
  const json = await res.json();
  return json.data ?? json;
}

/**
 * Obtener una tarea por ID
 */
export async function fetchAgendaTask(taskId: number): Promise<AgendaTask> {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error al obtener tarea');
  }
  return res.json();
}

/**
 * Crear nueva tarea
 */
export async function createAgendaTask(
  companyId: number,
  data: CreateAgendaTaskInput
): Promise<AgendaTask> {
  const res = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, companyId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error al crear tarea');
  }
  return res.json();
}

/**
 * Actualizar tarea
 */
export async function updateAgendaTask(
  taskId: number,
  data: UpdateAgendaTaskInput
): Promise<AgendaTask> {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error al actualizar tarea');
  }
  return res.json();
}

/**
 * Eliminar tarea
 */
export async function deleteAgendaTask(taskId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error al eliminar tarea');
  }
}

/**
 * Marcar tarea como completada
 */
export async function completeAgendaTask(
  taskId: number,
  note?: string
): Promise<AgendaTask> {
  return updateAgendaTask(taskId, {
    status: 'COMPLETED',
    completedNote: note,
  });
}

/**
 * Agregar nota a una tarea
 */
export async function addTaskNote(
  taskId: number,
  content: string
): Promise<AgendaTask> {
  const task = await fetchAgendaTask(taskId);
  const notes = task.notes || [];
  notes.push({
    id: crypto.randomUUID(),
    content,
    createdAt: new Date().toISOString(),
  });
  return updateAgendaTask(taskId, { notes });
}

// =============================================================================
// RECORDATORIOS
// =============================================================================

/**
 * Obtener recordatorios
 */
export async function fetchAgendaReminders(
  companyId: number,
  options?: { taskId?: number; pending?: boolean }
): Promise<AgendaReminder[]> {
  const params = new URLSearchParams();
  params.append('companyId', String(companyId));

  if (options?.taskId) {
    params.append('taskId', String(options.taskId));
  }
  if (options?.pending !== undefined) {
    params.append('pending', String(options.pending));
  }

  const res = await fetch(`${BASE_URL}/reminders?${params.toString()}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error al obtener recordatorios');
  }
  return res.json();
}

/**
 * Crear recordatorio
 */
export async function createAgendaReminder(
  companyId: number,
  data: CreateReminderInput & { taskId?: number }
): Promise<AgendaReminder> {
  const res = await fetch(`${BASE_URL}/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, companyId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error al crear recordatorio');
  }
  return res.json();
}

/**
 * Eliminar recordatorio
 */
export async function deleteAgendaReminder(reminderId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/reminders/${reminderId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error al eliminar recordatorio');
  }
}

// =============================================================================
// STATS
// =============================================================================

/**
 * Obtener estadísticas de agenda
 */
export async function fetchAgendaStats(companyId: number): Promise<AgendaStats> {
  const res = await fetch(`${BASE_URL}/stats?companyId=${companyId}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error al obtener estadísticas');
  }
  return res.json();
}

// =============================================================================
// USUARIOS Y CONTACTOS (para selector de asignados)
// =============================================================================

export interface AssigneeOption {
  id: number;
  name: string;
  avatar?: string | null;
  type: 'user' | 'contact';
  email?: string | null;
}

/**
 * Buscar usuarios y contactos para asignar
 */
export async function searchAssignees(
  companyId: number,
  userId: number,
  search?: string
): Promise<AssigneeOption[]> {
  const params = new URLSearchParams();
  params.append('companyId', String(companyId));
  params.append('userId', String(userId));
  if (search) {
    params.append('search', search);
  }

  const res = await fetch(`${BASE_URL}/assignees?${params.toString()}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error al buscar asignados');
  }
  return res.json();
}
