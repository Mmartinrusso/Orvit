/**
 * Tipos TypeScript para el módulo de Agenda
 * Seguimiento de tareas/pedidos a otras personas
 */

// =============================================================================
// ENUMS (match Prisma)
// =============================================================================

export type AgendaTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELLED';
export type TaskSource = 'WEB' | 'DISCORD_TEXT' | 'DISCORD_VOICE' | 'API';
export type NotificationChannel = 'DISCORD' | 'EMAIL' | 'WEB_PUSH' | 'SSE';
export type VoiceLogStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// =============================================================================
// CONFIGURACIÓN DE ESTADOS
// =============================================================================

export const TASK_STATUS_CONFIG: Record<AgendaTaskStatus, {
  label: string;
  labelShort: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  PENDING: {
    label: 'Pendiente',
    labelShort: 'Pend.',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    icon: 'Circle',
  },
  IN_PROGRESS: {
    label: 'En Progreso',
    labelShort: 'En prog.',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: 'PlayCircle',
  },
  WAITING: {
    label: 'Esperando',
    labelShort: 'Esp.',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    icon: 'Clock',
  },
  COMPLETED: {
    label: 'Completada',
    labelShort: 'Comp.',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: 'CheckCircle2',
  },
  CANCELLED: {
    label: 'Cancelada',
    labelShort: 'Canc.',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: 'XCircle',
  },
};

export const PRIORITY_CONFIG: Record<Priority, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  LOW: {
    label: 'Baja',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
  },
  MEDIUM: {
    label: 'Media',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  },
  HIGH: {
    label: 'Alta',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
  },
  URGENT: {
    label: 'Urgente',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
  },
};

export const SOURCE_CONFIG: Record<TaskSource, {
  label: string;
  icon: string;
}> = {
  WEB: { label: 'Web', icon: 'Globe' },
  DISCORD_TEXT: { label: 'Discord (texto)', icon: 'MessageSquare' },
  DISCORD_VOICE: { label: 'Discord (audio)', icon: 'Mic' },
  API: { label: 'API', icon: 'Code' },
};

// =============================================================================
// TIPOS DE ENTIDAD
// =============================================================================

export interface AgendaTaskAssignee {
  id: number;
  name: string;
  avatar?: string | null;
  type: 'user' | 'contact';
}

export interface AgendaTask {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null; // ISO date
  priority: Priority;
  status: AgendaTaskStatus;
  category: string | null;

  // Creador
  createdById: number;
  createdBy: {
    id: number;
    name: string;
    avatar?: string | null;
  };

  // Asignado (puede ser usuario o contacto)
  assignedToUserId: number | null;
  assignedToUser?: {
    id: number;
    name: string;
    avatar?: string | null;
  } | null;
  assignedToContactId: number | null;
  assignedToContact?: {
    id: number;
    name: string;
    avatar?: string | null;
  } | null;
  assignedToName: string | null;

  // Origen
  source: TaskSource;
  discordMessageId: string | null;

  // Empresa
  companyId: number;

  // Recordatorios
  reminders?: AgendaReminder[];

  // Notas
  notes: TaskNote[] | null;

  // Completado
  completedAt: string | null;
  completedNote: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface TaskNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy?: string;
}

export interface AgendaReminder {
  id: number;
  title: string;
  message: string | null;
  remindAt: string; // ISO date
  notifyVia: NotificationChannel[];
  isSent: boolean;
  sentAt: string | null;
  isRead: boolean;
  readAt: string | null;
  taskId: number | null;
  userId: number;
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceTaskLog {
  id: number;
  discordUserId: string;
  discordMessageId: string;
  discordAttachmentId: string | null;
  discordChannelId: string | null;
  audioUrl: string | null;
  audioHash: string | null;
  transcription: string | null;
  status: VoiceLogStatus;
  extractedData: ExtractedTaskData | null;
  errorMessage: string | null;
  taskId: number | null;
  userId: number;
  companyId: number;
  createdAt: string;
  processedAt: string | null;
}

export interface ExtractedTaskData {
  title: string;
  description: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  priority: Priority;
  category: string | null;
  confidence: number; // 0-100
}

// =============================================================================
// TIPOS PARA API
// =============================================================================

export interface CreateAgendaTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: Priority;
  category?: string;
  assignedToUserId?: number;
  assignedToContactId?: number;
  assignedToName?: string;
  reminders?: CreateReminderInput[];
}

export interface UpdateAgendaTaskInput {
  title?: string;
  description?: string;
  dueDate?: string | null;
  priority?: Priority;
  status?: AgendaTaskStatus;
  category?: string;
  assignedToUserId?: number | null;
  assignedToContactId?: number | null;
  assignedToName?: string | null;
  completedNote?: string;
  notes?: TaskNote[];
}

export interface CreateReminderInput {
  title?: string;
  message?: string;
  remindAt: string;
  notifyVia?: NotificationChannel[];
}

export interface AgendaTaskFilters {
  status?: AgendaTaskStatus | 'all';
  priority?: Priority | 'all';
  assigneeId?: number;
  assigneeType?: 'user' | 'contact';
  startDate?: string;
  endDate?: string;
  search?: string;
  category?: string;
}

// =============================================================================
// TIPOS PARA STATS/KPIs
// =============================================================================

export interface AgendaStats {
  total: number;
  pending: number;
  inProgress: number;
  waiting: number;
  completed: number;
  cancelled: number;
  overdue: number;
  dueToday: number;
  completedToday: number;
  urgentPending: number;
  topAssignees: {
    name: string;
    count: number;
    type: 'user' | 'contact';
  }[];
}

// =============================================================================
// TIPOS PARA CALENDARIO
// =============================================================================

export interface CalendarEvent {
  id: string;
  title: string;
  start: string | Date;
  end?: string | Date;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: {
    type: 'task' | 'reminder';
    data: AgendaTask | AgendaReminder;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Obtiene el nombre del asignado de una tarea
 */
export function getAssigneeName(task: AgendaTask): string {
  if (task.assignedToName) return task.assignedToName;
  if (task.assignedToUser?.name) return task.assignedToUser.name;
  if (task.assignedToContact?.name) return task.assignedToContact.name;
  return 'Sin asignar';
}

/**
 * Obtiene el tipo de asignado
 */
export function getAssigneeType(task: AgendaTask): 'user' | 'contact' | null {
  if (task.assignedToUserId) return 'user';
  if (task.assignedToContactId) return 'contact';
  return null;
}

/**
 * Verifica si una tarea está vencida
 */
export function isTaskOverdue(task: AgendaTask): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  return new Date(task.dueDate) < new Date();
}

/**
 * Verifica si una tarea vence hoy
 */
export function isTaskDueToday(task: AgendaTask): boolean {
  if (!task.dueDate) return false;
  const today = new Date();
  const dueDate = new Date(task.dueDate);
  return (
    dueDate.getFullYear() === today.getFullYear() &&
    dueDate.getMonth() === today.getMonth() &&
    dueDate.getDate() === today.getDate()
  );
}

/**
 * Calcula los días de atraso de una tarea
 */
export function getDaysOverdue(task: AgendaTask): number {
  if (!isTaskOverdue(task)) return 0;
  const now = new Date();
  const dueDate = new Date(task.dueDate!);
  const diffTime = now.getTime() - dueDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
